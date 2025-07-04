import { Injectable, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { LoadBalancerService } from '../load-balancer/load-balancer.service';
import { ServiceDiscoveryService } from '../service-discovery/service-discovery.service';

export interface RouteConfig {
  id: string;
  path: string;
  method: string;
  target: string;
  service: string;
  version: string;
  timeout: number;
  retries: number;
  circuitBreaker: boolean;
  rateLimit: {
    windowMs: number;
    max: number;
  };
  auth: {
    required: boolean;
    roles?: string[];
    scopes?: string[];
  };
  cache: {
    enabled: boolean;
    ttl: number;
  };
  transform: {
    request?: (body: any) => any;
    response?: (body: any) => any;
  };
}

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private routes = new Map<string, RouteConfig>();
  private proxies = new Map<string, any>();

  constructor(
    private readonly loadBalancer: LoadBalancerService,
    private readonly serviceDiscovery: ServiceDiscoveryService,
  ) {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Backend service routes
    this.registerRoute({
      id: 'backend-auth',
      path: '/api/auth/*',
      method: 'ALL',
      target: 'http://backend:3001',
      service: 'backend',
      version: '1.0',
      timeout: 30000,
      retries: 3,
      circuitBreaker: true,
      rateLimit: { windowMs: 60000, max: 100 },
      auth: { required: false },
      cache: { enabled: false, ttl: 0 },
      transform: {},
    });

    this.registerRoute({
      id: 'backend-users',
      path: '/api/users/*',
      method: 'ALL',
      target: 'http://backend:3001',
      service: 'backend',
      version: '1.0',
      timeout: 30000,
      retries: 3,
      circuitBreaker: true,
      rateLimit: { windowMs: 60000, max: 200 },
      auth: { required: true, roles: ['user', 'admin'] },
      cache: { enabled: true, ttl: 300 },
      transform: {},
    });

    // Analytics service routes
    this.registerRoute({
      id: 'analytics-ingest',
      path: '/api/analytics/ingest/*',
      method: 'POST',
      target: 'http://analytics:3003',
      service: 'analytics',
      version: '1.0',
      timeout: 10000,
      retries: 2,
      circuitBreaker: true,
      rateLimit: { windowMs: 60000, max: 1000 },
      auth: { required: true },
      cache: { enabled: false, ttl: 0 },
      transform: {},
    });

    this.registerRoute({
      id: 'analytics-dashboard',
      path: '/api/analytics/dashboard/*',
      method: 'GET',
      target: 'http://analytics:3003',
      service: 'analytics',
      version: '1.0',
      timeout: 15000,
      retries: 3,
      circuitBreaker: true,
      rateLimit: { windowMs: 60000, max: 500 },
      auth: { required: true, roles: ['user', 'admin'] },
      cache: { enabled: true, ttl: 60 },
      transform: {},
    });

    // Notification service routes
    this.registerRoute({
      id: 'notifications-send',
      path: '/api/notifications/*',
      method: 'ALL',
      target: 'http://notification:3004',
      service: 'notification',
      version: '1.0',
      timeout: 30000,
      retries: 3,
      circuitBreaker: true,
      rateLimit: { windowMs: 60000, max: 100 },
      auth: { required: true },
      cache: { enabled: false, ttl: 0 },
      transform: {},
    });

    this.logger.log(`Initialized ${this.routes.size} routes`);
  }

  registerRoute(config: RouteConfig): void {
    this.routes.set(config.id, config);
    
    // Create proxy middleware
    const proxyOptions: Options = {
      target: config.target,
      changeOrigin: true,
      timeout: config.timeout,
      pathRewrite: (path: string) => {
        // Remove /api prefix for backend services
        return path.replace(/^\/api/, '');
      },
      onProxyReq: (proxyReq, req: Request) => {
        // Add correlation ID
        const correlationId = req.headers['x-correlation-id'] || this.generateCorrelationId();
        proxyReq.setHeader('x-correlation-id', correlationId);
        
        // Add service metadata
        proxyReq.setHeader('x-gateway-service', config.service);
        proxyReq.setHeader('x-gateway-version', config.version);
        proxyReq.setHeader('x-gateway-route', config.id);
        
        this.logger.debug(`Proxying ${req.method} ${req.path} to ${config.target}`);
      },
      onProxyRes: (proxyRes, req: Request, res: Response) => {
        // Add response headers
        res.setHeader('x-gateway-service', config.service);
        res.setHeader('x-response-time', Date.now() - req['startTime']);
        
        this.logger.debug(`Response from ${config.service}: ${proxyRes.statusCode}`);
      },
      onError: (err, req: Request, res: Response) => {
        this.logger.error(`Proxy error for ${config.service}:`, err.message);
        
        if (!res.headersSent) {
          res.status(502).json({
            error: 'Bad Gateway',
            message: 'Service temporarily unavailable',
            service: config.service,
            timestamp: new Date().toISOString(),
          });
        }
      },
    };

    const proxy = createProxyMiddleware(proxyOptions);
    this.proxies.set(config.id, proxy);
    
    this.logger.debug(`Registered route: ${config.method} ${config.path} -> ${config.target}`);
  }

  getRoute(routeId: string): RouteConfig | undefined {
    return this.routes.get(routeId);
  }

  getAllRoutes(): RouteConfig[] {
    return Array.from(this.routes.values());
  }

  findMatchingRoute(path: string, method: string): RouteConfig | undefined {
    for (const route of this.routes.values()) {
      if (this.matchesRoute(path, method, route)) {
        return route;
      }
    }
    return undefined;
  }

  getProxy(routeId: string): any {
    return this.proxies.get(routeId);
  }

  async updateRouteTarget(routeId: string, newTarget: string): Promise<void> {
    const route = this.routes.get(routeId);
    if (!route) {
      throw new Error(`Route ${routeId} not found`);
    }

    // Update route configuration
    route.target = newTarget;
    this.routes.set(routeId, route);

    // Recreate proxy with new target
    this.registerRoute(route);
    
    this.logger.log(`Updated route ${routeId} target to ${newTarget}`);
  }

  async healthCheckRoutes(): Promise<{
    healthy: string[];
    unhealthy: string[];
    total: number;
  }> {
    const healthy: string[] = [];
    const unhealthy: string[] = [];

    for (const route of this.routes.values()) {
      try {
        const isHealthy = await this.serviceDiscovery.checkServiceHealth(route.service);
        if (isHealthy) {
          healthy.push(route.id);
        } else {
          unhealthy.push(route.id);
        }
      } catch (error) {
        unhealthy.push(route.id);
        this.logger.warn(`Health check failed for route ${route.id}:`, error.message);
      }
    }

    return {
      healthy,
      unhealthy,
      total: this.routes.size,
    };
  }

  private matchesRoute(path: string, method: string, route: RouteConfig): boolean {
    // Convert route path pattern to regex
    const routePattern = route.path
      .replace(/\*/g, '.*')
      .replace(/\//g, '\\/');
    
    const regex = new RegExp(`^${routePattern}$`);
    
    const pathMatches = regex.test(path);
    const methodMatches = route.method === 'ALL' || route.method === method.toUpperCase();
    
    return pathMatches && methodMatches;
  }

  private generateCorrelationId(): string {
    return `gw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Route metrics
  async getRouteMetrics(): Promise<{
    routeId: string;
    requests: number;
    errors: number;
    avgResponseTime: number;
    lastUsed: Date;
  }[]> {
    // In a real implementation, this would fetch from a metrics store
    return Array.from(this.routes.values()).map(route => ({
      routeId: route.id,
      requests: Math.floor(Math.random() * 1000),
      errors: Math.floor(Math.random() * 50),
      avgResponseTime: Math.floor(Math.random() * 500) + 100,
      lastUsed: new Date(),
    }));
  }
}
