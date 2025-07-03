import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createApplicationMetrics } from './metrics';
import { createStructuredLogger } from './logger';
import { MonitoringConfig } from './types';

// Extended Request interface with monitoring context
interface MonitoredRequest extends Request {
  id: string;
  startTime: number;
  logger: ReturnType<typeof createStructuredLogger>;
  metrics: ReturnType<typeof createApplicationMetrics>;
}

export function monitoringMiddleware(config: MonitoringConfig) {
  const logger = createStructuredLogger(config);
  const metrics = createApplicationMetrics(config);

  return (req: Request, res: Response, next: NextFunction) => {
    const monitoredReq = req as MonitoredRequest;
    
    // Add request ID and start time
    monitoredReq.id = uuidv4();
    monitoredReq.startTime = Date.now();
    monitoredReq.logger = logger;
    monitoredReq.metrics = metrics;

    // Add request ID to response headers
    res.setHeader('X-Request-ID', monitoredReq.id);

    // Log incoming request
    logger.info('Incoming Request', {
      requestId: monitoredReq.id,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      headers: req.headers,
    });

    // Monitor response
    res.on('finish', () => {
      const duration = Date.now() - monitoredReq.startTime;
      const route = req.route?.path || req.path || 'unknown';

      // Record metrics
      metrics.recordHttpRequest(req.method, route, res.statusCode, duration);

      // Log response
      logger.logRequest(req, res, duration);

      // Log slow requests
      if (duration > 1000) {
        logger.warn('Slow Request', {
          requestId: monitoredReq.id,
          method: req.method,
          url: req.url,
          duration,
          statusCode: res.statusCode,
        });
      }

      // Log errors
      if (res.statusCode >= 400) {
        const logLevel = res.statusCode >= 500 ? 'error' : 'warn';
        logger[logLevel]('HTTP Error', {
          requestId: monitoredReq.id,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
        });
      }
    });

    next();
  };
}

// Error handling middleware with monitoring
export function errorMonitoringMiddleware(config: MonitoringConfig) {
  const logger = createStructuredLogger(config);
  const metrics = createApplicationMetrics(config);

  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    const monitoredReq = req as MonitoredRequest;
    
    // Record error metrics
    metrics.recordError(error.name || 'UnknownError', 'high');

    // Log error with context
    logger.logError(error, {
      requestId: monitoredReq.id,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    // Send error response
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        requestId: monitoredReq.id,
        timestamp: new Date().toISOString(),
      });
    }

    next(error);
  };
}

// Rate limiting monitoring middleware
export function rateLimitMonitoringMiddleware(config: MonitoringConfig) {
  const logger = createStructuredLogger(config);
  const metrics = createApplicationMetrics(config);

  return (req: Request, res: Response, next: NextFunction) => {
    const monitoredReq = req as MonitoredRequest;
    
    // Check if rate limit headers are present (from rate limiting middleware)
    const rateLimitRemaining = res.get('X-RateLimit-Remaining');
    const rateLimitLimit = res.get('X-RateLimit-Limit');

    if (rateLimitRemaining && rateLimitLimit) {
      const remaining = parseInt(rateLimitRemaining);
      const limit = parseInt(rateLimitLimit);
      const usage = ((limit - remaining) / limit) * 100;

      // Record rate limit metrics
      metrics.setGauge('rate_limit_usage_percent', usage, {
        endpoint: req.path,
        method: req.method,
      });

      // Log high rate limit usage
      if (usage > 80) {
        logger.warn('High Rate Limit Usage', {
          requestId: monitoredReq.id,
          endpoint: req.path,
          method: req.method,
          usage: `${usage.toFixed(2)}%`,
          remaining,
          limit,
        });
      }
    }

    next();
  };
}

// Security monitoring middleware
export function securityMonitoringMiddleware(config: MonitoringConfig) {
  const logger = createStructuredLogger(config);
  const metrics = createApplicationMetrics(config);

  return (req: Request, res: Response, next: NextFunction) => {
    const monitoredReq = req as MonitoredRequest;
    
    // Monitor for suspicious patterns
    const suspiciousPatterns = [
      /\.\.\//,  // Path traversal
      /<script/i,  // XSS attempts
      /union.*select/i,  // SQL injection
      /javascript:/i,  // JavaScript injection
    ];

    const url = req.url.toLowerCase();
    const body = JSON.stringify(req.body || {}).toLowerCase();
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url) || pattern.test(body)) {
        logger.logSecurityEvent('Suspicious Request Pattern', 'medium', {
          requestId: monitoredReq.id,
          pattern: pattern.toString(),
          url: req.url,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });

        metrics.incrementCounter('security_events_total', {
          type: 'suspicious_pattern',
          severity: 'medium',
        });
        break;
      }
    }

    // Monitor for brute force attempts (multiple failed auth attempts)
    if (req.path.includes('/auth') && req.method === 'POST') {
      res.on('finish', () => {
        if (res.statusCode === 401) {
          logger.logSecurityEvent('Failed Authentication Attempt', 'low', {
            requestId: monitoredReq.id,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            endpoint: req.path,
          });

          metrics.incrementCounter('security_events_total', {
            type: 'failed_auth',
            severity: 'low',
          });
        }
      });
    }

    next();
  };
}

// Database operation monitoring middleware
export function databaseMonitoringMiddleware(config: MonitoringConfig) {
  const logger = createStructuredLogger(config);
  const metrics = createApplicationMetrics(config);

  return {
    // Wrap database query functions
    wrapQuery: <T extends (...args: any[]) => Promise<any>>(
      queryFunction: T,
      operation: string,
      table: string
    ): T => {
      return (async (...args: any[]) => {
        const startTime = Date.now();
        let success = true;
        
        try {
          const result = await queryFunction(...args);
          return result;
        } catch (error) {
          success = false;
          logger.logError(error as Error, {
            operation,
            table,
            query: args[0], // Assuming first arg is the query
          });
          throw error;
        } finally {
          const duration = Date.now() - startTime;
          
          // Record metrics
          metrics.recordDatabaseQuery(operation, table, duration, success);
          
          // Log slow queries
          if (duration > 1000) {
            logger.warn('Slow Database Query', {
              operation,
              table,
              duration,
              success,
            });
          }
        }
      }) as T;
    },
  };
}

// Business logic monitoring middleware
export function businessMonitoringMiddleware(config: MonitoringConfig) {
  const logger = createStructuredLogger(config);
  const metrics = createApplicationMetrics(config);

  return {
    // Track user actions
    trackUserAction: (action: string, userId?: string, metadata?: any) => {
      logger.logBusinessEvent('User Action', {
        action,
        userId,
        metadata,
      });

      metrics.recordUserAction(action, userId);
    },

    // Track business transactions
    trackTransaction: (type: string, amount: number, currency: string = 'USD', metadata?: any) => {
      logger.logBusinessEvent('Transaction', {
        type,
        amount,
        currency,
        metadata,
      });

      if (type === 'revenue') {
        metrics.recordRevenue(amount, currency);
      }
    },

    // Track feature usage
    trackFeatureUsage: (feature: string, userId?: string, metadata?: any) => {
      logger.logBusinessEvent('Feature Usage', {
        feature,
        userId,
        metadata,
      });

      metrics.incrementCounter('feature_usage_total', {
        feature,
        user_type: userId ? 'authenticated' : 'anonymous',
      });
    },
  };
}

// Performance monitoring middleware
export function performanceMonitoringMiddleware(config: MonitoringConfig) {
  const logger = createStructuredLogger(config);
  const metrics = createApplicationMetrics(config);

  return {
    // Time function execution
    timeFunction: async <T>(
      name: string,
      fn: () => Promise<T>,
      context?: any
    ): Promise<T> => {
      const startTime = Date.now();
      
      try {
        const result = await fn();
        const duration = Date.now() - startTime;
        
        logger.logPerformance(name, duration, context);
        metrics.recordTimer(name, startTime);
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.logError(error as Error, { operation: name, duration, ...context });
        throw error;
      }
    },

    // Create performance timer
    createTimer: (name: string, context?: any) => {
      const startTime = Date.now();
      
      return {
        end: () => {
          const duration = Date.now() - startTime;
          logger.logPerformance(name, duration, context);
          metrics.recordTimer(name, startTime);
          return duration;
        },
      };
    },
  };
}
