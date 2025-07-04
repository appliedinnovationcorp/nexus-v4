import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const { method, originalUrl, ip, headers } = req;
    const userAgent = headers['user-agent'] || '';
    const correlationId = headers['x-correlation-id'] || 'unknown';

    // Log incoming request
    this.logger.log(`${method} ${originalUrl} - ${ip} - ${userAgent} [${correlationId}]`);

    // Override res.end to capture response details
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const responseTime = Date.now() - startTime;
      const contentLength = res.get('content-length') || 0;
      
      // Log response
      const logLevel = res.statusCode >= 400 ? 'error' : 'log';
      const logger = new Logger('HTTP');
      
      logger[logLevel](
        `${method} ${originalUrl} ${res.statusCode} ${responseTime}ms ${contentLength}b - ${ip} [${correlationId}]`
      );

      // Call original end method
      originalEnd.call(this, chunk, encoding);
    };

    next();
  }
}
