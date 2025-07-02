import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SentryService } from './sentry.service';
import { LoggerService } from '../logger/logger.service';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly sentryService: SentryService,
    private readonly logger: LoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = request.headers['x-request-id'] as string;
    const correlationId = request.headers['x-correlation-id'] as string;
    const userId = (request as any).user?.id;
    const userEmail = (request as any).user?.email;
    const userAgent = request.headers['user-agent'];
    const ip = request.ip || request.connection?.remoteAddress;

    let status: number;
    let message: string;
    let errorCode: string;
    let details: any;
    let shouldReportToSentry = true;

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

      // Don't report client errors (4xx) to Sentry unless they're security-related
      if (status >= 400 && status < 500) {
        shouldReportToSentry = status === 401 || status === 403 || status === 429;
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

    // Add error breadcrumb
    this.sentryService.addBreadcrumb(
      `HTTP ${status}: ${message}`,
      'http',
      status >= 500 ? 'error' : 'warning',
      {
        url: request.url,
        method: request.method,
        statusCode: status,
        errorCode,
        requestId,
        correlationId,
      },
    );

    // Report to Sentry if appropriate
    if (shouldReportToSentry && this.sentryService.isReady()) {
      const sentryContext = {
        requestId,
        correlationId,
        operation: `${request.method} ${request.url}`,
        resource: request.url,
        method: request.method,
        url: request.url,
        statusCode: status,
        userAgent,
        ip,
      };

      const sentryUser = userId ? {
        id: userId,
        email: userEmail,
        ip_address: ip,
      } : undefined;

      const sentryTags = {
        service: 'nexus-backend',
        errorType: errorCode,
        httpStatus: status.toString(),
        environment: process.env.NODE_ENV || 'development',
        endpoint: `${request.method} ${request.route?.path || request.url}`,
      };

      if (exception instanceof Error) {
        this.sentryService.captureException(
          exception,
          sentryContext,
          sentryUser,
          sentryTags,
        );
      } else {
        this.sentryService.captureMessage(
          `HTTP ${status}: ${message}`,
          status >= 500 ? 'error' : 'warning',
          sentryContext,
          sentryUser,
          sentryTags,
        );
      }
    }

    // Log the exception using structured logging
    const logLevel = status >= 500 ? 'error' : 'warn';
    this.logger[logLevel](
      `HTTP Exception: ${status} ${message}`,
      exception instanceof Error ? exception : new Error(String(exception)),
      {
        requestId,
        correlationId,
        userId,
        operation: `${request.method} ${request.url}`,
        resource: request.url,
        metadata: {
          statusCode: status,
          errorCode,
          userAgent,
          ip,
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
          userAgent,
          ip,
        },
        {
          requestId,
          correlationId,
          userId,
        },
      );

      // Add security breadcrumb
      this.sentryService.addBreadcrumb(
        `Security: Unauthorized access to ${request.url}`,
        'security',
        'warning',
        {
          statusCode: status,
          path: request.url,
          method: request.method,
          ip,
          userAgent,
        },
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
          userAgent,
          ip,
          suspiciousContent: this.getSuspiciousContent(request),
        },
        {
          requestId,
          correlationId,
          userId,
        },
      );

      // Report potential attack to Sentry
      this.sentryService.captureMessage(
        `Potential attack detected: ${request.method} ${request.url}`,
        'warning',
        {
          requestId,
          correlationId,
          operation: `${request.method} ${request.url}`,
          resource: request.url,
          method: request.method,
          url: request.url,
          statusCode: status,
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
          security: 'potential_attack',
          attackType: 'injection',
          environment: process.env.NODE_ENV || 'development',
        },
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
