import { Controller, Get, Post, Put, Delete, Req, Res, Next, Param, Body } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RoutingService, RouteConfig } from './routing.service';
import { LoadBalancerService } from '../load-balancer/load-balancer.service';
import { RateLimitingService } from '../rate-limiting/rate-limiting.service';

@ApiTags('Gateway Routing')
@Controller()
export class RoutingController {
  constructor(
    private readonly routingService: RoutingService,
    private readonly loadBalancer: LoadBalancerService,
    private readonly rateLimiting: RateLimitingService,
  ) {}

  // Dynamic route handler - handles all proxied requests
  @Get('*')
  @Post('*')
  @Put('*')
  @Delete('*')
  async handleRequest(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ): Promise<void> {
    const startTime = Date.now();
    req['startTime'] = startTime;

    try {
      // Find matching route
      const route = this.routingService.findMatchingRoute(req.path, req.method);
      
      if (!route) {
        return res.status(404).json({
          error: 'Route not found',
          path: req.path,
          method: req.method,
          timestamp: new Date().toISOString(),
        });
      }

      // Apply rate limiting
      const rateLimitResult = await this.rateLimiting.checkRateLimit(
        req.ip,
        route.id,
        route.rateLimit,
      );

      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter,
          limit: route.rateLimit.max,
          windowMs: route.rateLimit.windowMs,
        });
      }

      // Get healthy service instance
      const serviceInstance = await this.loadBalancer.getHealthyInstance(route.service);
      
      if (!serviceInstance) {
        return res.status(503).json({
          error: 'Service unavailable',
          service: route.service,
          message: 'No healthy instances available',
        });
      }

      // Update route target if needed
      if (route.target !== serviceInstance.url) {
        await this.routingService.updateRouteTarget(route.id, serviceInstance.url);
      }

      // Get proxy middleware
      const proxy = this.routingService.getProxy(route.id);
      
      if (!proxy) {
        return res.status(500).json({
          error: 'Internal server error',
          message: 'Proxy not configured',
        });
      }

      // Execute proxy
      proxy(req, res, next);

    } catch (error) {
      console.error('Gateway routing error:', error);
      
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          message: 'Gateway processing failed',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // Admin endpoints for route management
  @Get('/_gateway/routes')
  @ApiOperation({ summary: 'Get all registered routes' })
  @ApiResponse({ status: 200, description: 'Routes retrieved successfully' })
  async getRoutes(): Promise<RouteConfig[]> {
    return this.routingService.getAllRoutes();
  }

  @Get('/_gateway/routes/:routeId')
  @ApiOperation({ summary: 'Get specific route configuration' })
  async getRoute(@Param('routeId') routeId: string): Promise<RouteConfig> {
    const route = this.routingService.getRoute(routeId);
    if (!route) {
      throw new Error(`Route ${routeId} not found`);
    }
    return route;
  }

  @Get('/_gateway/health')
  @ApiOperation({ summary: 'Get gateway and routes health status' })
  async getHealth(): Promise<{
    gateway: string;
    routes: { healthy: string[]; unhealthy: string[]; total: number };
    services: any[];
  }> {
    const routeHealth = await this.routingService.healthCheckRoutes();
    const serviceHealth = await this.loadBalancer.getServicesHealth();

    return {
      gateway: 'healthy',
      routes: routeHealth,
      services: serviceHealth,
    };
  }

  @Get('/_gateway/metrics')
  @ApiOperation({ summary: 'Get routing metrics' })
  async getMetrics(): Promise<{
    routes: any[];
    loadBalancer: any;
    rateLimiting: any;
  }> {
    const routeMetrics = await this.routingService.getRouteMetrics();
    const lbMetrics = await this.loadBalancer.getMetrics();
    const rlMetrics = await this.rateLimiting.getMetrics();

    return {
      routes: routeMetrics,
      loadBalancer: lbMetrics,
      rateLimiting: rlMetrics,
    };
  }

  @Post('/_gateway/routes/:routeId/target')
  @ApiOperation({ summary: 'Update route target' })
  async updateRouteTarget(
    @Param('routeId') routeId: string,
    @Body() body: { target: string },
  ): Promise<{ message: string }> {
    await this.routingService.updateRouteTarget(routeId, body.target);
    return { message: `Route ${routeId} target updated to ${body.target}` };
  }
}
