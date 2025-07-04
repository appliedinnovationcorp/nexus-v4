import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventPattern, MessagePattern } from '@nestjs/microservices';

export interface AnalyticsEvent {
  id: string;
  type: string;
  source: string;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface UserActivity {
  userId: string;
  sessionId: string;
  action: string;
  resource: string;
  timestamp: Date;
  duration?: number;
  metadata: Record<string, any>;
}

export interface SystemMetrics {
  service: string;
  metric: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags: Record<string, string>;
}

@Injectable()
export class DataIngestionService {
  private readonly logger = new Logger(DataIngestionService.name);

  constructor(
    @InjectQueue('event-processing') private eventQueue: Queue,
    @InjectQueue('user-activity') private userActivityQueue: Queue,
    @InjectQueue('system-metrics') private systemMetricsQueue: Queue,
  ) {}

  // HTTP endpoint for direct event ingestion
  async ingestEvent(event: AnalyticsEvent): Promise<void> {
    this.logger.debug(`Ingesting event: ${event.type} from ${event.source}`);
    
    await this.eventQueue.add('process-event', event, {
      priority: this.getEventPriority(event.type),
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  // Microservice event handlers
  @EventPattern('user.activity')
  async handleUserActivity(activity: UserActivity): Promise<void> {
    this.logger.debug(`Processing user activity: ${activity.action} by ${activity.userId}`);
    
    await this.userActivityQueue.add('process-user-activity', activity, {
      priority: 5,
      attempts: 3,
    });
  }

  @EventPattern('system.metrics')
  async handleSystemMetrics(metrics: SystemMetrics): Promise<void> {
    this.logger.debug(`Processing system metrics: ${metrics.metric} from ${metrics.service}`);
    
    await this.systemMetricsQueue.add('process-system-metrics', metrics, {
      priority: 3,
      attempts: 2,
    });
  }

  @MessagePattern('analytics.health')
  async getHealth(): Promise<{ status: string; queues: Record<string, number> }> {
    const eventQueueCount = await this.eventQueue.count();
    const userActivityQueueCount = await this.userActivityQueue.count();
    const systemMetricsQueueCount = await this.systemMetricsQueue.count();

    return {
      status: 'healthy',
      queues: {
        'event-processing': eventQueueCount,
        'user-activity': userActivityQueueCount,
        'system-metrics': systemMetricsQueueCount,
      },
    };
  }

  // Batch ingestion for high-volume scenarios
  async ingestEventsBatch(events: AnalyticsEvent[]): Promise<void> {
    this.logger.debug(`Batch ingesting ${events.length} events`);
    
    const jobs = events.map(event => ({
      name: 'process-event',
      data: event,
      opts: {
        priority: this.getEventPriority(event.type),
        attempts: 3,
      },
    }));

    await this.eventQueue.addBulk(jobs);
  }

  // Real-time streaming ingestion
  async ingestStream(eventStream: AsyncIterable<AnalyticsEvent>): Promise<void> {
    this.logger.debug('Starting stream ingestion');
    
    for await (const event of eventStream) {
      await this.ingestEvent(event);
    }
  }

  private getEventPriority(eventType: string): number {
    const priorityMap: Record<string, number> = {
      'error': 10,
      'security': 9,
      'payment': 8,
      'user.signup': 7,
      'user.login': 6,
      'page.view': 3,
      'click': 2,
      'scroll': 1,
    };

    return priorityMap[eventType] || 5;
  }

  // Data validation and enrichment
  private enrichEvent(event: AnalyticsEvent): AnalyticsEvent {
    return {
      ...event,
      metadata: {
        ...event.metadata,
        ingestionTime: new Date(),
        version: '1.0',
        source: event.source || 'unknown',
      },
    };
  }

  // Get ingestion statistics
  async getIngestionStats(): Promise<{
    totalProcessed: number;
    processingRate: number;
    queueSizes: Record<string, number>;
    errorRate: number;
  }> {
    const [eventStats, userActivityStats, systemMetricsStats] = await Promise.all([
      this.eventQueue.getJobCounts(),
      this.userActivityQueue.getJobCounts(),
      this.systemMetricsQueue.getJobCounts(),
    ]);

    const totalProcessed = 
      eventStats.completed + 
      userActivityStats.completed + 
      systemMetricsStats.completed;

    const totalFailed = 
      eventStats.failed + 
      userActivityStats.failed + 
      systemMetricsStats.failed;

    return {
      totalProcessed,
      processingRate: totalProcessed / (Date.now() / 1000 / 60), // per minute
      queueSizes: {
        events: eventStats.waiting + eventStats.active,
        userActivity: userActivityStats.waiting + userActivityStats.active,
        systemMetrics: systemMetricsStats.waiting + systemMetricsStats.active,
      },
      errorRate: totalFailed / (totalProcessed + totalFailed) || 0,
    };
  }
}
