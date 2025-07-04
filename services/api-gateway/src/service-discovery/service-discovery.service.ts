import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import Redis from 'redis';

export interface ServiceRegistration {
  id: string;
  name: string;
  version: string;
  url: string;
  health: string;
  metadata: Record<string, any>;
  registeredAt: Date;
  lastSeen: Date;
}

@Injectable()
export class ServiceDiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(ServiceDiscoveryService.name);
  private redis: Redis.RedisClientType;
  private services = new Map<string, ServiceRegistration[]>();
  private readonly SERVICE_TTL = 60; // seconds
  private readonly DISCOVERY_KEY = 'nexus:services';

  async onModuleInit() {
    await this.initializeRedis();
    await this.loadServicesFromRegistry();
  }

  private async initializeRedis(): Promise<void> {
    this.redis = Redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });

    await this.redis.connect();
    this.logger.log('Connected to Redis for service discovery');
  }

  async registerService(registration: Omit<ServiceRegistration, 'registeredAt' | 'lastSeen'>): Promise<void> {
    const serviceRegistration: ServiceRegistration = {
      ...registration,
      registeredAt: new Date(),
      lastSeen: new Date(),
    };

    // Store in Redis with TTL
    const key = `${this.DISCOVERY_KEY}:${registration.name}:${registration.id}`;
    await this.redis.setEx(key, this.SERVICE_TTL, JSON.stringify(serviceRegistration));

    // Update local cache
    const serviceList = this.services.get(registration.name) || [];
    const existingIndex = serviceList.findIndex(s => s.id === registration.id);
    
    if (existingIndex >= 0) {
      serviceList[existingIndex] = serviceRegistration;
    } else {
      serviceList.push(serviceRegistration);
    }
    
    this.services.set(registration.name, serviceList);

    this.logger.debug(`Registered service: ${registration.name}:${registration.id}`);
  }

  async unregisterService(serviceName: string, serviceId: string): Promise<void> {
    // Remove from Redis
    const key = `${this.DISCOVERY_KEY}:${serviceName}:${serviceId}`;
    await this.redis.del(key);

    // Remove from local cache
    const serviceList = this.services.get(serviceName) || [];
    const filteredList = serviceList.filter(s => s.id !== serviceId);
    this.services.set(serviceName, filteredList);

    this.logger.debug(`Unregistered service: ${serviceName}:${serviceId}`);
  }

  async discoverServices(serviceName: string): Promise<ServiceRegistration[]> {
    return this.services.get(serviceName) || [];
  }

  async getAllServices(): Promise<Map<string, ServiceRegistration[]>> {
    return new Map(this.services);
  }

  async checkServiceHealth(serviceName: string): Promise<boolean> {
    const services = await this.discoverServices(serviceName);
    
    if (services.length === 0) {
      return false;
    }

    // Check if at least one instance is healthy
    for (const service of services) {
      try {
        const response = await axios.get(`${service.url}/health`, {
          timeout: 5000,
        });
        
        if (response.status === 200) {
          return true;
        }
      } catch (error) {
        this.logger.debug(`Health check failed for ${service.id}:`, error.message);
      }
    }

    return false;
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async refreshServiceRegistry(): Promise<void> {
    this.logger.debug('Refreshing service registry from Redis');
    await this.loadServicesFromRegistry();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupExpiredServices(): Promise<void> {
    this.logger.debug('Cleaning up expired services');
    
    for (const [serviceName, serviceList] of this.services.entries()) {
      const activeServices = [];
      
      for (const service of serviceList) {
        const key = `${this.DISCOVERY_KEY}:${serviceName}:${service.id}`;
        const exists = await this.redis.exists(key);
        
        if (exists) {
          activeServices.push(service);
        } else {
          this.logger.debug(`Service expired: ${serviceName}:${service.id}`);
        }
      }
      
      this.services.set(serviceName, activeServices);
    }
  }

  private async loadServicesFromRegistry(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.DISCOVERY_KEY}:*`);
      const newServices = new Map<string, ServiceRegistration[]>();

      for (const key of keys) {
        const serviceData = await this.redis.get(key);
        if (serviceData) {
          const service: ServiceRegistration = JSON.parse(serviceData);
          const serviceList = newServices.get(service.name) || [];
          serviceList.push(service);
          newServices.set(service.name, serviceList);
        }
      }

      this.services = newServices;
      this.logger.debug(`Loaded ${keys.length} services from registry`);
    } catch (error) {
      this.logger.error('Failed to load services from registry:', error);
    }
  }

  // Auto-discovery of services by scanning network or configuration
  async autoDiscoverServices(): Promise<void> {
    const knownServices = [
      { name: 'backend', url: 'http://backend:3001', version: '1.0.0' },
      { name: 'analytics', url: 'http://analytics:3003', version: '1.0.0' },
      { name: 'notification', url: 'http://notification:3004', version: '1.0.0' },
    ];

    for (const serviceConfig of knownServices) {
      try {
        const response = await axios.get(`${serviceConfig.url}/health`, {
          timeout: 5000,
        });

        if (response.status === 200) {
          await this.registerService({
            id: `${serviceConfig.name}-auto-discovered`,
            name: serviceConfig.name,
            version: serviceConfig.version,
            url: serviceConfig.url,
            health: 'healthy',
            metadata: {
              discoveryMethod: 'auto',
              lastHealthCheck: new Date(),
            },
          });
        }
      } catch (error) {
        this.logger.debug(`Auto-discovery failed for ${serviceConfig.name}:`, error.message);
      }
    }
  }

  // Service mesh integration
  async getServiceEndpoints(serviceName: string): Promise<{
    http: string[];
    grpc: string[];
    websocket: string[];
  }> {
    const services = await this.discoverServices(serviceName);
    
    return {
      http: services.map(s => s.url),
      grpc: services
        .filter(s => s.metadata.grpcPort)
        .map(s => `${s.url.split(':')[0]}:${s.metadata.grpcPort}`),
      websocket: services
        .filter(s => s.metadata.wsPort)
        .map(s => `ws://${s.url.split('://')[1].split(':')[0]}:${s.metadata.wsPort}`),
    };
  }

  // Service dependency mapping
  async getServiceDependencies(serviceName: string): Promise<{
    dependencies: string[];
    dependents: string[];
  }> {
    const allServices = await this.getAllServices();
    const dependencies: string[] = [];
    const dependents: string[] = [];

    for (const [name, serviceList] of allServices.entries()) {
      for (const service of serviceList) {
        if (service.metadata.dependencies?.includes(serviceName)) {
          dependents.push(name);
        }
        if (name === serviceName && service.metadata.dependencies) {
          dependencies.push(...service.metadata.dependencies);
        }
      }
    }

    return {
      dependencies: [...new Set(dependencies)],
      dependents: [...new Set(dependents)],
    };
  }

  // Service metrics and monitoring
  async getServiceMetrics(): Promise<{
    totalServices: number;
    servicesByStatus: Record<string, number>;
    averageResponseTime: number;
    serviceVersions: Record<string, string[]>;
  }> {
    const allServices = await this.getAllServices();
    let totalServices = 0;
    const servicesByStatus: Record<string, number> = {};
    const serviceVersions: Record<string, string[]> = {};
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const [serviceName, serviceList] of allServices.entries()) {
      totalServices += serviceList.length;
      
      const versions = serviceList.map(s => s.version);
      serviceVersions[serviceName] = [...new Set(versions)];

      for (const service of serviceList) {
        const status = service.health || 'unknown';
        servicesByStatus[status] = (servicesByStatus[status] || 0) + 1;

        if (service.metadata.responseTime) {
          totalResponseTime += service.metadata.responseTime;
          responseTimeCount++;
        }
      }
    }

    return {
      totalServices,
      servicesByStatus,
      averageResponseTime: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0,
      serviceVersions,
    };
  }
}
