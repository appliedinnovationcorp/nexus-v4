import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface RealTimeMetric {
  id: string;
  name: string;
  value: number;
  timestamp: Date;
  dimensions: Record<string, string>;
  aggregationType: 'sum' | 'avg' | 'count' | 'max' | 'min';
}

export interface Alert {
  id: string;
  type: 'threshold' | 'anomaly' | 'trend';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold?: number;
  timestamp: Date;
  metadata: Record<string, any>;
}

@Injectable()
export class RealTimeProcessingService {
  private readonly logger = new Logger(RealTimeProcessingService.name);
  private readonly metricsCache = new Map<string, RealTimeMetric[]>();
  private readonly alertsCache = new Map<string, Alert[]>();

  constructor(
    @InjectQueue('stream-processing') private streamQueue: Queue,
    @InjectQueue('aggregation') private aggregationQueue: Queue,
    @InjectQueue('alerts') private alertsQueue: Queue,
  ) {}

  // Process real-time events
  async processRealTimeEvent(event: any): Promise<void> {
    this.logger.debug(`Processing real-time event: ${event.type}`);

    // Add to stream processing queue
    await this.streamQueue.add('process-stream-event', event, {
      priority: 8,
      attempts: 2,
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }

  // Generate real-time metrics
  async generateMetrics(timeWindow: string = '1m'): Promise<RealTimeMetric[]> {
    const cacheKey = `metrics_${timeWindow}`;
    
    if (this.metricsCache.has(cacheKey)) {
      return this.metricsCache.get(cacheKey)!;
    }

    // Simulate real-time metrics generation
    const metrics: RealTimeMetric[] = [
      {
        id: crypto.randomUUID(),
        name: 'active_users',
        value: Math.floor(Math.random() * 1000) + 100,
        timestamp: new Date(),
        dimensions: { source: 'web' },
        aggregationType: 'count',
      },
      {
        id: crypto.randomUUID(),
        name: 'page_views_per_minute',
        value: Math.floor(Math.random() * 500) + 50,
        timestamp: new Date(),
        dimensions: { source: 'all' },
        aggregationType: 'sum',
      },
      {
        id: crypto.randomUUID(),
        name: 'avg_response_time',
        value: Math.random() * 200 + 50,
        timestamp: new Date(),
        dimensions: { service: 'api' },
        aggregationType: 'avg',
      },
      {
        id: crypto.randomUUID(),
        name: 'error_rate',
        value: Math.random() * 5,
        timestamp: new Date(),
        dimensions: { service: 'all' },
        aggregationType: 'avg',
      },
    ];

    // Cache for 30 seconds
    this.metricsCache.set(cacheKey, metrics);
    setTimeout(() => this.metricsCache.delete(cacheKey), 30000);

    return metrics;
  }

  // Real-time aggregations
  async performAggregation(
    metric: string,
    timeWindow: string,
    aggregationType: 'sum' | 'avg' | 'count' | 'max' | 'min'
  ): Promise<number> {
    await this.aggregationQueue.add('perform-aggregation', {
      metric,
      timeWindow,
      aggregationType,
      timestamp: new Date(),
    });

    // Simulate aggregation result
    switch (aggregationType) {
      case 'sum':
        return Math.floor(Math.random() * 10000);
      case 'avg':
        return Math.random() * 100;
      case 'count':
        return Math.floor(Math.random() * 1000);
      case 'max':
        return Math.random() * 1000;
      case 'min':
        return Math.random() * 10;
      default:
        return 0;
    }
  }

  // Alert processing
  async processAlert(alert: Alert): Promise<void> {
    this.logger.warn(`Processing alert: ${alert.type} - ${alert.message}`);

    await this.alertsQueue.add('process-alert', alert, {
      priority: this.getAlertPriority(alert.severity),
      attempts: 3,
    });

    // Cache recent alerts
    const alertsKey = `alerts_${alert.type}`;
    const existingAlerts = this.alertsCache.get(alertsKey) || [];
    existingAlerts.push(alert);
    
    // Keep only last 100 alerts
    if (existingAlerts.length > 100) {
      existingAlerts.splice(0, existingAlerts.length - 100);
    }
    
    this.alertsCache.set(alertsKey, existingAlerts);
  }

  // Get real-time dashboard data
  async getDashboardData(): Promise<{
    metrics: RealTimeMetric[];
    alerts: Alert[];
    systemHealth: Record<string, any>;
  }> {
    const metrics = await this.generateMetrics();
    const recentAlerts = this.getRecentAlerts();
    const systemHealth = await this.getSystemHealth();

    return {
      metrics,
      alerts: recentAlerts,
      systemHealth,
    };
  }

  // Anomaly detection
  async detectAnomalies(metric: string, value: number): Promise<boolean> {
    // Simple threshold-based anomaly detection
    const thresholds: Record<string, { min: number; max: number }> = {
      'error_rate': { min: 0, max: 10 },
      'response_time': { min: 0, max: 1000 },
      'active_users': { min: 10, max: 10000 },
    };

    const threshold = thresholds[metric];
    if (!threshold) return false;

    const isAnomaly = value < threshold.min || value > threshold.max;
    
    if (isAnomaly) {
      await this.processAlert({
        id: crypto.randomUUID(),
        type: 'anomaly',
        severity: value > threshold.max * 2 ? 'critical' : 'high',
        message: `Anomaly detected in ${metric}: ${value}`,
        metric,
        value,
        threshold: threshold.max,
        timestamp: new Date(),
        metadata: { detectionMethod: 'threshold' },
      });
    }

    return isAnomaly;
  }

  // Scheduled tasks
  @Cron(CronExpression.EVERY_MINUTE)
  async generatePeriodicMetrics(): Promise<void> {
    this.logger.debug('Generating periodic metrics');
    await this.generateMetrics();
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async performHealthCheck(): Promise<void> {
    this.logger.debug('Performing system health check');
    const health = await this.getSystemHealth();
    
    // Check for unhealthy conditions
    if (health.queueHealth.some((q: any) => q.status === 'unhealthy')) {
      await this.processAlert({
        id: crypto.randomUUID(),
        type: 'threshold',
        severity: 'medium',
        message: 'Queue health degraded',
        metric: 'queue_health',
        value: 0,
        timestamp: new Date(),
        metadata: { healthCheck: health },
      });
    }
  }

  private getAlertPriority(severity: string): number {
    const priorityMap: Record<string, number> = {
      'critical': 10,
      'high': 8,
      'medium': 5,
      'low': 2,
    };
    return priorityMap[severity] || 5;
  }

  private getRecentAlerts(): Alert[] {
    const allAlerts: Alert[] = [];
    for (const alerts of this.alertsCache.values()) {
      allAlerts.push(...alerts);
    }
    
    return allAlerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20);
  }

  private async getSystemHealth(): Promise<Record<string, any>> {
    const [streamStats, aggregationStats, alertsStats] = await Promise.all([
      this.streamQueue.getJobCounts(),
      this.aggregationQueue.getJobCounts(),
      this.alertsQueue.getJobCounts(),
    ]);

    return {
      timestamp: new Date(),
      queueHealth: [
        {
          name: 'stream-processing',
          status: streamStats.failed > streamStats.completed * 0.1 ? 'unhealthy' : 'healthy',
          stats: streamStats,
        },
        {
          name: 'aggregation',
          status: aggregationStats.failed > aggregationStats.completed * 0.1 ? 'unhealthy' : 'healthy',
          stats: aggregationStats,
        },
        {
          name: 'alerts',
          status: alertsStats.failed > alertsStats.completed * 0.1 ? 'unhealthy' : 'healthy',
          stats: alertsStats,
        },
      ],
      cacheHealth: {
        metricsCache: this.metricsCache.size,
        alertsCache: this.alertsCache.size,
      },
    };
  }
}
