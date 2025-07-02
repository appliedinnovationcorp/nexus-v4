import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface RequestWithCorrelation extends Request {
  correlationId: string;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: RequestWithCorrelation, res: Response, next: NextFunction): void {
    // Get correlation ID from header or generate new one
    const correlationId = 
      req.headers['x-correlation-id'] as string ||
      req.headers['x-trace-id'] as string ||
      uuidv4();

    // Set correlation ID on request
    req.correlationId = correlationId;

    // Add correlation ID to response headers
    res.setHeader('x-correlation-id', correlationId);

    // Add to request headers for downstream services
    req.headers['x-correlation-id'] = correlationId;

    next();
  }
}
