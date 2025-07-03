// Type definitions for monitoring package

export interface MonitoringConfig {
  serviceName: string;
  environment: string;
  version: string;
  enablePrometheus?: boolean;
  enableDatadog?: boolean;
  enableCloudWatch?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  datadogApiKey?: string;
  cloudWatchRegion?: string;
  cloudWatchLogGroup?: string;
}

export interface MetricLabels {
  [key: string]: string | number;
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: any;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: {
    [checkName: string]: {
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      duration?: number;
      timestamp: string;
    };
  };
  timestamp: string;
  uptime: number;
  version: string;
}

export interface MetricsCollector {
  incrementCounter(name: string, labels?: MetricLabels, value?: number): void;
  recordHistogram(name: string, value: number, labels?: MetricLabels): void;
  setGauge(name: string, value: number, labels?: MetricLabels): void;
  recordTimer(name: string, startTime: number, labels?: MetricLabels): void;
}

export interface Logger {
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
}

export interface HealthCheck {
  name: string;
  check: () => Promise<{ status: 'pass' | 'fail' | 'warn'; message?: string }>;
  timeout?: number;
  interval?: number;
}
