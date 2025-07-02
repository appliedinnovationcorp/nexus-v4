import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = request.headers['x-request-id'] as string;
    const correlationId = request.headers['x-correlation-id'] as string;
    const userId = (request as any).user?.id;

    const logContext = {
      requestId,
      correlationId,
      userId,
      operation: `${request.method} ${request.url}`,
      resource: request.url,
    };

    let status: number;
    let message: string;
    let errorCode: string;
    let details: any;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        errorCode = (exceptionResponse as any).error || exception.name;
        details = (exceptionResponse as any).details;
      } else {
        message = exceptionResponse as string;
        errorCode = exception.name;
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message || 'Internal server error';
      errorCode = exception.name;
      details = {
        stack: exception.stack,
      };
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Unknown error occurred';
      errorCode = 'UnknownError';
      details = { exception: String(exception) };
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error: errorCode,
      requestId,
      correlationId,
      ...(process.env.NODE_ENV === 'development' && details && { details }),
    };

    // Log the exception
    const logLevel = status >= 500 ? 'error' : 'warn';
    this.logger[logLevel](
      `HTTP Exception: ${status} ${message}`,
      exception instanceof Error ? exception : new Error(String(exception)),
      {
        ...logContext,
        metadata: {
          statusCode: status,
          errorCode,
          userAgent: request.headers['user-agent'],
          ip: request.ip,
          body: this.sanitizeBody(request.body),
          query: request.query,
          params: request.params,
        },
      },
    );

    // Log security events for certain error types
    if (status === 401 || status === 403) {
      this.logger.logSecurity(
        'Unauthorized access attempt',
        'medium',
        {
          statusCode: status,
          path: request.url,
          method: request.method,
          userAgent: request.headers['user-agent'],
          ip: request.ip,
        },
        logContext,
      );
    }

    // Log potential attacks
    if (status === 400 && this.isPotentialAttack(request)) {
      this.logger.logSecurity(
        'Potential attack detected',
        'high',
        {
          statusCode: status,
          path: request.url,
          method: request.method,
          userAgent: request.headers['user-agent'],
          ip: request.ip,
          suspiciousContent: this.getSuspiciousContent(request),
        },
        logContext,
      );
    }

    response.status(status).json(errorResponse);
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = [
      'password',
      'confirmPassword',
      'token',
      'refreshToken',
      'secret',
      'apiKey',
    ];

    const sanitized = { ...body };
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private isPotentialAttack(request: Request): boolean {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /union\s+select/i,
      /drop\s+table/i,
      /insert\s+into/i,
      /delete\s+from/i,
      /update\s+set/i,
      /exec\s*\(/i,
      /eval\s*\(/i,
    ];

    const checkString = (str: string): boolean => {
      return suspiciousPatterns.some(pattern => pattern.test(str));
    };

    // Check URL
    if (checkString(request.url)) return true;

    // Check query parameters
    for (const value of Object.values(request.query)) {
      if (typeof value === 'string' && checkString(value)) return true;
    }

    // Check body
    if (request.body && typeof request.body === 'object') {
      const bodyStr = JSON.stringify(request.body);
      if (checkString(bodyStr)) return true;
    }

    return false;
  }

  private getSuspiciousContent(request: Request): any {
    const suspicious: any = {};

    // Check URL
    if (request.url.length > 1000) {
      suspicious.longUrl = true;
    }

    // Check for suspicious query parameters
    const queryStr = JSON.stringify(request.query);
    if (queryStr.length > 5000) {
      suspicious.largeQuery = true;
    }

    // Check for suspicious body content
    if (request.body) {
      const bodyStr = JSON.stringify(request.body);
      if (bodyStr.length > 10000) {
        suspicious.largeBody = true;
      }
    }

    return suspicious;
  }
}
