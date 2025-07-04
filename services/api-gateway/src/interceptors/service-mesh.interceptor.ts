import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class ServiceMeshInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ServiceMeshInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    // Add service mesh headers
    this.addServiceMeshHeaders(request, response);

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        this.logServiceMeshMetrics(request, response, responseTime, 'success');
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        this.logServiceMeshMetrics(request, response, responseTime, 'error', error);
        throw error;
      }),
    );
  }

  private addServiceMeshHeaders(request: Request, response: Response): void {
    const correlationId = request.headers['x-correlation-id'] as string;
    const traceId = request.headers['x-trace-id'] as string || correlationId;
    const spanId = this.generateSpanId();

    // Add distributed tracing headers
    response.setHeader('x-trace-id', traceId);
    response.setHeader('x-span-id', spanId);
    response.setHeader('x-service', 'api-gateway');
    response.setHeader('x-version', process.env.npm_package_version || '1.0.0');

    // Add service mesh metadata
    response.setHeader('x-mesh-node', process.env.HOSTNAME || 'unknown');
    response.setHeader('x-mesh-cluster', process.env.CLUSTER_NAME || 'default');
    response.setHeader('x-mesh-region', process.env.AWS_REGION || 'us-east-1');

    // Security headers
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('x-frame-options', 'DENY');
    response.setHeader('x-xss-protection', '1; mode=block');
  }

  private logServiceMeshMetrics(
    request: Request,
    response: Response,
    responseTime: number,
    status: 'success' | 'error',
    error?: any,
  ): void {
    const metrics = {
      timestamp: new Date().toISOString(),
      correlationId: request.headers['x-correlation-id'],
      traceId: request.headers['x-trace-id'],
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      responseTime,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      status,
      error: error?.message,
      service: 'api-gateway',
      version: process.env.npm_package_version || '1.0.0',
    };

    if (status === 'error') {
      this.logger.error('Service mesh error metrics:', metrics);
    } else {
      this.logger.debug('Service mesh success metrics:', metrics);
    }

    // In a real implementation, you would send these metrics to a monitoring system
    // like Prometheus, DataDog, or New Relic
  }

  private generateSpanId(): string {
    return Math.random().toString(16).substr(2, 16);
  }
}
