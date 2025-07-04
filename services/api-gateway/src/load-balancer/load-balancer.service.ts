import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

export interface ServiceInstance {
  id: string;
  service: string;
  url: string;
  health: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck: Date;
  responseTime: number;
  weight: number;
  connections: number;
  metadata: Record<string, any>;
}

export interface LoadBalancingStrategy {
  name: 'round-robin' | 'weighted' | 'least-connections' | 'response-time';
  selectInstance(instances: ServiceInstance[]): ServiceInstance | null;
}

@Injectable()
export class LoadBalancerService {
  private readonly logger = new Logger(LoadBalancerService.name);
  private services = new Map<string, ServiceInstance[]>();
  private roundRobinCounters = new Map<string, number>();
  private strategies = new Map<string, LoadBalancingStrategy>();

  constructor() {
    this.initializeStrategies();
    this.initializeServices();
  }

  private initializeStrategies(): void {
    // Round Robin Strategy
    this.strategies.set('round-robin', {
      name: 'round-robin',
      selectInstance: (instances: ServiceInstance[]) => {
        if (instances.length === 0) return null;
        
        const serviceName = instances[0].service;
        const counter = this.roundRobinCounters.get(serviceName) || 0;
        const selectedIndex = counter % instances.length;
        
        this.roundRobinCounters.set(serviceName, counter + 1);
        return instances[selectedIndex];
      },
    });

    // Weighted Strategy
    this.strategies.set('weighted', {
      name: 'weighted',
      selectInstance: (instances: ServiceInstance[]) => {
        if (instances.length === 0) return null;
        
        const totalWeight = instances.reduce((sum, instance) => sum + instance.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const instance of instances) {
          random -= instance.weight;
          if (random <= 0) {
            return instance;
          }
        }
        
        return instances[0];
      },
    });

    // Least Connections Strategy
    this.strategies.set('least-connections', {
      name: 'least-connections',
      selectInstance: (instances: ServiceInstance[]) => {
        if (instances.length === 0) return null;
        
        return instances.reduce((min, instance) => 
          instance.connections < min.connections ? instance : min
        );
      },
    });

    // Response Time Strategy
    this.strategies.set('response-time', {
      name: 'response-time',
      selectInstance: (instances: ServiceInstance[]) => {
        if (instances.length === 0) return null;
        
        return instances.reduce((fastest, instance) => 
          instance.responseTime < fastest.responseTime ? instance : fastest
        );
      },
    });
  }

  private initializeServices(): void {
    // Backend service instances
    this.registerService('backend', [
      {
        id: 'backend-1',
        service: 'backend',
        url: 'http://backend:3001',
        health: 'unknown',
        lastHealthCheck: new Date(),
        responseTime: 0,
        weight: 100,
        connections: 0,
        metadata: { version: '1.0.0', region: 'us-east-1' },
      },
    ]);

    // Analytics service instances
    this.registerService('analytics', [
      {
        id: 'analytics-1',
        service: 'analytics',
        url: 'http://analytics:3003',
        health: 'unknown',
        lastHealthCheck: new Date(),
        responseTime: 0,
        weight: 100,
        connections: 0,
        metadata: { version: '1.0.0', region: 'us-east-1' },
      },
    ]);

    // Notification service instances
    this.registerService('notification', [
      {
        id: 'notification-1',
        service: 'notification',
        url: 'http://notification:3004',
        health: 'unknown',
        lastHealthCheck: new Date(),
        responseTime: 0,
        weight: 100,
        connections: 0,
        metadata: { version: '1.0.0', region: 'us-east-1' },
      },
    ]);

    this.logger.log(`Initialized ${this.services.size} services`);
  }

  registerService(serviceName: string, instances: ServiceInstance[]): void {
    this.services.set(serviceName, instances);
    this.roundRobinCounters.set(serviceName, 0);
    this.logger.debug(`Registered service ${serviceName} with ${instances.length} instances`);
  }

  addServiceInstance(serviceName: string, instance: ServiceInstance): void {
    const instances = this.services.get(serviceName) || [];
    instances.push(instance);
    this.services.set(serviceName, instances);
    this.logger.debug(`Added instance ${instance.id} to service ${serviceName}`);
  }

  removeServiceInstance(serviceName: string, instanceId: string): void {
    const instances = this.services.get(serviceName) || [];
    const filteredInstances = instances.filter(instance => instance.id !== instanceId);
    this.services.set(serviceName, filteredInstances);
    this.logger.debug(`Removed instance ${instanceId} from service ${serviceName}`);
  }

  async getHealthyInstance(
    serviceName: string,
    strategy: string = 'round-robin'
  ): Promise<ServiceInstance | null> {
    const instances = this.services.get(serviceName) || [];
    const healthyInstances = instances.filter(instance => instance.health === 'healthy');
    
    if (healthyInstances.length === 0) {
      this.logger.warn(`No healthy instances available for service ${serviceName}`);
      return null;
    }

    const loadBalancingStrategy = this.strategies.get(strategy);
    if (!loadBalancingStrategy) {
      this.logger.warn(`Unknown strategy ${strategy}, falling back to round-robin`);
      return this.strategies.get('round-robin')!.selectInstance(healthyInstances);
    }

    const selectedInstance = loadBalancingStrategy.selectInstance(healthyInstances);
    
    if (selectedInstance) {
      // Increment connection count
      selectedInstance.connections++;
      this.logger.debug(`Selected instance ${selectedInstance.id} for service ${serviceName}`);
    }

    return selectedInstance;
  }

  releaseConnection(serviceName: string, instanceId: string): void {
    const instances = this.services.get(serviceName) || [];
    const instance = instances.find(inst => inst.id === instanceId);
    
    if (instance && instance.connections > 0) {
      instance.connections--;
      this.logger.debug(`Released connection for instance ${instanceId}`);
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async performHealthChecks(): Promise<void> {
    this.logger.debug('Performing health checks on all service instances');

    for (const [serviceName, instances] of this.services.entries()) {
      for (const instance of instances) {
        await this.checkInstanceHealth(instance);
      }
    }
  }

  private async checkInstanceHealth(instance: ServiceInstance): Promise<void> {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(`${instance.url}/health`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Nexus-API-Gateway-HealthCheck/1.0',
        },
      });

      const responseTime = Date.now() - startTime;
      
      if (response.status === 200) {
        instance.health = 'healthy';
        instance.responseTime = responseTime;
        instance.lastHealthCheck = new Date();
        
        this.logger.debug(`Health check passed for ${instance.id} (${responseTime}ms)`);
      } else {
        instance.health = 'unhealthy';
        this.logger.warn(`Health check failed for ${instance.id}: HTTP ${response.status}`);
      }
    } catch (error) {
      instance.health = 'unhealthy';
      instance.responseTime = Date.now() - startTime;
      instance.lastHealthCheck = new Date();
      
      this.logger.warn(`Health check failed for ${instance.id}:`, error.message);
    }
  }

  async getServicesHealth(): Promise<{
    service: string;
    totalInstances: number;
    healthyInstances: number;
    unhealthyInstances: number;
    avgResponseTime: number;
  }[]> {
    const result = [];

    for (const [serviceName, instances] of this.services.entries()) {
      const healthyInstances = instances.filter(i => i.health === 'healthy').length;
      const unhealthyInstances = instances.filter(i => i.health === 'unhealthy').length;
      const avgResponseTime = instances.reduce((sum, i) => sum + i.responseTime, 0) / instances.length;

      result.push({
        service: serviceName,
        totalInstances: instances.length,
        healthyInstances,
        unhealthyInstances,
        avgResponseTime: Math.round(avgResponseTime),
      });
    }

    return result;
  }

  async getMetrics(): Promise<{
    totalServices: number;
    totalInstances: number;
    healthyInstances: number;
    strategies: string[];
    requestsPerService: Record<string, number>;
  }> {
    let totalInstances = 0;
    let healthyInstances = 0;
    const requestsPerService: Record<string, number> = {};

    for (const [serviceName, instances] of this.services.entries()) {
      totalInstances += instances.length;
      healthyInstances += instances.filter(i => i.health === 'healthy').length;
      requestsPerService[serviceName] = instances.reduce((sum, i) => sum + i.connections, 0);
    }

    return {
      totalServices: this.services.size,
      totalInstances,
      healthyInstances,
      strategies: Array.from(this.strategies.keys()),
      requestsPerService,
    };
  }

  getServiceInstances(serviceName: string): ServiceInstance[] {
    return this.services.get(serviceName) || [];
  }

  getAllServices(): Map<string, ServiceInstance[]> {
    return new Map(this.services);
  }

  // Circuit breaker functionality
  private circuitBreakers = new Map<string, {
    failures: number;
    lastFailure: Date;
    state: 'closed' | 'open' | 'half-open';
    threshold: number;
    timeout: number;
  }>();

  async executeWithCircuitBreaker<T>(
    serviceName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const breaker = this.circuitBreakers.get(serviceName) || {
      failures: 0,
      lastFailure: new Date(0),
      state: 'closed',
      threshold: 5,
      timeout: 60000, // 1 minute
    };

    // Check if circuit breaker should be reset
    if (breaker.state === 'open' && 
        Date.now() - breaker.lastFailure.getTime() > breaker.timeout) {
      breaker.state = 'half-open';
      this.logger.debug(`Circuit breaker for ${serviceName} moved to half-open state`);
    }

    // Reject if circuit is open
    if (breaker.state === 'open') {
      throw new Error(`Circuit breaker is open for service ${serviceName}`);
    }

    try {
      const result = await operation();
      
      // Reset on success
      if (breaker.state === 'half-open') {
        breaker.state = 'closed';
        breaker.failures = 0;
        this.logger.debug(`Circuit breaker for ${serviceName} reset to closed state`);
      }
      
      this.circuitBreakers.set(serviceName, breaker);
      return result;
    } catch (error) {
      breaker.failures++;
      breaker.lastFailure = new Date();
      
      if (breaker.failures >= breaker.threshold) {
        breaker.state = 'open';
        this.logger.warn(`Circuit breaker opened for service ${serviceName} after ${breaker.failures} failures`);
      }
      
      this.circuitBreakers.set(serviceName, breaker);
      throw error;
    }
  }
}
