import promClient from 'prom-client';
import StatsD from 'datadog-metrics';
import { MonitoringConfig, MetricsCollector, MetricLabels } from './types';

export function createMetrics(config: MonitoringConfig): MetricsCollector {
  // Initialize Prometheus metrics
  const prometheusRegistry = new promClient.Registry();
  
  // Add default metrics (CPU, memory, etc.)
  promClient.collectDefaultMetrics({
    register: prometheusRegistry,
    prefix: `${config.serviceName}_`,
  });

  // Initialize Datadog if enabled
  let datadogClient: any = null;
  if (config.enableDatadog && config.datadogApiKey) {
    StatsD.init({
      host: 'localhost',
      port: 8125,
      prefix: `${config.serviceName}.`,
      tags: [`env:${config.environment}`, `version:${config.version}`],
    });
    datadogClient = StatsD;
  }

  // Prometheus metric instances
  const counters = new Map<string, promClient.Counter>();
  const histograms = new Map<string, promClient.Histogram>();
  const gauges = new Map<string, promClient.Gauge>();

  function getOrCreateCounter(name: string, help: string, labelNames: string[] = []): promClient.Counter {
    const key = `${name}_${labelNames.join('_')}`;
    if (!counters.has(key)) {
      const counter = new promClient.Counter({
        name: `${config.serviceName}_${name}`,
        help,
        labelNames,
        registers: [prometheusRegistry],
      });
      counters.set(key, counter);
    }
    return counters.get(key)!;
  }

  function getOrCreateHistogram(name: string, help: string, labelNames: string[] = [], buckets?: number[]): promClient.Histogram {
    const key = `${name}_${labelNames.join('_')}`;
    if (!histograms.has(key)) {
      const histogram = new promClient.Histogram({
        name: `${config.serviceName}_${name}`,
        help,
        labelNames,
        buckets: buckets || [0.1, 0.5, 1, 2, 5, 10],
        registers: [prometheusRegistry],
      });
      histograms.set(key, histogram);
    }
    return histograms.get(key)!;
  }

  function getOrCreateGauge(name: string, help: string, labelNames: string[] = []): promClient.Gauge {
    const key = `${name}_${labelNames.join('_')}`;
    if (!gauges.has(key)) {
      const gauge = new promClient.Gauge({
        name: `${config.serviceName}_${name}`,
        help,
        labelNames,
        registers: [prometheusRegistry],
      });
      gauges.set(key, gauge);
    }
    return gauges.get(key)!;
  }

  return {
    incrementCounter: (name: string, labels?: MetricLabels, value: number = 1) => {
      const labelNames = labels ? Object.keys(labels) : [];
      const counter = getOrCreateCounter(name, `Counter for ${name}`, labelNames);
      
      if (labels) {
        counter.inc(labels, value);
      } else {
        counter.inc(value);
      }

      // Send to Datadog if enabled
      if (datadogClient) {
        const tags = labels ? Object.entries(labels).map(([k, v]) => `${k}:${v}`) : [];
        datadogClient.increment(name, value, tags);
      }
    },

    recordHistogram: (name: string, value: number, labels?: MetricLabels) => {
      const labelNames = labels ? Object.keys(labels) : [];
      const histogram = getOrCreateHistogram(name, `Histogram for ${name}`, labelNames);
      
      if (labels) {
        histogram.observe(labels, value);
      } else {
        histogram.observe(value);
      }

      // Send to Datadog if enabled
      if (datadogClient) {
        const tags = labels ? Object.entries(labels).map(([k, v]) => `${k}:${v}`) : [];
        datadogClient.histogram(name, value, tags);
      }
    },

    setGauge: (name: string, value: number, labels?: MetricLabels) => {
      const labelNames = labels ? Object.keys(labels) : [];
      const gauge = getOrCreateGauge(name, `Gauge for ${name}`, labelNames);
      
      if (labels) {
        gauge.set(labels, value);
      } else {
        gauge.set(value);
      }

      // Send to Datadog if enabled
      if (datadogClient) {
        const tags = labels ? Object.entries(labels).map(([k, v]) => `${k}:${v}`) : [];
        datadogClient.gauge(name, value, tags);
      }
    },

    recordTimer: (name: string, startTime: number, labels?: MetricLabels) => {
      const duration = Date.now() - startTime;
      const labelNames = labels ? Object.keys(labels) : [];
      const histogram = getOrCreateHistogram(`${name}_duration_seconds`, `Duration for ${name}`, labelNames);
      
      if (labels) {
        histogram.observe(labels, duration / 1000);
      } else {
        histogram.observe(duration / 1000);
      }

      // Send to Datadog if enabled
      if (datadogClient) {
        const tags = labels ? Object.entries(labels).map(([k, v]) => `${k}:${v}`) : [];
        datadogClient.histogram(`${name}.duration`, duration, tags);
      }
    },
  };
}

// Pre-defined application metrics
export function createApplicationMetrics(config: MonitoringConfig) {
  const metrics = createMetrics(config);

  return {
    ...metrics,

    // HTTP metrics
    recordHttpRequest: (method: string, route: string, statusCode: number, duration: number) => {
      metrics.incrementCounter('http_requests_total', {
        method,
        route,
        status_code: statusCode.toString(),
      });
      
      metrics.recordHistogram('http_request_duration_seconds', duration / 1000, {
        method,
        route,
      });
    },

    // Database metrics
    recordDatabaseQuery: (operation: string, table: string, duration: number, success: boolean) => {
      metrics.incrementCounter('database_queries_total', {
        operation,
        table,
        success: success.toString(),
      });
      
      metrics.recordHistogram('database_query_duration_seconds', duration / 1000, {
        operation,
        table,
      });
    },

    // Business metrics
    recordUserAction: (action: string, userId?: string) => {
      metrics.incrementCounter('user_actions_total', {
        action,
        user_type: userId ? 'authenticated' : 'anonymous',
      });
    },

    // Error metrics
    recordError: (errorType: string, severity: 'low' | 'medium' | 'high' | 'critical') => {
      metrics.incrementCounter('errors_total', {
        type: errorType,
        severity,
      });
    },

    // Cache metrics
    recordCacheOperation: (operation: 'hit' | 'miss' | 'set' | 'delete', cacheType: string) => {
      metrics.incrementCounter('cache_operations_total', {
        operation,
        cache_type: cacheType,
      });
    },

    // Queue metrics
    recordQueueOperation: (queue: string, operation: 'enqueue' | 'dequeue' | 'process', duration?: number) => {
      metrics.incrementCounter('queue_operations_total', {
        queue,
        operation,
      });
      
      if (duration !== undefined) {
        metrics.recordHistogram('queue_operation_duration_seconds', duration / 1000, {
          queue,
          operation,
        });
      }
    },

    // Custom business metrics
    recordRevenue: (amount: number, currency: string = 'USD') => {
      metrics.recordHistogram('revenue_amount', amount, { currency });
    },

    recordActiveUsers: (count: number) => {
      metrics.setGauge('active_users', count);
    },

    recordSystemLoad: (load: number) => {
      metrics.setGauge('system_load', load);
    },
  };
}

// Metrics middleware for Express
export function createMetricsMiddleware(metrics: ReturnType<typeof createApplicationMetrics>) {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const route = req.route?.path || req.path || 'unknown';
      
      metrics.recordHttpRequest(
        req.method,
        route,
        res.statusCode,
        duration
      );
    });
    
    next();
  };
}

// Export Prometheus metrics endpoint
export function createMetricsEndpoint(config: MonitoringConfig) {
  const registry = promClient.register;
  
  return async (req: any, res: any) => {
    try {
      res.set('Content-Type', registry.contentType);
      res.end(await registry.metrics());
    } catch (error) {
      res.status(500).end(error);
    }
  };
}
