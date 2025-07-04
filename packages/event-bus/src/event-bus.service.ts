import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import Redis from 'redis';

export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  timestamp: Date;
  data: Record<string, any>;
  metadata?: {
    correlationId?: string;
    causationId?: string;
    userId?: string;
    source?: string;
    [key: string]: any;
  };
}

export interface EventHandler<T = any> {
  handle(event: T): Promise<void> | void;
}

export interface Saga {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'compensating';
  steps: SagaStep[];
  currentStep: number;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SagaStep {
  id: string;
  name: string;
  service: string;
  action: string;
  compensationAction?: string;
  status: 'pending' | 'completed' | 'failed' | 'compensated';
  data?: Record<string, any>;
  error?: string;
}

@Injectable()
export class EventBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private client: ClientProxy;
  private redis: Redis.RedisClientType;
  private eventStream = new Subject<DomainEvent>();
  private eventHandlers = new Map<string, EventHandler[]>();
  private sagas = new Map<string, Saga>();
  private connectionStatus = new BehaviorSubject<'connected' | 'disconnected' | 'error'>('disconnected');

  constructor() {
    this.initializeRedisClient();
    this.initializeMicroserviceClient();
  }

  async onModuleInit() {
    await this.connect();
    this.setupEventListeners();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private initializeRedisClient() {
    this.redis = Redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis');
      this.connectionStatus.next('connected');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
      this.connectionStatus.next('error');
    });
  }

  private initializeMicroserviceClient() {
    this.client = ClientProxyFactory.create({
      transport: Transport.REDIS,
      options: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        retryAttempts: 5,
        retryDelay: 3000,
      },
    });
  }

  private async connect() {
    try {
      await this.redis.connect();
      await this.client.connect();
      this.logger.log('Event bus connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect event bus:', error);
      throw error;
    }
  }

  private async disconnect() {
    try {
      await this.redis.disconnect();
      await this.client.close();
      this.logger.log('Event bus disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting event bus:', error);
    }
  }

  // Publish domain event
  async publishEvent(event: DomainEvent): Promise<void> {
    try {
      // Add metadata
      const enrichedEvent: DomainEvent = {
        ...event,
        id: event.id || crypto.randomUUID(),
        timestamp: event.timestamp || new Date(),
        metadata: {
          ...event.metadata,
          publishedAt: new Date(),
          source: event.metadata?.source || 'event-bus',
        },
      };

      // Store event in event store
      await this.storeEvent(enrichedEvent);

      // Publish to Redis streams
      await this.redis.xAdd(
        `events:${event.aggregateType}`,
        '*',
        {
          eventId: enrichedEvent.id,
          eventType: enrichedEvent.type,
          data: JSON.stringify(enrichedEvent),
        }
      );

      // Emit to microservices
      this.client.emit(event.type, enrichedEvent);

      // Emit to local event stream
      this.eventStream.next(enrichedEvent);

      this.logger.debug(`Published event: ${event.type} for ${event.aggregateType}:${event.aggregateId}`);
    } catch (error) {
      this.logger.error(`Failed to publish event ${event.type}:`, error);
      throw error;
    }
  }

  // Subscribe to events
  subscribe<T = any>(eventType: string): Observable<T> {
    return this.eventStream.pipe(
      filter(event => event.type === eventType),
      map(event => event as T)
    );
  }

  // Register event handler
  registerHandler(eventType: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
    this.logger.debug(`Registered handler for event type: ${eventType}`);
  }

  // Unregister event handler
  unregisterHandler(eventType: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        this.logger.debug(`Unregistered handler for event type: ${eventType}`);
      }
    }
  }

  // Saga orchestration
  async startSaga(saga: Omit<Saga, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const sagaId = crypto.randomUUID();
    const newSaga: Saga = {
      ...saga,
      id: sagaId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sagas.set(sagaId, newSaga);
    await this.storeSaga(newSaga);

    // Start executing saga
    this.executeSaga(sagaId);

    this.logger.debug(`Started saga: ${saga.type} with ID: ${sagaId}`);
    return sagaId;
  }

  private async executeSaga(sagaId: string): Promise<void> {
    const saga = this.sagas.get(sagaId);
    if (!saga || saga.status !== 'pending') return;

    try {
      saga.status = 'running';
      await this.updateSaga(saga);

      for (let i = saga.currentStep; i < saga.steps.length; i++) {
        const step = saga.steps[i];
        
        try {
          // Execute step
          await this.executeSagaStep(saga, step);
          step.status = 'completed';
          saga.currentStep = i + 1;
        } catch (error) {
          step.status = 'failed';
          step.error = error.message;
          
          // Start compensation
          await this.compensateSaga(saga, i);
          return;
        }
      }

      saga.status = 'completed';
      await this.updateSaga(saga);
      
      this.logger.debug(`Saga completed: ${saga.type} (${sagaId})`);
    } catch (error) {
      saga.status = 'failed';
      await this.updateSaga(saga);
      this.logger.error(`Saga failed: ${saga.type} (${sagaId}):`, error);
    }
  }

  private async executeSagaStep(saga: Saga, step: SagaStep): Promise<void> {
    const event: DomainEvent = {
      id: crypto.randomUUID(),
      type: `saga.${step.action}`,
      aggregateId: saga.id,
      aggregateType: 'saga',
      version: 1,
      timestamp: new Date(),
      data: {
        sagaId: saga.id,
        stepId: step.id,
        service: step.service,
        action: step.action,
        ...step.data,
        ...saga.data,
      },
      metadata: {
        sagaType: saga.type,
        stepName: step.name,
      },
    };

    await this.publishEvent(event);
  }

  private async compensateSaga(saga: Saga, failedStepIndex: number): Promise<void> {
    saga.status = 'compensating';
    await this.updateSaga(saga);

    // Execute compensation actions in reverse order
    for (let i = failedStepIndex - 1; i >= 0; i--) {
      const step = saga.steps[i];
      
      if (step.compensationAction && step.status === 'completed') {
        try {
          const compensationEvent: DomainEvent = {
            id: crypto.randomUUID(),
            type: `saga.${step.compensationAction}`,
            aggregateId: saga.id,
            aggregateType: 'saga',
            version: 1,
            timestamp: new Date(),
            data: {
              sagaId: saga.id,
              stepId: step.id,
              service: step.service,
              action: step.compensationAction,
              ...step.data,
              ...saga.data,
            },
            metadata: {
              sagaType: saga.type,
              stepName: step.name,
              isCompensation: true,
            },
          };

          await this.publishEvent(compensationEvent);
          step.status = 'compensated';
        } catch (error) {
          this.logger.error(`Compensation failed for step ${step.name}:`, error);
        }
      }
    }

    saga.status = 'failed';
    await this.updateSaga(saga);
  }

  // Event sourcing
  async getEventHistory(aggregateId: string, aggregateType: string): Promise<DomainEvent[]> {
    const key = `events:${aggregateType}:${aggregateId}`;
    const events = await this.redis.lRange(key, 0, -1);
    return events.map(eventData => JSON.parse(eventData));
  }

  async replayEvents(aggregateId: string, aggregateType: string, fromVersion?: number): Promise<void> {
    const events = await this.getEventHistory(aggregateId, aggregateType);
    const filteredEvents = fromVersion 
      ? events.filter(event => event.version >= fromVersion)
      : events;

    for (const event of filteredEvents) {
      this.eventStream.next(event);
    }
  }

  // Health and monitoring
  getConnectionStatus(): Observable<'connected' | 'disconnected' | 'error'> {
    return this.connectionStatus.asObservable();
  }

  async getEventStats(): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    activeSagas: number;
    completedSagas: number;
    failedSagas: number;
  }> {
    const eventKeys = await this.redis.keys('events:*');
    let totalEvents = 0;
    const eventsByType: Record<string, number> = {};

    for (const key of eventKeys) {
      const count = await this.redis.lLen(key);
      totalEvents += count;
      const type = key.split(':')[1];
      eventsByType[type] = count;
    }

    const activeSagas = Array.from(this.sagas.values()).filter(s => s.status === 'running').length;
    const completedSagas = Array.from(this.sagas.values()).filter(s => s.status === 'completed').length;
    const failedSagas = Array.from(this.sagas.values()).filter(s => s.status === 'failed').length;

    return {
      totalEvents,
      eventsByType,
      activeSagas,
      completedSagas,
      failedSagas,
    };
  }

  private setupEventListeners(): void {
    this.eventStream.subscribe(event => {
      const handlers = this.eventHandlers.get(event.type) || [];
      handlers.forEach(async handler => {
        try {
          await handler.handle(event);
        } catch (error) {
          this.logger.error(`Event handler failed for ${event.type}:`, error);
        }
      });
    });
  }

  private async storeEvent(event: DomainEvent): Promise<void> {
    const key = `events:${event.aggregateType}:${event.aggregateId}`;
    await this.redis.rPush(key, JSON.stringify(event));
    
    // Also store in global event log
    await this.redis.rPush('events:all', JSON.stringify(event));
  }

  private async storeSaga(saga: Saga): Promise<void> {
    const key = `saga:${saga.id}`;
    await this.redis.set(key, JSON.stringify(saga));
  }

  private async updateSaga(saga: Saga): Promise<void> {
    saga.updatedAt = new Date();
    this.sagas.set(saga.id, saga);
    await this.storeSaga(saga);
  }
}
