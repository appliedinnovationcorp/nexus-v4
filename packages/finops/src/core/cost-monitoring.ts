import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetDimensionValuesCommand,
  GetUsageReportCommand,
  CreateAnomalyDetectorCommand,
  GetAnomaliesCommand,
  CreateAnomalySubscriptionCommand,
  UpdateAnomalySubscriptionCommand,
  DeleteAnomalyDetectorCommand,
} from '@aws-sdk/client-ce';
import {
  BudgetsClient,
  CreateBudgetCommand,
  UpdateBudgetCommand,
  DeleteBudgetCommand,
  DescribeBudgetsCommand,
  DescribeBudgetActionsForBudgetCommand,
} from '@aws-sdk/client-budgets';
import {
  CostDataPoint,
  CostAlertConfig,
  BudgetConfig,
  CostAnomaly,
  FinOpsConfig,
} from '../types';
import { SecretManager } from '@nexus/secret-management';
import { AnalyticsTracker } from '@nexus/analytics';
import { addDays, format, startOfMonth, endOfMonth } from 'date-fns';

export class CostMonitoringManager {
  private costExplorerClient: CostExplorerClient;
  private budgetsClient: BudgetsClient;
  private secretManager: SecretManager;
  private analytics: AnalyticsTracker;
  private config: FinOpsConfig;

  constructor(config: FinOpsConfig) {
    this.config = config;
    this.costExplorerClient = new CostExplorerClient({
      region: config.aws.region,
    });
    this.budgetsClient = new BudgetsClient({
      region: config.aws.region,
    });
    this.secretManager = new SecretManager();
    this.analytics = new AnalyticsTracker();
  }

  /**
   * Get cost and usage data
   */
  async getCostAndUsage(options: {
    startDate: string;
    endDate: string;
    granularity: 'DAILY' | 'MONTHLY' | 'HOURLY';
    groupBy?: Array<{
      type: 'DIMENSION' | 'TAG';
      key: string;
    }>;
    filters?: {
      dimensions?: Record<string, string[]>;
      tags?: Record<string, string[]>;
    };
    metrics?: string[];
  }): Promise<CostDataPoint[]> {
    try {
      const command = new GetCostAndUsageCommand({
        TimePeriod: {
          Start: options.startDate,
          End: options.endDate,
        },
        Granularity: options.granularity,
        Metrics: options.metrics || ['BlendedCost', 'UnblendedCost', 'UsageQuantity'],
        GroupBy: options.groupBy?.map(group => ({
          Type: group.type,
          Key: group.key,
        })),
        Filter: this.buildCostFilter(options.filters),
      });

      const response = await this.costExplorerClient.send(command);
      const costDataPoints: CostDataPoint[] = [];

      if (response.ResultsByTime) {
        for (const result of response.ResultsByTime) {
          const timestamp = new Date(result.TimePeriod?.Start || '');
          
          if (result.Groups && result.Groups.length > 0) {
            // Grouped results
            for (const group of result.Groups) {
              const groupKeys = group.Keys || [];
              const metrics = group.Metrics || {};
              
              for (const [metricName, metricData] of Object.entries(metrics)) {
                costDataPoints.push({
                  timestamp,
                  amount: parseFloat(metricData.Amount || '0'),
                  currency: metricData.Unit || 'USD',
                  service: groupKeys.find(key => key.includes('SERVICE'))?.split(':')[1],
                  account: groupKeys.find(key => key.includes('ACCOUNT'))?.split(':')[1],
                  region: groupKeys.find(key => key.includes('REGION'))?.split(':')[1],
                  unblendedCost: metricName === 'UnblendedCost' ? parseFloat(metricData.Amount || '0') : undefined,
                  blendedCost: metricName === 'BlendedCost' ? parseFloat(metricData.Amount || '0') : undefined,
                  usageQuantity: metricName === 'UsageQuantity' ? parseFloat(metricData.Amount || '0') : undefined,
                  usageUnit: metricName === 'UsageQuantity' ? metricData.Unit : undefined,
                });
              }
            }
          } else if (result.Total) {
            // Ungrouped results
            for (const [metricName, metricData] of Object.entries(result.Total)) {
              costDataPoints.push({
                timestamp,
                amount: parseFloat(metricData.Amount || '0'),
                currency: metricData.Unit || 'USD',
                unblendedCost: metricName === 'UnblendedCost' ? parseFloat(metricData.Amount || '0') : undefined,
                blendedCost: metricName === 'BlendedCost' ? parseFloat(metricData.Amount || '0') : undefined,
                usageQuantity: metricName === 'UsageQuantity' ? parseFloat(metricData.Amount || '0') : undefined,
                usageUnit: metricName === 'UsageQuantity' ? metricData.Unit : undefined,
              });
            }
          }
        }
      }

      await this.analytics.track('finops.cost.data_retrieved', {
        startDate: options.startDate,
        endDate: options.endDate,
        granularity: options.granularity,
        dataPointCount: costDataPoints.length,
        totalCost: costDataPoints.reduce((sum, point) => sum + point.amount, 0),
      });

      return costDataPoints;
    } catch (error) {
      await this.analytics.track('finops.cost.data_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        options,
      });
      throw error;
    }
  }

  /**
   * Create cost anomaly detector
   */
  async createAnomalyDetector(config: {
    name: string;
    monitorType: 'DIMENSIONAL' | 'CUSTOM';
    specification: {
      dimension?: string;
      matchOptions?: string[];
      values?: string[];
    };
    threshold?: number;
  }): Promise<string> {
    try {
      const command = new CreateAnomalyDetectorCommand({
        AnomalyDetectorName: config.name,
        MonitorType: config.monitorType,
        MonitorSpecification: {
          DimensionKey: config.specification.dimension,
          MatchOptions: config.specification.matchOptions,
          Values: config.specification.values,
        },
      });

      const response = await this.costExplorerClient.send(command);
      const detectorArn = response.AnomalyDetectorArn;

      if (!detectorArn) {
        throw new Error('Failed to create anomaly detector');
      }

      await this.analytics.track('finops.anomaly.detector_created', {
        detectorArn,
        name: config.name,
        monitorType: config.monitorType,
      });

      return detectorArn;
    } catch (error) {
      await this.analytics.track('finops.anomaly.detector_creation_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        config,
      });
      throw error;
    }
  }

  /**
   * Get cost anomalies
   */
  async getCostAnomalies(options: {
    startDate: string;
    endDate: string;
    monitorArn?: string;
    maxResults?: number;
  }): Promise<CostAnomaly[]> {
    try {
      const command = new GetAnomaliesCommand({
        DateInterval: {
          StartDate: options.startDate,
          EndDate: options.endDate,
        },
        MonitorArn: options.monitorArn,
        MaxResults: options.maxResults || 100,
      });

      const response = await this.costExplorerClient.send(command);
      const anomalies: CostAnomaly[] = [];

      if (response.Anomalies) {
        for (const anomaly of response.Anomalies) {
          const costAnomaly: CostAnomaly = {
            id: anomaly.AnomalyId || '',
            service: anomaly.DimensionValue || 'Unknown',
            account: anomaly.MonitorArn?.split(':')[4] || 'Unknown',
            actualCost: parseFloat(anomaly.Impact?.TotalImpact || '0'),
            expectedCost: parseFloat(anomaly.Impact?.TotalImpact || '0') - parseFloat(anomaly.Impact?.TotalImpact || '0'),
            variance: parseFloat(anomaly.Impact?.TotalImpact || '0'),
            variancePercentage: 0, // Calculate based on actual vs expected
            detectedAt: new Date(),
            startDate: anomaly.AnomalyStartDate || '',
            endDate: anomaly.AnomalyEndDate || '',
            severity: this.calculateSeverity(parseFloat(anomaly.Impact?.TotalImpact || '0')),
            confidence: parseFloat(anomaly.AnomalyScore?.CurrentScore || '0') / 100,
            anomalyType: 'SPIKE', // Default, could be enhanced
            status: 'OPEN',
            notificationsSent: [],
          };

          anomalies.push(costAnomaly);
        }
      }

      await this.analytics.track('finops.anomaly.retrieved', {
        startDate: options.startDate,
        endDate: options.endDate,
        anomalyCount: anomalies.length,
        totalImpact: anomalies.reduce((sum, anomaly) => sum + anomaly.actualCost, 0),
      });

      return anomalies;
    } catch (error) {
      await this.analytics.track('finops.anomaly.retrieval_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        options,
      });
      throw error;
    }
  }

  /**
   * Create budget
   */
  async createBudget(budgetConfig: BudgetConfig): Promise<void> {
    try {
      const command = new CreateBudgetCommand({
        AccountId: this.config.aws.accountId,
        Budget: {
          BudgetName: budgetConfig.name,
          BudgetLimit: {
            Amount: budgetConfig.budgetLimit.toString(),
            Unit: budgetConfig.currency,
          },
          TimeUnit: budgetConfig.timeUnit,
          TimePeriod: {
            Start: new Date(budgetConfig.timePeriod.start),
            End: budgetConfig.timePeriod.end ? new Date(budgetConfig.timePeriod.end) : undefined,
          },
          BudgetType: budgetConfig.budgetType,
          CostFilters: this.buildBudgetFilters(budgetConfig.costFilters),
        },
        NotificationsWithSubscribers: budgetConfig.alertThresholds.map(threshold => ({
          Notification: {
            NotificationType: 'ACTUAL',
            ComparisonOperator: threshold.comparisonOperator,
            Threshold: threshold.threshold,
            ThresholdType: threshold.thresholdType,
            NotificationState: threshold.notificationState,
          },
          Subscribers: threshold.subscribers.map(email => ({
            SubscriptionType: 'EMAIL',
            Address: email,
          })),
        })),
      });

      await this.budgetsClient.send(command);

      await this.analytics.track('finops.budget.created', {
        budgetId: budgetConfig.id,
        budgetName: budgetConfig.name,
        budgetLimit: budgetConfig.budgetLimit,
        currency: budgetConfig.currency,
        alertThresholds: budgetConfig.alertThresholds.length,
      });
    } catch (error) {
      await this.analytics.track('finops.budget.creation_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        budgetConfig: budgetConfig.name,
      });
      throw error;
    }
  }

  /**
   * Update budget
   */
  async updateBudget(budgetConfig: BudgetConfig): Promise<void> {
    try {
      const command = new UpdateBudgetCommand({
        AccountId: this.config.aws.accountId,
        NewBudget: {
          BudgetName: budgetConfig.name,
          BudgetLimit: {
            Amount: budgetConfig.budgetLimit.toString(),
            Unit: budgetConfig.currency,
          },
          TimeUnit: budgetConfig.timeUnit,
          TimePeriod: {
            Start: new Date(budgetConfig.timePeriod.start),
            End: budgetConfig.timePeriod.end ? new Date(budgetConfig.timePeriod.end) : undefined,
          },
          BudgetType: budgetConfig.budgetType,
          CostFilters: this.buildBudgetFilters(budgetConfig.costFilters),
        },
      });

      await this.budgetsClient.send(command);

      await this.analytics.track('finops.budget.updated', {
        budgetId: budgetConfig.id,
        budgetName: budgetConfig.name,
      });
    } catch (error) {
      await this.analytics.track('finops.budget.update_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        budgetConfig: budgetConfig.name,
      });
      throw error;
    }
  }

  /**
   * Get budget status and spending
   */
  async getBudgetStatus(budgetName: string): Promise<{
    budgetLimit: number;
    actualSpend: number;
    forecastedSpend: number;
    percentageUsed: number;
    remainingBudget: number;
    isOverBudget: boolean;
    daysRemaining: number;
  }> {
    try {
      const command = new DescribeBudgetsCommand({
        AccountId: this.config.aws.accountId,
        BudgetNames: [budgetName],
      });

      const response = await this.budgetsClient.send(command);
      const budget = response.Budgets?.[0];

      if (!budget) {
        throw new Error(`Budget ${budgetName} not found`);
      }

      const budgetLimit = parseFloat(budget.BudgetLimit?.Amount || '0');
      const actualSpend = parseFloat(budget.CalculatedSpend?.ActualSpend?.Amount || '0');
      const forecastedSpend = parseFloat(budget.CalculatedSpend?.ForecastedSpend?.Amount || '0');
      const percentageUsed = budgetLimit > 0 ? (actualSpend / budgetLimit) * 100 : 0;
      const remainingBudget = budgetLimit - actualSpend;
      const isOverBudget = actualSpend > budgetLimit;

      // Calculate days remaining in budget period
      const endDate = budget.TimePeriod?.End || endOfMonth(new Date());
      const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

      const status = {
        budgetLimit,
        actualSpend,
        forecastedSpend,
        percentageUsed,
        remainingBudget,
        isOverBudget,
        daysRemaining,
      };

      await this.analytics.track('finops.budget.status_checked', {
        budgetName,
        percentageUsed,
        isOverBudget,
        daysRemaining,
      });

      return status;
    } catch (error) {
      await this.analytics.track('finops.budget.status_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        budgetName,
      });
      throw error;
    }
  }

  /**
   * Get cost trends and forecasting
   */
  async getCostTrends(options: {
    startDate: string;
    endDate: string;
    granularity: 'DAILY' | 'MONTHLY';
    service?: string;
    includeForecast?: boolean;
  }): Promise<{
    historical: CostDataPoint[];
    forecast?: CostDataPoint[];
    trend: {
      direction: 'INCREASING' | 'DECREASING' | 'STABLE';
      changePercentage: number;
      averageDailyCost: number;
      projectedMonthlyCost: number;
    };
  }> {
    try {
      // Get historical data
      const historical = await this.getCostAndUsage({
        startDate: options.startDate,
        endDate: options.endDate,
        granularity: options.granularity,
        filters: options.service ? {
          dimensions: { SERVICE: [options.service] }
        } : undefined,
      });

      // Calculate trend
      const sortedData = historical.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const firstHalf = sortedData.slice(0, Math.floor(sortedData.length / 2));
      const secondHalf = sortedData.slice(Math.floor(sortedData.length / 2));

      const firstHalfAvg = firstHalf.reduce((sum, point) => sum + point.amount, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, point) => sum + point.amount, 0) / secondHalf.length;

      const changePercentage = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;
      const direction = Math.abs(changePercentage) < 5 ? 'STABLE' : 
                       changePercentage > 0 ? 'INCREASING' : 'DECREASING';

      const totalCost = historical.reduce((sum, point) => sum + point.amount, 0);
      const totalDays = historical.length;
      const averageDailyCost = totalDays > 0 ? totalCost / totalDays : 0;
      const projectedMonthlyCost = averageDailyCost * 30;

      const result = {
        historical,
        trend: {
          direction,
          changePercentage,
          averageDailyCost,
          projectedMonthlyCost,
        },
      };

      await this.analytics.track('finops.cost.trends_analyzed', {
        startDate: options.startDate,
        endDate: options.endDate,
        service: options.service,
        trendDirection: direction,
        changePercentage,
        projectedMonthlyCost,
      });

      return result;
    } catch (error) {
      await this.analytics.track('finops.cost.trends_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        options,
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private buildCostFilter(filters?: {
    dimensions?: Record<string, string[]>;
    tags?: Record<string, string[]>;
  }): any {
    if (!filters) return undefined;

    const filterExpressions: any[] = [];

    // Add dimension filters
    if (filters.dimensions) {
      for (const [key, values] of Object.entries(filters.dimensions)) {
        filterExpressions.push({
          Dimensions: {
            Key: key,
            Values: values,
          },
        });
      }
    }

    // Add tag filters
    if (filters.tags) {
      for (const [key, values] of Object.entries(filters.tags)) {
        filterExpressions.push({
          Tags: {
            Key: key,
            Values: values,
          },
        });
      }
    }

    if (filterExpressions.length === 0) return undefined;
    if (filterExpressions.length === 1) return filterExpressions[0];

    return {
      And: filterExpressions,
    };
  }

  private buildBudgetFilters(filters?: {
    dimensions?: Record<string, string[]>;
    tags?: Record<string, string[]>;
    services?: string[];
    accounts?: string[];
  }): any {
    if (!filters) return undefined;

    const budgetFilters: any = {};

    if (filters.dimensions) {
      budgetFilters.Dimensions = filters.dimensions;
    }

    if (filters.tags) {
      budgetFilters.Tags = filters.tags;
    }

    if (filters.services) {
      budgetFilters.Services = filters.services;
    }

    if (filters.accounts) {
      budgetFilters.Accounts = filters.accounts;
    }

    return Object.keys(budgetFilters).length > 0 ? budgetFilters : undefined;
  }

  private calculateSeverity(impact: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (impact < 100) return 'LOW';
    if (impact < 500) return 'MEDIUM';
    if (impact < 1000) return 'HIGH';
    return 'CRITICAL';
  }
}
