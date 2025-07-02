import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

export interface LogContext {
  requestId?: string;
  userId?: string;
  correlationId?: string;
  operation?: string;
  resource?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(private readonly logger: PinoLogger) {}

  /**
   * Log a message with debug level
   */
  debug(message: string, context?: LogContext): void {
    this.logger.debug(this.formatLogEntry(message, context));
  }

  /**
   * Log a message with info level
   */
  log(message: string, context?: LogContext): void {
    this.logger.info(this.formatLogEntry(message, context));
  }

  /**
   * Log a message with info level (alias for log)
   */
  info(message: string, context?: LogContext): void {
    this.log(message, context);
  }

  /**
   * Log a message with warn level
   */
  warn(message: string, context?: LogContext): void {
    this.logger.warn(this.formatLogEntry(message, context));
  }

  /**
   * Log a message with error level
   */
  error(message: string, error?: Error | string, context?: LogContext): void {
    const logEntry = this.formatLogEntry(message, context);
    
    if (error) {
      if (error instanceof Error) {
        logEntry.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause,
        };
      } else {
        logEntry.errorMessage = error;
      }
    }

    this.logger.error(logEntry);
  }

  /**
   * Log a message with fatal level
   */
  fatal(message: string, error?: Error | string, context?: LogContext): void {
    const logEntry = this.formatLogEntry(message, context);
    
    if (error) {
      if (error instanceof Error) {
        logEntry.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause,
        };
      } else {
        logEntry.errorMessage = error;
      }
    }

    this.logger.fatal(logEntry);
  }

  /**
   * Log application startup events
   */
  logStartup(message: string, details?: Record<string, any>): void {
    this.logger.info({
      message,
      event: 'application_startup',
      ...details,
    });
  }

  /**
   * Log application shutdown events
   */
  logShutdown(message: string, details?: Record<string, any>): void {
    this.logger.info({
      message,
      event: 'application_shutdown',
      ...details,
    });
  }

  /**
   * Log database operations
   */
  logDatabase(operation: string, table: string, duration?: number, context?: LogContext): void {
    this.logger.info({
      message: `Database ${operation} on ${table}`,
      event: 'database_operation',
      operation,
      table,
      duration,
      ...this.formatContext(context),
    });
  }

  /**
   * Log authentication events
   */
  logAuth(event: string, userId?: string, details?: Record<string, any>, context?: LogContext): void {
    this.logger.info({
      message: `Authentication event: ${event}`,
      event: 'authentication',
      authEvent: event,
      userId,
      ...details,
      ...this.formatContext(context),
    });
  }

  /**
   * Log API requests with performance metrics
   */
  logApiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext,
  ): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    
    this.logger[level]({
      message: `${method} ${path} ${statusCode}`,
      event: 'api_request',
      method,
      path,
      statusCode,
      duration,
      ...this.formatContext(context),
    });
  }

  /**
   * Log business events
   */
  logBusinessEvent(event: string, details?: Record<string, any>, context?: LogContext): void {
    this.logger.info({
      message: `Business event: ${event}`,
      event: 'business_event',
      businessEvent: event,
      ...details,
      ...this.formatContext(context),
    });
  }

  /**
   * Log security events
   */
  logSecurity(event: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: Record<string, any>, context?: LogContext): void {
    const level = severity === 'critical' ? 'fatal' : severity === 'high' ? 'error' : 'warn';
    
    this.logger[level]({
      message: `Security event: ${event}`,
      event: 'security_event',
      securityEvent: event,
      severity,
      ...details,
      ...this.formatContext(context),
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, duration: number, details?: Record<string, any>, context?: LogContext): void {
    this.logger.info({
      message: `Performance: ${operation} took ${duration}ms`,
      event: 'performance_metric',
      operation,
      duration,
      ...details,
      ...this.formatContext(context),
    });
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): LoggerService {
    const childLogger = this.logger.logger.child(this.formatContext(context));
    const pinoLogger = new PinoLogger(childLogger);
    return new LoggerService(pinoLogger);
  }

  /**
   * Format log entry with consistent structure
   */
  private formatLogEntry(message: string, context?: LogContext): Record<string, any> {
    return {
      message,
      ...this.formatContext(context),
    };
  }

  /**
   * Format context for consistent logging
   */
  private formatContext(context?: LogContext): Record<string, any> {
    if (!context) return {};

    return {
      requestId: context.requestId,
      userId: context.userId,
      correlationId: context.correlationId,
      operation: context.operation,
      resource: context.resource,
      metadata: context.metadata,
    };
  }
}
