import { Injectable } from '@nestjs/common';
import { HealthCheckService, HttpHealthIndicator, HealthCheck } from '@nestjs/terminus';
import { LoadBalancerService } from '../load-balancer/load-balancer.service';
import { ServiceDiscoveryService } from '../service-discovery/service-discovery.service';

@Injectable()
export class HealthService {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private loadBalancer: LoadBalancerService,
    private serviceDiscovery: ServiceDiscoveryService,
  ) {}

  @HealthCheck()
  async checkHealth() {
    return this.health.check([
      () => this.http.pingCheck('backend', 'http://backend:3001/health'),
      () => this.http.pingCheck('analytics', 'http://analytics:3003/health'),
      () => this.http.pingCheck('notification', 'http://notification:3004/health'),
      () => this.checkLoadBalancer(),
      () => this.checkServiceDiscovery(),
    ]);
  }

  private async checkLoadBalancer() {
    try {
      const metrics = await this.loadBalancer.getMetrics();
      const isHealthy = metrics.healthyInstances > 0;
      
      return {
        loadBalancer: {
          status: isHealthy ? 'up' : 'down',
          totalServices: metrics.totalServices,
          healthyInstances: metrics.healthyInstances,
          totalInstances: metrics.totalInstances,
        },
      };
    } catch (error) {
      return {
        loadBalancer: {
          status: 'down',
          error: error.message,
        },
      };
    }
  }

  private async checkServiceDiscovery() {
    try {
      const metrics = await this.serviceDiscovery.getServiceMetrics();
      const isHealthy = metrics.totalServices > 0;
      
      return {
        serviceDiscovery: {
          status: isHealthy ? 'up' : 'down',
          totalServices: metrics.totalServices,
          servicesByStatus: metrics.servicesByStatus,
        },
      };
    } catch (error) {
      return {
        serviceDiscovery: {
          status: 'down',
          error: error.message,
        },
      };
    }
  }
}
