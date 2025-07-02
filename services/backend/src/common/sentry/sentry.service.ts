import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { LoggerService } from '../logger/logger.service';

export interface SentryUser {
  id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
}

export interface SentryContext {
  requestId?: string;
  correlationId?: string;
  operation?: string;
  resource?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
}

export interface SentryTags {
  environment?: string;
  service?: string;
  version?: string;
  feature?: string;
  component?: string;
  [key: string]: string | undefined;
}

@Injectable()
export class SentryService implements OnModuleInit {
  private isInitialized = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger?: LoggerService,
  ) {}

  onModuleInit() {
    this.initializeSentry();
  }

  private initializeSentry(): void {
    const dsn = this.configService.get<string>('SENTRY_DSN');
    const environment = this.configService.get<string>('NODE_ENV', 'development');
    const release = this.configService.get<string>('SENTRY_RELEASE') || 
                   this.configService.get<string>('npm_package_version') || 
                   '1.0.0';
    const serverName = this.configService.get<string>('HOSTNAME') || 'nexus-backend';

    if (!dsn) {
      this.logger?.warn('Sentry DSN not configured, error tracking disabled', {
        operation: 'sentry.initialize',
      });
      return;
    }

    try {
      Sentry.init({
        dsn,
        environment,
        release: `nexus-backend@${release}`,
        serverName,
        
        // Performance monitoring
        tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
        profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
        
        // Integrations
        integrations: [
          // Node.js integrations
          Sentry.httpIntegration(),
          Sentry.expressIntegration(),
          Sentry.graphqlIntegration(),
          Sentry.mongoIntegration(),
          Sentry.postgresIntegration(),
          Sentry.redisIntegration(),
          
          // Profiling integration
          nodeProfilingIntegration(),
          
          // Custom integrations
          Sentry.requestDataIntegration({
            include: {
              request: ['method', 'url', 'headers', 'query_string'],
              user: ['id', 'email', 'username'],
            },
          }),
        ],

        // Error filtering
        beforeSend: (event, hint) => {
          return this.beforeSend(event, hint);
        },

        // Breadcrumb filtering
        beforeBreadcrumb: (breadcrumb) => {
          return this.beforeBreadcrumb(breadcrumb);
        },

        // Initial scope configuration
        initialScope: {
          tags: {
            service: 'nexus-backend',
            version: release,
            environment,
          },
        },

        // Debug mode for development
        debug: environment === 'development',
        
        // Sample rate for error events
        sampleRate: 1.0,
        
        // Maximum breadcrumbs
        maxBreadcrumbs: 50,
        
        // Attach stack trace to messages
        attachStacktrace: true,
        
        // Send default PII
        sendDefaultPii: false,
        
        // Auto session tracking
        autoSessionTracking: true,
        
        // Capture unhandled rejections
        captureUnhandledRejections: true,
        
        // Capture uncaught exceptions
        captureUncaughtException: true,
      });

      this.isInitialized = true;
      
      this.logger?.info('Sentry initialized successfully', {
        operation: 'sentry.initialize',
        metadata: {
          environment,
          release,
          serverName,
          dsn: dsn.substring(0, 20) + '...',
        },
      });

      // Set initial context
      this.setContext('application', {
        name: 'nexus-backend',
        version: release,
        environment,
        startTime: new Date().toISOString(),
      });

    } catch (error) {
      this.logger?.error('Failed to initialize Sentry', error, {
        operation: 'sentry.initialize',
      });
    }
  }

  /**
   * Capture an exception with context
   */
  captureException(
    error: Error,
    context?: SentryContext,
    user?: SentryUser,
    tags?: SentryTags,
  ): string | undefined {
    if (!this.isInitialized) return undefined;

    return Sentry.withScope((scope) => {
      // Set user context
      if (user) {
        scope.setUser(user);
      }

      // Set tags
      if (tags) {
        Object.entries(tags).forEach(([key, value]) => {
          if (value !== undefined) {
            scope.setTag(key, value);
          }
        });
      }

      // Set context
      if (context) {
        scope.setContext('request', {
          requestId: context.requestId,
          correlationId: context.correlationId,
          operation: context.operation,
          resource: context.resource,
          method: context.method,
          url: context.url,
          statusCode: context.statusCode,
          duration: context.duration,
          userAgent: context.userAgent,
          ip: context.ip,
        });
      }

      // Set level based on error type
      if (error.name === 'ValidationError') {
        scope.setLevel('warning');
      } else if (error.name === 'UnauthorizedError') {
        scope.setLevel('warning');
      } else {
        scope.setLevel('error');
      }

      return Sentry.captureException(error);
    });
  }

  /**
   * Capture a message with context
   */
  captureMessage(
    message: string,
    level: Sentry.SeverityLevel = 'info',
    context?: SentryContext,
    user?: SentryUser,
    tags?: SentryTags,
  ): string | undefined {
    if (!this.isInitialized) return undefined;

    return Sentry.withScope((scope) => {
      scope.setLevel(level);

      // Set user context
      if (user) {
        scope.setUser(user);
      }

      // Set tags
      if (tags) {
        Object.entries(tags).forEach(([key, value]) => {
          if (value !== undefined) {
            scope.setTag(key, value);
          }
        });
      }

      // Set context
      if (context) {
        scope.setContext('request', context);
      }

      return Sentry.captureMessage(message, level);
    });
  }

  /**
   * Add breadcrumb for tracking user actions
   */
  addBreadcrumb(
    message: string,
    category: string = 'custom',
    level: Sentry.SeverityLevel = 'info',
    data?: Record<string, any>,
  ): void {
    if (!this.isInitialized) return;

    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  }

  /**
   * Set user context
   */
  setUser(user: SentryUser): void {
    if (!this.isInitialized) return;

    Sentry.setUser(user);
  }

  /**
   * Set tags
   */
  setTags(tags: SentryTags): void {
    if (!this.isInitialized) return;

    Object.entries(tags).forEach(([key, value]) => {
      if (value !== undefined) {
        Sentry.setTag(key, value);
      }
    });
  }

  /**
   * Set context
   */
  setContext(key: string, context: Record<string, any>): void {
    if (!this.isInitialized) return;

    Sentry.setContext(key, context);
  }

  /**
   * Start a transaction for performance monitoring
   */
  startTransaction(
    name: string,
    operation: string,
    description?: string,
  ): Sentry.Transaction | undefined {
    if (!this.isInitialized) return undefined;

    return Sentry.startTransaction({
      name,
      op: operation,
      description,
    });
  }

  /**
   * Capture performance timing
   */
  capturePerformance(
    name: string,
    operation: string,
    duration: number,
    context?: SentryContext,
  ): void {
    if (!this.isInitialized) return;

    const transaction = this.startTransaction(name, operation);
    if (transaction) {
      transaction.setData('duration', duration);
      if (context) {
        transaction.setData('context', context);
      }
      transaction.finish();
    }
  }

  /**
   * Flush pending events
   */
  async flush(timeout: number = 2000): Promise<boolean> {
    if (!this.isInitialized) return true;

    return Sentry.flush(timeout);
  }

  /**
   * Close Sentry client
   */
  async close(timeout: number = 2000): Promise<boolean> {
    if (!this.isInitialized) return true;

    return Sentry.close(timeout);
  }

  /**
   * Get current hub
   */
  getCurrentHub(): Sentry.Hub {
    return Sentry.getCurrentHub();
  }

  /**
   * Check if Sentry is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Filter events before sending to Sentry
   */
  private beforeSend(
    event: Sentry.Event,
    hint: Sentry.EventHint,
  ): Sentry.Event | null {
    // Don't send events in test environment
    if (process.env.NODE_ENV === 'test') {
      return null;
    }

    // Filter out health check errors
    if (event.request?.url?.includes('/health')) {
      return null;
    }

    // Filter out validation errors in development
    if (
      process.env.NODE_ENV === 'development' &&
      hint.originalException?.name === 'ValidationError'
    ) {
      return null;
    }

    // Sanitize sensitive data
    if (event.request?.data) {
      event.request.data = this.sanitizeData(event.request.data);
    }

    if (event.extra) {
      event.extra = this.sanitizeData(event.extra);
    }

    return event;
  }

  /**
   * Filter breadcrumbs before adding to Sentry
   */
  private beforeBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
    // Filter out noisy breadcrumbs
    if (breadcrumb.category === 'http' && breadcrumb.data?.url?.includes('/health')) {
      return null;
    }

    // Sanitize breadcrumb data
    if (breadcrumb.data) {
      breadcrumb.data = this.sanitizeData(breadcrumb.data);
    }

    return breadcrumb;
  }

  /**
   * Sanitize sensitive data from objects
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'cookie',
      'session',
      'csrf',
      'api_key',
      'apiKey',
      'access_token',
      'refresh_token',
      'private_key',
      'credit_card',
      'ssn',
      'social_security',
    ];

    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    const sanitizeRecursive = (obj: any): any => {
      if (!obj || typeof obj !== 'object') {
        return obj;
      }

      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const lowerKey = key.toLowerCase();
          
          // Check if key contains sensitive information
          if (sensitiveFields.some(field => lowerKey.includes(field))) {
            obj[key] = '[REDACTED]';
          } else if (typeof obj[key] === 'object') {
            obj[key] = sanitizeRecursive(obj[key]);
          }
        }
      }

      return obj;
    };

    return sanitizeRecursive(sanitized);
  }
}
