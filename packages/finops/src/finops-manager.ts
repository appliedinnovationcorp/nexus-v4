import { ResourceTaggingManager } from './core/tagging';
import { CostMonitoringManager } from './core/cost-monitoring';
import { CostEstimationEngine } from './core/cost-estimation';
import { CostImpactAnalyzer } from './ci/cost-impact-analyzer';
import { FinOpsConfig, FinOpsApiResponse } from './types';
import { AnalyticsTracker } from '@nexus/analytics';

/**
 * Main FinOps manager that orchestrates all cost management operations
 */
export class FinOpsManager {
  private taggingManager: ResourceTaggingManager;
  private costMonitoring: CostMonitoringManager;
  private costEstimation: CostEstimationEngine;
  private costAnalyzer: CostImpactAnalyzer;
  private analytics: AnalyticsTracker;
  private config: FinOpsConfig;

  constructor(config: FinOpsConfig) {
    this.config = config;
    this.taggingManager = new ResourceTaggingManager(config);
    this.costMonitoring = new CostMonitoringManager(config);
    this.costEstimation = new CostEstimationEngine(config);
    this.costAnalyzer = new CostImpactAnalyzer(config);
    this.analytics = new AnalyticsTracker();
  }

  /**
   * Initialize FinOps system
   */
  async initialize(): Promise<FinOpsApiResponse<{ status: string }>> {
    try {
      await this.analytics.track('finops.system.initialized', {
        region: this.config.aws.region,
        features: {
          tagging: this.config.tagging.enforceRequiredTags,
          costMonitoring: this.config.costMonitoring.anomalyDetection.enabled,
          budgets: this.config.aws.budgetsEnabled,
        },
      });

      return {
        success: true,
        data: { status: 'initialized' },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: this.generateRequestId(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INITIALIZATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: this.generateRequestId(),
        },
      };
    }
  }

  /**
   * Get comprehensive cost dashboard data
   */
  async getDashboardData(): Promise<FinOpsApiResponse<{
    costSummary: {
      currentMonth: number;
      lastMonth: number;
      trend: 'INCREASING' | 'DECREASING' | 'STABLE';
      topServices: Array<{ service: string; cost: number }>;
    };
    budgetStatus: Array<{
      name: string;
      limit: number;
      spent: number;
      remaining: number;
      percentage: number;
    }>;
    taggingCompliance: {
      compliant: number;
      nonCompliant: number;
      percentage: number;
    };
    anomalies: Array<{
      service: string;
      impact: number;
      severity: string;
      date: string;
    }>;
    recommendations: Array<{
      type: string;
      description: string;
      potentialSavings: number;
    }>;
  }>> {
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Get current month costs
      const currentMonthCosts = await this.costMonitoring.getCostAndUsage({
        startDate: currentMonthStart.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
        granularity: 'DAILY',
        groupBy: [{ type: 'DIMENSION', key: 'SERVICE' }],
      });

      // Get last month costs
      const lastMonthCosts = await this.costMonitoring.getCostAndUsage({
        startDate: lastMonthStart.toISOString().split('T')[0],
        endDate: lastMonthEnd.toISOString().split('T')[0],
        granularity: 'DAILY',
        groupBy: [{ type: 'DIMENSION', key: 'SERVICE' }],
      });

      // Calculate totals and trends
      const currentMonthTotal = currentMonthCosts.reduce((sum, point) => sum + point.amount, 0);
      const lastMonthTotal = lastMonthCosts.reduce((sum, point) => sum + point.amount, 0);
      const trend = this.calculateTrend(currentMonthTotal, lastMonthTotal);

      // Get top services
      const serviceSpending = new Map<string, number>();
      currentMonthCosts.forEach(point => {
        if (point.service) {
          serviceSpending.set(point.service, (serviceSpending.get(point.service) || 0) + point.amount);
        }
      });
      const topServices = Array.from(serviceSpending.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([service, cost]) => ({ service, cost }));

      // Get tagging compliance
      const taggingReport = await this.taggingManager.getTagComplianceReport();

      // Get recent anomalies
      const anomalies = await this.costMonitoring.getCostAnomalies({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
      });

      const dashboardData = {
        costSummary: {
          currentMonth: currentMonthTotal,
          lastMonth: lastMonthTotal,
          trend,
          topServices,
        },
        budgetStatus: [], // Would be populated with actual budget data
        taggingCompliance: {
          compliant: taggingReport.compliantResources,
          nonCompliant: taggingReport.nonCompliantResources,
          percentage: taggingReport.compliancePercentage,
        },
        anomalies: anomalies.slice(0, 10).map(anomaly => ({
          service: anomaly.service,
          impact: anomaly.actualCost,
          severity: anomaly.severity,
          date: anomaly.startDate,
        })),
        recommendations: [], // Would be populated with optimization recommendations
      };

      await this.analytics.track('finops.dashboard.loaded', {
        currentMonthCost: currentMonthTotal,
        trend,
        anomalyCount: anomalies.length,
        compliancePercentage: taggingReport.compliancePercentage,
      });

      return {
        success: true,
        data: dashboardData,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: this.generateRequestId(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DASHBOARD_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: this.generateRequestId(),
        },
      };
    }
  }

  /**
   * Run comprehensive cost optimization analysis
   */
  async runCostOptimization(): Promise<FinOpsApiResponse<{
    totalPotentialSavings: number;
    recommendations: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      potentialSavings: number;
      implementationEffort: string;
      riskLevel: string;
    }>;
  }>> {
    try {
      // This would implement comprehensive cost optimization logic
      // For now, return a placeholder response
      const recommendations = [
        {
          id: 'rec-1',
          type: 'RIGHT_SIZING',
          title: 'Right-size EC2 instances',
          description: 'Several EC2 instances are over-provisioned based on utilization metrics',
          potentialSavings: 1200,
          implementationEffort: 'MEDIUM',
          riskLevel: 'LOW',
        },
        {
          id: 'rec-2',
          type: 'RESERVED_INSTANCES',
          title: 'Purchase Reserved Instances',
          description: 'Save up to 60% on consistent workloads with Reserved Instances',
          potentialSavings: 2400,
          implementationEffort: 'LOW',
          riskLevel: 'LOW',
        },
      ];

      const totalPotentialSavings = recommendations.reduce((sum, rec) => sum + rec.potentialSavings, 0);

      await this.analytics.track('finops.optimization.analyzed', {
        recommendationCount: recommendations.length,
        totalPotentialSavings,
      });

      return {
        success: true,
        data: {
          totalPotentialSavings,
          recommendations,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: this.generateRequestId(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'OPTIMIZATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: this.generateRequestId(),
        },
      };
    }
  }

  /**
   * Get cost estimation for infrastructure changes
   */
  async estimateInfrastructureCost(changes: Array<{
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    resourceType: string;
    configuration: Record<string, any>;
    region: string;
  }>): Promise<FinOpsApiResponse<{
    totalCurrentCost: number;
    totalNewCost: number;
    costDifference: number;
    percentageChange: number;
    breakdown: Array<{
      resourceType: string;
      action: string;
      costImpact: number;
    }>;
  }>> {
    try {
      const estimation = await this.costEstimation.estimateInfrastructureChanges(changes);

      const result = {
        totalCurrentCost: estimation.totalCurrentCost,
        totalNewCost: estimation.totalNewCost,
        costDifference: estimation.costDifference,
        percentageChange: estimation.percentageChange,
        breakdown: estimation.breakdown.map(item => ({
          resourceType: item.change.resourceType,
          action: item.change.type,
          costImpact: item.costDifference,
        })),
      };

      await this.analytics.track('finops.estimation.completed', {
        changeCount: changes.length,
        costDifference: estimation.costDifference,
        percentageChange: estimation.percentageChange,
      });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: this.generateRequestId(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ESTIMATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: this.generateRequestId(),
        },
      };
    }
  }

  /**
   * Get resource tagging manager
   */
  getTaggingManager(): ResourceTaggingManager {
    return this.taggingManager;
  }

  /**
   * Get cost monitoring manager
   */
  getCostMonitoring(): CostMonitoringManager {
    return this.costMonitoring;
  }

  /**
   * Get cost estimation engine
   */
  getCostEstimation(): CostEstimationEngine {
    return this.costEstimation;
  }

  /**
   * Get cost impact analyzer
   */
  getCostAnalyzer(): CostImpactAnalyzer {
    return this.costAnalyzer;
  }

  /**
   * Private helper methods
   */
  private calculateTrend(current: number, previous: number): 'INCREASING' | 'DECREASING' | 'STABLE' {
    if (previous === 0) return 'STABLE';
    const change = ((current - previous) / previous) * 100;
    if (Math.abs(change) < 5) return 'STABLE';
    return change > 0 ? 'INCREASING' : 'DECREASING';
  }

  private generateRequestId(): string {
    return `finops-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
