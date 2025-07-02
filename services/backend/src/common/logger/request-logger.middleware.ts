import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from './logger.service';

export interface RequestWithLogger extends Request {
  logger: LoggerService;
  startTime: number;
  requestId: string;
}

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: RequestWithLogger, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string || this.generateRequestId();
    
    // Add request ID to headers for downstream services
    req.headers['x-request-id'] = requestId;
    req.requestId = requestId;
    req.startTime = startTime;

    // Create a child logger with request context
    req.logger = this.logger.child({
      requestId,
      operation: `${req.method} ${req.path}`,
    });

    // Log incoming request
    req.logger.info('Incoming request', {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection?.remoteAddress,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
    });

    // Log request body for non-GET requests (excluding sensitive data)
    if (req.method !== 'GET' && req.body) {
      const sanitizedBody = this.sanitizeRequestBody(req.body);
      if (Object.keys(sanitizedBody).length > 0) {
        req.logger.debug('Request body', { body: sanitizedBody });
      }
    }

    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(body: any) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Log response
      req.logger.logApiRequest(req.method, req.path, statusCode, duration, {
        requestId,
        metadata: {
          responseSize: JSON.stringify(body).length,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
        },
      });

      // Log response body in development or for errors
      if (process.env.NODE_ENV === 'development' || statusCode >= 400) {
        const sanitizedResponse = req.logger ? this.sanitizeResponseBody(body) : body;
        req.logger.debug('Response body', { 
          statusCode,
          body: sanitizedResponse,
          duration,
        });
      }

      return originalJson.call(this, body);
    }.bind(res);

    // Handle response finish event
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Log completion
      const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
      req.logger[logLevel]('Request completed', {
        statusCode,
        duration,
        contentLength: res.getHeader('content-length'),
        method: req.method,
        path: req.path,
      });

      // Log slow requests
      if (duration > 1000) {
        req.logger.warn('Slow request detected', {
          duration,
          method: req.method,
          path: req.path,
          statusCode,
        });
      }
    });

    // Handle errors
    res.on('error', (error: Error) => {
      const duration = Date.now() - startTime;
      req.logger.error('Request error', error, {
        duration,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
      });
    });

    next();
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') return {};

    const sensitiveFields = [
      'password',
      'confirmPassword',
      'token',
      'refreshToken',
      'secret',
      'apiKey',
      'authorization',
      'cookie',
    ];

    const sanitized = { ...body };
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private sanitizeResponseBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = [
      'password',
      'token',
      'refreshToken',
      'secret',
      'apiKey',
    ];

    const sanitized = JSON.parse(JSON.stringify(body));
    
    const redactSensitiveData = (obj: any): void => {
      if (typeof obj !== 'object' || obj === null) return;

      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          redactSensitiveData(obj[key]);
        }
      }
    };

    redactSensitiveData(sanitized);
    return sanitized;
  }
}
