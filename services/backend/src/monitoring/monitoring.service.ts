import { Injectable } from '@nestjs/common';
import { createLogger, createApplicationMetrics, createHealthCheck, commonHealthChecks } from '@nexus/monitoring';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MonitoringService {
  private logger: ReturnType<typeof createLogger>;
  private metrics: ReturnType<typeof createApplicationMetrics>;
  private healthCheck: ReturnType<typeof createHealthCheck>;

  constructor(private configService: ConfigService) {
    const config = {
      serviceName: 'nexus-workspace-backend',
      environment: this.configService.get('NODE_ENV', 'development'),
      version: this.configService.get('APP_VERSION', '1.0.0'),
      enableDatadog: this.configService.get('ENABLE_DATADOG', 'false') === 'true',
      enableCloudWatch: this.configService.get('ENABLE_CLOUDWATCH', 'false') === 'true',
      datadogApiKey: this.configService.get('DATADOG_API_KEY'),
      cloudWatchRegion: this.configService.get('AWS_REGION', 'us-west-2'),
      cloudWatchLogGroup: this.configService.get('CLOUDWATCH_LOG_GROUP', '/aws/eks/nexus-workspace/application'),
      logLevel: this.configService.get('LOG_LEVEL', 'info') as 'error' | 'warn' | 'info' | 'debug',
    };

    this.logger = createLogger(config);
    this.metrics = createApplicationMetrics(config);
    
    // Set up health checks
    const healthChecks = [
      commonHealthChecks.database(this.testDatabaseConnection.bind(this)),
      // Add more health checks as needed
    ];
    
    this.healthCheck = createHealthCheck(config, healthChecks);
  }

  private async testDatabaseConnection(): Promise<boolean> {
    try {
      // Test database connection here
      // This is a placeholder - implement actual database connection test
      return true;
    } catch (error) {
      this.logger.error('Database connection test failed', { error: error.message });
      return false;
    }
  }

  // Expose logger methods
  logInfo(message: string, context?: any) {
    this.logger.info(message, context);
  }

  logWarn(message: string, context?: any) {
    this.logger.warn(message, context);
  }

  logError(message: string, context?: any) {
    this.logger.error(message, context);
  }

  logDebug(message: string, context?: any) {
    this.logger.debug(message, context);
  }

  // Expose metrics methods
  incrementCounter(name: string, labels?: any, value?: number) {
    this.metrics.incrementCounter(name, labels, value);
  }

  recordHistogram(name: string, value: number, labels?: any) {
    this.metrics.recordHistogram(name, value, labels);
  }

  setGauge(name: string, value: number, labels?: any) {
    this.metrics.setGauge(name, value, labels);
  }

  recordTimer(name: string, startTime: number, labels?: any) {
    this.metrics.recordTimer(name, startTime, labels);
  }

  // Business-specific metrics
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    this.metrics.recordHttpRequest(method, route, statusCode, duration);
  }

  recordDatabaseQuery(operation: string, table: string, duration: number, success: boolean) {
    this.metrics.recordDatabaseQuery(operation, table, duration, success);
  }

  recordUserAction(action: string, userId?: string) {
    this.metrics.recordUserAction(action, userId);
  }

  recordError(errorType: string, severity: 'low' | 'medium' | 'high' | 'critical') {
    this.metrics.recordError(errorType, severity);
  }

  // Health check
  async getHealthStatus() {
    return await this.healthCheck();
  }

  // Get metrics for Prometheus endpoint
  getMetrics() {
    // This would return Prometheus metrics
    // Implementation depends on the metrics library used
    return 'metrics data';
  }
}
