import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface BusinessMetric {
  id: string;
  name: string;
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  timestamp: Date;
  dimensions: Record<string, any>;
  metadata: Record<string, any>;
}

export interface KPI {
  id: string;
  name: string;
  description: string;
  currentValue: number;
  targetValue: number;
  threshold: {
    warning: number;
    critical: number;
  };
  status: 'healthy' | 'warning' | 'critical';
  trend: Array<{ timestamp: Date; value: number }>;
  formula: string;
}

export interface Insight {
  id: string;
  type: 'anomaly' | 'trend' | 'correlation' | 'prediction';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  data: Record<string, any>;
  recommendations: string[];
  timestamp: Date;
}

@Injectable()
export class BusinessIntelligenceService {
  private readonly logger = new Logger(BusinessIntelligenceService.name);
  private metricsCache = new Map<string, BusinessMetric[]>();
  private kpisCache = new Map<string, KPI>();
  private insightsCache = new Map<string, Insight[]>();

  // Core Business Intelligence Methods
  async calculateBusinessMetrics(timeRange: string = '24h'): Promise<BusinessMetric[]> {
    this.logger.debug(`Calculating business metrics for ${timeRange}`);

    const metrics: BusinessMetric[] = [
      await this.calculateUserEngagementMetrics(),
      await this.calculateRevenueMetrics(),
      await this.calculatePerformanceMetrics(),
      await this.calculateConversionMetrics(),
      await this.calculateRetentionMetrics(),
    ].flat();

    // Cache results
    this.metricsCache.set(timeRange, metrics);
    
    return metrics;
  }

  private async calculateUserEngagementMetrics(): Promise<BusinessMetric[]> {
    // Simulate real user engagement calculations
    const activeUsers = Math.floor(Math.random() * 10000) + 1000;
    const previousActiveUsers = Math.floor(Math.random() * 9000) + 1000;
    const sessionDuration = Math.random() * 600 + 120; // 2-12 minutes
    const previousSessionDuration = Math.random() * 580 + 120;
    const pageViews = Math.floor(Math.random() * 50000) + 5000;
    const previousPageViews = Math.floor(Math.random() * 45000) + 5000;

    return [
      {
        id: 'active_users',
        name: 'Active Users',
        value: activeUsers,
        previousValue: previousActiveUsers,
        change: activeUsers - previousActiveUsers,
        changePercent: ((activeUsers - previousActiveUsers) / previousActiveUsers) * 100,
        trend: activeUsers > previousActiveUsers ? 'up' : activeUsers < previousActiveUsers ? 'down' : 'stable',
        timestamp: new Date(),
        dimensions: { period: '24h', type: 'engagement' },
        metadata: { source: 'user_analytics', confidence: 0.95 },
      },
      {
        id: 'avg_session_duration',
        name: 'Average Session Duration',
        value: sessionDuration,
        previousValue: previousSessionDuration,
        change: sessionDuration - previousSessionDuration,
        changePercent: ((sessionDuration - previousSessionDuration) / previousSessionDuration) * 100,
        trend: sessionDuration > previousSessionDuration ? 'up' : sessionDuration < previousSessionDuration ? 'down' : 'stable',
        timestamp: new Date(),
        dimensions: { period: '24h', type: 'engagement', unit: 'seconds' },
        metadata: { source: 'session_analytics', confidence: 0.92 },
      },
      {
        id: 'page_views',
        name: 'Page Views',
        value: pageViews,
        previousValue: previousPageViews,
        change: pageViews - previousPageViews,
        changePercent: ((pageViews - previousPageViews) / previousPageViews) * 100,
        trend: pageViews > previousPageViews ? 'up' : pageViews < previousPageViews ? 'down' : 'stable',
        timestamp: new Date(),
        dimensions: { period: '24h', type: 'engagement' },
        metadata: { source: 'page_analytics', confidence: 0.98 },
      },
    ];
  }

  private async calculateRevenueMetrics(): Promise<BusinessMetric[]> {
    const revenue = Math.random() * 100000 + 10000;
    const previousRevenue = Math.random() * 95000 + 10000;
    const arpu = Math.random() * 50 + 10; // Average Revenue Per User
    const previousArpu = Math.random() * 48 + 10;

    return [
      {
        id: 'total_revenue',
        name: 'Total Revenue',
        value: revenue,
        previousValue: previousRevenue,
        change: revenue - previousRevenue,
        changePercent: ((revenue - previousRevenue) / previousRevenue) * 100,
        trend: revenue > previousRevenue ? 'up' : revenue < previousRevenue ? 'down' : 'stable',
        timestamp: new Date(),
        dimensions: { period: '24h', type: 'revenue', currency: 'USD' },
        metadata: { source: 'payment_analytics', confidence: 0.99 },
      },
      {
        id: 'arpu',
        name: 'Average Revenue Per User',
        value: arpu,
        previousValue: previousArpu,
        change: arpu - previousArpu,
        changePercent: ((arpu - previousArpu) / previousArpu) * 100,
        trend: arpu > previousArpu ? 'up' : arpu < previousArpu ? 'down' : 'stable',
        timestamp: new Date(),
        dimensions: { period: '24h', type: 'revenue', currency: 'USD' },
        metadata: { source: 'revenue_analytics', confidence: 0.94 },
      },
    ];
  }

  private async calculatePerformanceMetrics(): Promise<BusinessMetric[]> {
    const responseTime = Math.random() * 500 + 50;
    const previousResponseTime = Math.random() * 480 + 50;
    const errorRate = Math.random() * 5;
    const previousErrorRate = Math.random() * 4.8;

    return [
      {
        id: 'avg_response_time',
        name: 'Average Response Time',
        value: responseTime,
        previousValue: previousResponseTime,
        change: responseTime - previousResponseTime,
        changePercent: ((responseTime - previousResponseTime) / previousResponseTime) * 100,
        trend: responseTime < previousResponseTime ? 'up' : responseTime > previousResponseTime ? 'down' : 'stable', // Lower is better
        timestamp: new Date(),
        dimensions: { period: '24h', type: 'performance', unit: 'ms' },
        metadata: { source: 'performance_analytics', confidence: 0.97 },
      },
      {
        id: 'error_rate',
        name: 'Error Rate',
        value: errorRate,
        previousValue: previousErrorRate,
        change: errorRate - previousErrorRate,
        changePercent: ((errorRate - previousErrorRate) / previousErrorRate) * 100,
        trend: errorRate < previousErrorRate ? 'up' : errorRate > previousErrorRate ? 'down' : 'stable', // Lower is better
        timestamp: new Date(),
        dimensions: { period: '24h', type: 'performance', unit: 'percent' },
        metadata: { source: 'error_analytics', confidence: 0.96 },
      },
    ];
  }

  private async calculateConversionMetrics(): Promise<BusinessMetric[]> {
    const conversionRate = Math.random() * 10 + 1;
    const previousConversionRate = Math.random() * 9.5 + 1;
    const signupRate = Math.random() * 15 + 2;
    const previousSignupRate = Math.random() * 14 + 2;

    return [
      {
        id: 'conversion_rate',
        name: 'Conversion Rate',
        value: conversionRate,
        previousValue: previousConversionRate,
        change: conversionRate - previousConversionRate,
        changePercent: ((conversionRate - previousConversionRate) / previousConversionRate) * 100,
        trend: conversionRate > previousConversionRate ? 'up' : conversionRate < previousConversionRate ? 'down' : 'stable',
        timestamp: new Date(),
        dimensions: { period: '24h', type: 'conversion', unit: 'percent' },
        metadata: { source: 'conversion_analytics', confidence: 0.91 },
      },
      {
        id: 'signup_rate',
        name: 'Signup Rate',
        value: signupRate,
        previousValue: previousSignupRate,
        change: signupRate - previousSignupRate,
        changePercent: ((signupRate - previousSignupRate) / previousSignupRate) * 100,
        trend: signupRate > previousSignupRate ? 'up' : signupRate < previousSignupRate ? 'down' : 'stable',
        timestamp: new Date(),
        dimensions: { period: '24h', type: 'conversion', unit: 'percent' },
        metadata: { source: 'signup_analytics', confidence: 0.93 },
      },
    ];
  }

  private async calculateRetentionMetrics(): Promise<BusinessMetric[]> {
    const retentionRate = Math.random() * 30 + 60; // 60-90%
    const previousRetentionRate = Math.random() * 28 + 60;
    const churnRate = Math.random() * 10 + 2; // 2-12%
    const previousChurnRate = Math.random() * 9 + 2;

    return [
      {
        id: 'retention_rate',
        name: 'User Retention Rate',
        value: retentionRate,
        previousValue: previousRetentionRate,
        change: retentionRate - previousRetentionRate,
        changePercent: ((retentionRate - previousRetentionRate) / previousRetentionRate) * 100,
        trend: retentionRate > previousRetentionRate ? 'up' : retentionRate < previousRetentionRate ? 'down' : 'stable',
        timestamp: new Date(),
        dimensions: { period: '30d', type: 'retention', unit: 'percent' },
        metadata: { source: 'retention_analytics', confidence: 0.89 },
      },
      {
        id: 'churn_rate',
        name: 'Churn Rate',
        value: churnRate,
        previousValue: previousChurnRate,
        change: churnRate - previousChurnRate,
        changePercent: ((churnRate - previousChurnRate) / previousChurnRate) * 100,
        trend: churnRate < previousChurnRate ? 'up' : churnRate > previousChurnRate ? 'down' : 'stable', // Lower is better
        timestamp: new Date(),
        dimensions: { period: '30d', type: 'retention', unit: 'percent' },
        metadata: { source: 'churn_analytics', confidence: 0.87 },
      },
    ];
  }

  // KPI Management
  async calculateKPIs(): Promise<KPI[]> {
    const kpis: KPI[] = [
      {
        id: 'monthly_active_users',
        name: 'Monthly Active Users',
        description: 'Number of unique users who engaged with the platform in the last 30 days',
        currentValue: Math.floor(Math.random() * 50000) + 10000,
        targetValue: 75000,
        threshold: { warning: 60000, critical: 45000 },
        status: 'healthy',
        trend: this.generateTrendData(30),
        formula: 'COUNT(DISTINCT user_id) WHERE last_activity >= NOW() - INTERVAL 30 DAY',
      },
      {
        id: 'customer_satisfaction',
        name: 'Customer Satisfaction Score',
        description: 'Average customer satisfaction rating based on surveys and feedback',
        currentValue: Math.random() * 2 + 8, // 8-10 scale
        targetValue: 9.0,
        threshold: { warning: 8.5, critical: 7.5 },
        status: 'healthy',
        trend: this.generateTrendData(30, 8, 10),
        formula: 'AVG(satisfaction_rating) WHERE survey_date >= NOW() - INTERVAL 30 DAY',
      },
      {
        id: 'system_uptime',
        name: 'System Uptime',
        description: 'Percentage of time the system was available and operational',
        currentValue: Math.random() * 1 + 99, // 99-100%
        targetValue: 99.9,
        threshold: { warning: 99.5, critical: 99.0 },
        status: 'healthy',
        trend: this.generateTrendData(30, 99, 100),
        formula: '(total_uptime_minutes / total_minutes) * 100',
      },
    ];

    // Update KPI status based on thresholds
    kpis.forEach(kpi => {
      if (kpi.currentValue < kpi.threshold.critical) {
        kpi.status = 'critical';
      } else if (kpi.currentValue < kpi.threshold.warning) {
        kpi.status = 'warning';
      } else {
        kpi.status = 'healthy';
      }
    });

    // Cache KPIs
    kpis.forEach(kpi => this.kpisCache.set(kpi.id, kpi));

    return kpis;
  }

  private generateTrendData(days: number, min: number = 0, max: number = 100000): Array<{ timestamp: Date; value: number }> {
    const trend = [];
    const now = new Date();
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const value = Math.random() * (max - min) + min;
      trend.push({ timestamp: date, value });
    }
    
    return trend;
  }

  // AI-Powered Insights Generation
  async generateInsights(): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Anomaly Detection Insights
    insights.push(...await this.detectAnomalies());
    
    // Trend Analysis Insights
    insights.push(...await this.analyzeTrends());
    
    // Correlation Insights
    insights.push(...await this.findCorrelations());
    
    // Predictive Insights
    insights.push(...await this.generatePredictions());

    // Cache insights
    this.insightsCache.set('current', insights);

    return insights;
  }

  private async detectAnomalies(): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Simulate anomaly detection
    if (Math.random() > 0.7) {
      insights.push({
        id: `anomaly_${Date.now()}`,
        type: 'anomaly',
        title: 'Unusual Traffic Spike Detected',
        description: 'Traffic has increased by 150% compared to the same time last week, which is outside normal variance patterns.',
        severity: 'medium',
        confidence: 0.87,
        data: {
          currentTraffic: 15000,
          expectedTraffic: 6000,
          variance: 150,
          timeWindow: '1h',
        },
        recommendations: [
          'Monitor server performance and scaling',
          'Check for potential marketing campaigns or viral content',
          'Verify traffic quality to rule out bot activity',
        ],
        timestamp: new Date(),
      });
    }

    if (Math.random() > 0.8) {
      insights.push({
        id: `anomaly_${Date.now() + 1}`,
        type: 'anomaly',
        title: 'Error Rate Anomaly',
        description: 'Error rate has spiked to 8.5%, significantly higher than the normal 2-3% range.',
        severity: 'high',
        confidence: 0.94,
        data: {
          currentErrorRate: 8.5,
          normalErrorRate: 2.5,
          affectedEndpoints: ['/api/users', '/api/analytics'],
        },
        recommendations: [
          'Investigate recent deployments or configuration changes',
          'Check database connection pool and query performance',
          'Review error logs for common patterns',
        ],
        timestamp: new Date(),
      });
    }

    return insights;
  }

  private async analyzeTrends(): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Simulate trend analysis
    insights.push({
      id: `trend_${Date.now()}`,
      type: 'trend',
      title: 'Positive User Engagement Trend',
      description: 'User engagement metrics show a consistent upward trend over the past 14 days, with session duration increasing by 23%.',
      severity: 'low',
      confidence: 0.91,
      data: {
        metric: 'session_duration',
        trendDirection: 'up',
        changePercent: 23,
        timeframe: '14d',
        significance: 'high',
      },
      recommendations: [
        'Analyze which features are driving increased engagement',
        'Consider expanding successful features or content',
        'Document best practices for future feature development',
      ],
      timestamp: new Date(),
    });

    return insights;
  }

  private async findCorrelations(): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Simulate correlation analysis
    insights.push({
      id: `correlation_${Date.now()}`,
      type: 'correlation',
      title: 'Strong Correlation: Page Load Time vs Bounce Rate',
      description: 'Analysis reveals a strong negative correlation (-0.78) between page load time and user bounce rate.',
      severity: 'medium',
      confidence: 0.89,
      data: {
        correlation: -0.78,
        variables: ['page_load_time', 'bounce_rate'],
        sampleSize: 10000,
        pValue: 0.001,
      },
      recommendations: [
        'Prioritize page speed optimization initiatives',
        'Implement performance monitoring for critical pages',
        'Consider CDN implementation for static assets',
      ],
      timestamp: new Date(),
    });

    return insights;
  }

  private async generatePredictions(): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Simulate predictive analytics
    insights.push({
      id: `prediction_${Date.now()}`,
      type: 'prediction',
      title: 'Revenue Forecast: 15% Growth Expected',
      description: 'Based on current trends and seasonal patterns, revenue is predicted to grow by 15% over the next quarter.',
      severity: 'low',
      confidence: 0.82,
      data: {
        currentRevenue: 125000,
        predictedRevenue: 143750,
        growthRate: 15,
        timeframe: 'next_quarter',
        factors: ['seasonal_trends', 'user_growth', 'feature_adoption'],
      },
      recommendations: [
        'Prepare infrastructure for increased load',
        'Plan marketing campaigns to capitalize on growth',
        'Review pricing strategy for optimization opportunities',
      ],
      timestamp: new Date(),
    });

    return insights;
  }

  // Scheduled Analytics Jobs
  @Cron(CronExpression.EVERY_HOUR)
  async updateBusinessMetrics(): Promise<void> {
    this.logger.debug('Updating business metrics');
    await this.calculateBusinessMetrics();
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async updateKPIs(): Promise<void> {
    this.logger.debug('Updating KPIs');
    await this.calculateKPIs();
  }

  @Cron(CronExpression.EVERY_12_HOURS)
  async generateDailyInsights(): Promise<void> {
    this.logger.debug('Generating daily insights');
    await this.generateInsights();
  }

  // Public API Methods
  async getBusinessMetrics(timeRange: string = '24h'): Promise<BusinessMetric[]> {
    const cached = this.metricsCache.get(timeRange);
    if (cached) {
      return cached;
    }
    return await this.calculateBusinessMetrics(timeRange);
  }

  async getKPIs(): Promise<KPI[]> {
    const cachedKPIs = Array.from(this.kpisCache.values());
    if (cachedKPIs.length > 0) {
      return cachedKPIs;
    }
    return await this.calculateKPIs();
  }

  async getInsights(): Promise<Insight[]> {
    const cached = this.insightsCache.get('current');
    if (cached) {
      return cached;
    }
    return await this.generateInsights();
  }

  async getDashboardData(): Promise<{
    metrics: BusinessMetric[];
    kpis: KPI[];
    insights: Insight[];
    summary: {
      totalUsers: number;
      totalRevenue: number;
      systemHealth: string;
      trendsCount: number;
    };
  }> {
    const [metrics, kpis, insights] = await Promise.all([
      this.getBusinessMetrics(),
      this.getKPIs(),
      this.getInsights(),
    ]);

    const summary = {
      totalUsers: metrics.find(m => m.id === 'active_users')?.value || 0,
      totalRevenue: metrics.find(m => m.id === 'total_revenue')?.value || 0,
      systemHealth: kpis.every(k => k.status === 'healthy') ? 'healthy' : 'warning',
      trendsCount: insights.filter(i => i.type === 'trend').length,
    };

    return { metrics, kpis, insights, summary };
  }
}
