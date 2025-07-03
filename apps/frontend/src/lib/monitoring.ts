// Frontend Monitoring Integration for Nexus Workspace

interface MonitoringConfig {
  serviceName: string;
  environment: string;
  version: string;
  datadogRumApplicationId?: string;
  datadogRumClientToken?: string;
  enableConsoleLogging?: boolean;
}

interface LogContext {
  userId?: string;
  sessionId?: string;
  page?: string;
  component?: string;
  [key: string]: any;
}

class FrontendMonitoring {
  private config: MonitoringConfig;
  private sessionId: string;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.sessionId = this.generateSessionId();
    this.initialize();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initialize() {
    // Initialize Datadog RUM if configured
    if (this.config.datadogRumApplicationId && this.config.datadogRumClientToken) {
      this.initializeDatadogRUM();
    }

    // Set up error tracking
    this.setupErrorTracking();

    // Set up performance monitoring
    this.setupPerformanceMonitoring();

    // Track page views
    this.trackPageView();
  }

  private initializeDatadogRUM() {
    // This would typically load the Datadog RUM SDK
    // For now, we'll simulate the initialization
    if (typeof window !== 'undefined') {
      (window as any).DD_RUM?.init({
        applicationId: this.config.datadogRumApplicationId,
        clientToken: this.config.datadogRumClientToken,
        site: 'datadoghq.com',
        service: this.config.serviceName,
        env: this.config.environment,
        version: this.config.version,
        sessionSampleRate: 100,
        sessionReplaySampleRate: 20,
        trackUserInteractions: true,
        trackResources: true,
        trackLongTasks: true,
        defaultPrivacyLevel: 'mask-user-input',
      });
    }
  }

  private setupErrorTracking() {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.logError('JavaScript Error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.logError('Unhandled Promise Rejection', {
          reason: event.reason,
          stack: event.reason?.stack,
        });
      });
    }
  }

  private setupPerformanceMonitoring() {
    if (typeof window !== 'undefined' && 'performance' in window) {
      // Monitor page load performance
      window.addEventListener('load', () => {
        setTimeout(() => {
          const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (perfData) {
            this.recordPerformance('page_load', {
              dns_lookup: perfData.domainLookupEnd - perfData.domainLookupStart,
              tcp_connect: perfData.connectEnd - perfData.connectStart,
              request: perfData.responseStart - perfData.requestStart,
              response: perfData.responseEnd - perfData.responseStart,
              dom_processing: perfData.domContentLoadedEventStart - perfData.responseEnd,
              total_load_time: perfData.loadEventEnd - perfData.navigationStart,
            });
          }
        }, 0);
      });

      // Monitor resource loading
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;
            this.recordPerformance('resource_load', {
              name: resourceEntry.name,
              duration: resourceEntry.duration,
              size: resourceEntry.transferSize,
              type: this.getResourceType(resourceEntry.name),
            });
          }
        }
      });

      observer.observe({ entryTypes: ['resource'] });
    }
  }

  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'javascript';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
    if (url.includes('/api/')) return 'api';
    return 'other';
  }

  // Public logging methods
  public logInfo(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  public logWarn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  public logError(message: string, context?: LogContext) {
    this.log('error', message, context);
  }

  public logDebug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  private log(level: string, message: string, context?: LogContext) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.config.serviceName,
      environment: this.config.environment,
      version: this.config.version,
      sessionId: this.sessionId,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      ...context,
    };

    // Console logging
    if (this.config.enableConsoleLogging) {
      console[level as keyof Console]?.(message, logEntry);
    }

    // Send to Datadog if available
    if (typeof window !== 'undefined' && (window as any).DD_RUM) {
      (window as any).DD_RUM.addLoggerGlobalContext(logEntry);
    }

    // Send to backend logging endpoint
    this.sendToBackend(logEntry);
  }

  private async sendToBackend(logEntry: any) {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      // Silently fail to avoid infinite loops
      if (this.config.enableConsoleLogging) {
        console.error('Failed to send log to backend:', error);
      }
    }
  }

  // User interaction tracking
  public trackUserAction(action: string, context?: LogContext) {
    this.logInfo('User Action', {
      action,
      ...context,
    });

    // Send to Datadog RUM
    if (typeof window !== 'undefined' && (window as any).DD_RUM) {
      (window as any).DD_RUM.addUserAction(action, context);
    }
  }

  // Page view tracking
  public trackPageView(page?: string) {
    const currentPage = page || (typeof window !== 'undefined' ? window.location.pathname : '');
    
    this.logInfo('Page View', {
      page: currentPage,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
    });
  }

  // Performance tracking
  public recordPerformance(metric: string, data: any) {
    this.logInfo('Performance Metric', {
      metric,
      ...data,
    });
  }

  // Custom event tracking
  public trackEvent(eventName: string, properties?: any) {
    this.logInfo('Custom Event', {
      event: eventName,
      properties,
    });

    // Send to Datadog RUM
    if (typeof window !== 'undefined' && (window as any).DD_RUM) {
      (window as any).DD_RUM.addUserAction(eventName, properties);
    }
  }

  // Business metrics tracking
  public trackBusinessEvent(event: string, value?: number, properties?: any) {
    this.logInfo('Business Event', {
      event,
      value,
      properties,
    });
  }

  // Error boundary integration
  public captureException(error: Error, context?: LogContext) {
    this.logError('React Error Boundary', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...context,
    });
  }

  // Form tracking
  public trackFormSubmission(formName: string, success: boolean, errors?: string[]) {
    this.logInfo('Form Submission', {
      form: formName,
      success,
      errors,
    });
  }

  // API call tracking
  public trackApiCall(endpoint: string, method: string, statusCode: number, duration: number) {
    this.logInfo('API Call', {
      endpoint,
      method,
      statusCode,
      duration,
      success: statusCode >= 200 && statusCode < 300,
    });
  }
}

// React Hook for monitoring
export function useMonitoring() {
  const monitoring = new FrontendMonitoring({
    serviceName: 'nexus-workspace-frontend',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    datadogRumApplicationId: process.env.NEXT_PUBLIC_DATADOG_RUM_APPLICATION_ID,
    datadogRumClientToken: process.env.NEXT_PUBLIC_DATADOG_RUM_CLIENT_TOKEN,
    enableConsoleLogging: process.env.NODE_ENV === 'development',
  });

  return monitoring;
}

// Error Boundary Component
import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class MonitoringErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  private monitoring: FrontendMonitoring;

  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
    this.monitoring = new FrontendMonitoring({
      serviceName: 'nexus-workspace-frontend',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      enableConsoleLogging: process.env.NODE_ENV === 'development',
    });
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.monitoring.captureException(error, {
      component: 'ErrorBoundary',
      errorInfo: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>We've been notified about this error and will fix it soon.</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Export singleton instance
export const monitoring = new FrontendMonitoring({
  serviceName: 'nexus-workspace-frontend',
  environment: process.env.NODE_ENV || 'development',
  version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  datadogRumApplicationId: process.env.NEXT_PUBLIC_DATADOG_RUM_APPLICATION_ID,
  datadogRumClientToken: process.env.NEXT_PUBLIC_DATADOG_RUM_CLIENT_TOKEN,
  enableConsoleLogging: process.env.NODE_ENV === 'development',
});

export default monitoring;
