import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

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

    const logContext = {
      requestId,
      correlationId,
      userId,
      operation: `${controllerName}.${handlerName}`,
      resource: `${method} ${url}`,
    };

    const startTime = Date.now();

    this.logger.debug(`Executing ${controllerName}.${handlerName}`, {
      ...logContext,
      metadata: {
        controller: controllerName,
        handler: handlerName,
        method,
        url,
        params: request.params,
        query: request.query,
      },
    });

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        this.logger.info(`Completed ${controllerName}.${handlerName}`, {
          ...logContext,
          metadata: {
            statusCode,
            duration,
            responseType: typeof data,
            responseSize: data ? JSON.stringify(data).length : 0,
          },
        });

        // Log performance metrics for slow operations
        if (duration > 500) {
          this.logger.logPerformance(
            `${controllerName}.${handlerName}`,
            duration,
            {
              controller: controllerName,
              handler: handlerName,
              statusCode,
            },
            logContext,
          );
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        this.logger.error(
          `Error in ${controllerName}.${handlerName}`,
          error,
          {
            ...logContext,
            metadata: {
              duration,
              errorType: error.constructor.name,
              statusCode: error.status || 500,
            },
          },
        );

        return throwError(() => error);
      }),
    );
  }
}
