import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { SentryService } from './sentry.service';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  constructor(private readonly sentryService: SentryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const handler = context.getHandler();
    const controller = context.getClass();
    
    const controllerName = controller.name;
    const handlerName = handler.name;
    const method = request.method;
    const url = request.url;
    const requestId = request.requestId || request.headers['x-request-id'];
    const correlationId = request.correlationId || request.headers['x-correlation-id'];
    const userId = request.user?.id;
    const userEmail = request.user?.email;
    const userAgent = request.headers['user-agent'];
    const ip = request.ip || request.connection?.remoteAddress;

    const startTime = Date.now();

    // Set user context for this request
    if (userId) {
      this.sentryService.setUser({
        id: userId,
        email: userEmail,
        ip_address: ip,
      });
    }

    // Add breadcrumb for the request
    this.sentryService.addBreadcrumb(
      `${method} ${url}`,
      'http',
      'info',
      {
        controller: controllerName,
        handler: handlerName,
        method,
        url,
        requestId,
        correlationId,
        userId,
      },
    );

    // Start performance transaction
    const transaction = this.sentryService.startTransaction(
      `${controllerName}.${handlerName}`,
      'http.server',
      `${method} ${url}`,
    );

    if (transaction) {
      transaction.setData('controller', controllerName);
      transaction.setData('handler', handlerName);
      transaction.setData('method', method);
      transaction.setData('url', url);
      transaction.setData('requestId', requestId);
      transaction.setData('correlationId', correlationId);
      transaction.setData('userId', userId);
    }

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Add success breadcrumb
        this.sentryService.addBreadcrumb(
          `${method} ${url} - ${statusCode}`,
          'http',
          'info',
          {
            statusCode,
            duration,
            responseSize: data ? JSON.stringify(data).length : 0,
          },
        );

        // Finish transaction
        if (transaction) {
          transaction.setHttpStatus(statusCode);
          transaction.setData('duration', duration);
          transaction.setData('statusCode', statusCode);
          transaction.finish();
        }

        // Log slow requests as performance issues
        if (duration > 5000) {
          this.sentryService.captureMessage(
            `Slow request detected: ${method} ${url}`,
            'warning',
            {
              requestId,
              correlationId,
              operation: `${controllerName}.${handlerName}`,
              resource: `${method} ${url}`,
              duration,
              statusCode,
              method,
              url,
              userAgent,
              ip,
            },
            userId ? {
              id: userId,
              email: userEmail,
              ip_address: ip,
            } : undefined,
            {
              service: 'nexus-backend',
              component: controllerName,
              feature: handlerName,
              performance: 'slow',
            },
          );
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Add error breadcrumb
        this.sentryService.addBreadcrumb(
          `${method} ${url} - Error: ${error.message}`,
          'http',
          'error',
          {
            error: error.name,
            message: error.message,
            statusCode,
            duration,
          },
        );

        // Finish transaction with error
        if (transaction) {
          transaction.setHttpStatus(statusCode);
          transaction.setData('duration', duration);
          transaction.setData('statusCode', statusCode);
          transaction.setData('error', error.name);
          transaction.finish();
        }

        // Capture exception in Sentry
        this.sentryService.captureException(
          error,
          {
            requestId,
            correlationId,
            operation: `${controllerName}.${handlerName}`,
            resource: `${method} ${url}`,
            duration,
            statusCode,
            method,
            url,
            userAgent,
            ip,
          },
          userId ? {
            id: userId,
            email: userEmail,
            ip_address: ip,
          } : undefined,
          {
            service: 'nexus-backend',
            component: controllerName,
            feature: handlerName,
            errorType: error.name,
            environment: process.env.NODE_ENV || 'development',
          },
        );

        return throwError(() => error);
      }),
    );
  }
}
