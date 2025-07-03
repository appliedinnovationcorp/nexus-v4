import winston from 'winston';
import CloudWatchTransport from 'winston-cloudwatch';
import { MonitoringConfig, Logger, LogContext } from './types';

export function createLogger(config: MonitoringConfig): Logger {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            message,
            service: config.serviceName,
            environment: config.environment,
            version: config.version,
            ...meta,
          });
        })
      ),
    }),
  ];

  // Add CloudWatch transport if enabled
  if (config.enableCloudWatch && config.cloudWatchLogGroup && config.cloudWatchRegion) {
    transports.push(
      new CloudWatchTransport({
        logGroupName: config.cloudWatchLogGroup,
        logStreamName: `${config.serviceName}-${new Date().toISOString().split('T')[0]}`,
        awsRegion: config.cloudWatchRegion,
        messageFormatter: ({ level, message, ...meta }) => {
          return JSON.stringify({
            level,
            message,
            service: config.serviceName,
            environment: config.environment,
            version: config.version,
            ...meta,
          });
        },
      })
    );
  }

  const winstonLogger = winston.createLogger({
    level: config.logLevel || 'info',
    transports,
    defaultMeta: {
      service: config.serviceName,
      environment: config.environment,
      version: config.version,
    },
  });

  return {
    error: (message: string, context?: LogContext) => {
      winstonLogger.error(message, context);
    },
    warn: (message: string, context?: LogContext) => {
      winstonLogger.warn(message, context);
    },
    info: (message: string, context?: LogContext) => {
      winstonLogger.info(message, context);
    },
    debug: (message: string, context?: LogContext) => {
      winstonLogger.debug(message, context);
    },
  };
}

// Structured logging helpers
export const logLevels = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
} as const;

export function createStructuredLogger(config: MonitoringConfig) {
  const logger = createLogger(config);

  return {
    ...logger,
    
    // HTTP request logging
    logRequest: (req: any, res: any, duration: number) => {
      logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        requestId: req.id,
      });
    },

    // Database operation logging
    logDatabaseOperation: (operation: string, table: string, duration: number, success: boolean) => {
      logger.info('Database Operation', {
        operation,
        table,
        duration,
        success,
      });
    },

    // Error logging with stack trace
    logError: (error: Error, context?: LogContext) => {
      logger.error('Application Error', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...context,
      });
    },

    // Business logic logging
    logBusinessEvent: (event: string, data?: any, context?: LogContext) => {
      logger.info('Business Event', {
        event,
        data,
        ...context,
      });
    },

    // Security event logging
    logSecurityEvent: (event: string, severity: 'low' | 'medium' | 'high' | 'critical', context?: LogContext) => {
      logger.warn('Security Event', {
        event,
        severity,
        ...context,
      });
    },

    // Performance logging
    logPerformance: (operation: string, duration: number, context?: LogContext) => {
      const level = duration > 1000 ? 'warn' : 'info';
      logger[level]('Performance Metric', {
        operation,
        duration,
        ...context,
      });
    },
  };
}
