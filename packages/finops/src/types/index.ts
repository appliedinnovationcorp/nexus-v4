import { z } from 'zod';

/**
 * Standard resource tags schema
 */
export const ResourceTagSchema = z.object({
  // Required tags
  Environment: z.enum(['production', 'staging', 'development', 'test']),
  Project: z.string().min(1),
  Owner: z.string().email(),
  CostCenter: z.string().min(1),
  
  // Optional but recommended tags
  Application: z.string().optional(),
  Component: z.string().optional(),
  Version: z.string().optional(),
  CreatedBy: z.string().optional(),
  CreatedDate: z.string().optional(),
  
  // Business tags
  BusinessUnit: z.string().optional(),
  Department: z.string().optional(),
  Team: z.string().optional(),
  
  // Operational tags
  BackupRequired: z.enum(['true', 'false']).optional(),
  MonitoringLevel: z.enum(['basic', 'standard', 'enhanced']).optional(),
  MaintenanceWindow: z.string().optional(),
  
  // Cost optimization tags
  AutoShutdown: z.enum(['true', 'false']).optional(),
  RightSizing: z.enum(['enabled', 'disabled']).optional(),
  
  // Custom tags (key-value pairs)
  [key: string]: string | undefined,
});

export type ResourceTags = z.infer<typeof ResourceTagSchema>;

/**
 * Cost alert configuration
 */
export const CostAlertConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  
  // Alert conditions
  threshold: z.number().positive(),
  thresholdType: z.enum(['ABSOLUTE_VALUE', 'PERCENTAGE']),
  comparisonOperator: z.enum(['GREATER_THAN', 'LESS_THAN', 'EQUAL_TO']),
  
  // Time period
  timeUnit: z.enum(['DAILY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']),
  timePeriod: z.object({
    start: z.string(),
    end: z.string().optional(),
  }),
  
  // Filters
  costFilters: z.object({
    dimensions: z.record(z.array(z.string())).optional(),
    tags: z.record(z.array(z.string())).optional(),
    services: z.array(z.string()).optional(),
    accounts: z.array(z.string()).optional(),
  }).optional(),
  
  // Notification settings
  subscribers: z.array(z.string().email()),
  notificationChannels: z.array(z.enum(['email', 'slack', 'webhook'])),
  
  // Alert state
  enabled: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CostAlertConfig = z.infer<typeof CostAlertConfigSchema>;

/**
 * Cost data point
 */
export const CostDataPointSchema = z.object({
  timestamp: z.date(),
  amount: z.number(),
  currency: z.string().default('USD'),
  service: z.string().optional(),
  account: z.string().optional(),
  region: z.string().optional(),
  tags: z.record(z.string()).optional(),
  
  // Cost breakdown
  unblendedCost: z.number().optional(),
  blendedCost: z.number().optional(),
  netUnblendedCost: z.number().optional(),
  
  // Usage metrics
  usageQuantity: z.number().optional(),
  usageUnit: z.string().optional(),
});

export type CostDataPoint = z.infer<typeof CostDataPointSchema>;

/**
 * Cost report configuration
 */
export const CostReportConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  
  // Report settings
  granularity: z.enum(['DAILY', 'MONTHLY', 'HOURLY']),
  groupBy: z.array(z.enum(['SERVICE', 'ACCOUNT', 'REGION', 'INSTANCE_TYPE', 'TAG'])),
  metrics: z.array(z.enum(['BlendedCost', 'UnblendedCost', 'NetUnblendedCost', 'UsageQuantity'])),
  
  // Filters
  filters: z.object({
    dimensions: z.record(z.array(z.string())).optional(),
    tags: z.record(z.array(z.string())).optional(),
    services: z.array(z.string()).optional(),
    accounts: z.array(z.string()).optional(),
  }).optional(),
  
  // Schedule
  schedule: z.object({
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
    dayOfWeek: z.number().min(0).max(6).optional(),
    dayOfMonth: z.number().min(1).max(31).optional(),
    time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  }),
  
  // Output settings
  format: z.enum(['JSON', 'CSV', 'PARQUET']),
  s3Bucket: z.string().optional(),
  s3Prefix: z.string().optional(),
  
  // Recipients
  recipients: z.array(z.string().email()),
  
  enabled: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CostReportConfig = z.infer<typeof CostReportConfigSchema>;

/**
 * Resource cost estimation
 */
export const ResourceCostEstimateSchema = z.object({
  resourceType: z.string(),
  resourceId: z.string().optional(),
  region: z.string(),
  
  // Cost estimates
  hourlyRate: z.number(),
  dailyCost: z.number(),
  monthlyCost: z.number(),
  annualCost: z.number(),
  
  // Configuration details
  instanceType: z.string().optional(),
  storageSize: z.number().optional(),
  storageType: z.string().optional(),
  
  // Usage assumptions
  utilizationRate: z.number().min(0).max(1).default(1),
  hoursPerDay: z.number().min(0).max(24).default(24),
  daysPerMonth: z.number().min(0).max(31).default(30),
  
  // Additional costs
  dataTransferCost: z.number().optional(),
  storageCost: z.number().optional(),
  additionalServices: z.array(z.object({
    service: z.string(),
    cost: z.number(),
  })).optional(),
  
  // Metadata
  estimatedAt: z.date(),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  notes: z.string().optional(),
});

export type ResourceCostEstimate = z.infer<typeof ResourceCostEstimateSchema>;

/**
 * Cost optimization recommendation
 */
export const CostOptimizationRecommendationSchema = z.object({
  id: z.string(),
  type: z.enum([
    'RIGHT_SIZING',
    'RESERVED_INSTANCES',
    'SPOT_INSTANCES',
    'STORAGE_OPTIMIZATION',
    'UNUSED_RESOURCES',
    'SCHEDULED_SCALING',
    'ARCHITECTURE_OPTIMIZATION'
  ]),
  
  // Resource details
  resourceId: z.string(),
  resourceType: z.string(),
  service: z.string(),
  region: z.string(),
  account: z.string(),
  
  // Cost impact
  currentMonthlyCost: z.number(),
  estimatedMonthlyCost: z.number(),
  potentialSavings: z.number(),
  savingsPercentage: z.number(),
  
  // Recommendation details
  title: z.string(),
  description: z.string(),
  actionRequired: z.string(),
  implementationEffort: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  
  // Status
  status: z.enum(['OPEN', 'IN_PROGRESS', 'IMPLEMENTED', 'DISMISSED']).default('OPEN'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  
  // Metadata
  generatedAt: z.date(),
  lastUpdated: z.date(),
  implementedAt: z.date().optional(),
  dismissedAt: z.date().optional(),
  dismissalReason: z.string().optional(),
});

export type CostOptimizationRecommendation = z.infer<typeof CostOptimizationRecommendationSchema>;

/**
 * Budget configuration
 */
export const BudgetConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  
  // Budget amount
  budgetLimit: z.number().positive(),
  currency: z.string().default('USD'),
  
  // Time period
  timeUnit: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY']),
  timePeriod: z.object({
    start: z.string(),
    end: z.string().optional(),
  }),
  
  // Budget type
  budgetType: z.enum(['COST', 'USAGE', 'RI_COVERAGE', 'RI_UTILIZATION', 'SAVINGS_PLANS_COVERAGE', 'SAVINGS_PLANS_UTILIZATION']),
  
  // Filters
  costFilters: z.object({
    dimensions: z.record(z.array(z.string())).optional(),
    tags: z.record(z.array(z.string())).optional(),
    services: z.array(z.string()).optional(),
    accounts: z.array(z.string()).optional(),
  }).optional(),
  
  // Alert thresholds
  alertThresholds: z.array(z.object({
    threshold: z.number().min(0).max(100),
    thresholdType: z.enum(['PERCENTAGE', 'ABSOLUTE_VALUE']),
    comparisonOperator: z.enum(['GREATER_THAN', 'EQUAL_TO']),
    notificationState: z.enum(['OK', 'ALARM']),
    subscribers: z.array(z.string().email()),
  })),
  
  // Auto-adjustment
  autoAdjustData: z.object({
    autoAdjustType: z.enum(['HISTORICAL', 'FORECAST']),
    historicalOptions: z.object({
      budgetAdjustmentPeriod: z.number().positive(),
      lookBackAvailablePeriods: z.number().positive(),
    }).optional(),
  }).optional(),
  
  enabled: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type BudgetConfig = z.infer<typeof BudgetConfigSchema>;

/**
 * Cost anomaly detection
 */
export const CostAnomalySchema = z.object({
  id: z.string(),
  
  // Anomaly details
  service: z.string(),
  account: z.string(),
  region: z.string().optional(),
  
  // Cost information
  actualCost: z.number(),
  expectedCost: z.number(),
  variance: z.number(),
  variancePercentage: z.number(),
  
  // Time information
  detectedAt: z.date(),
  startDate: z.string(),
  endDate: z.string(),
  
  // Anomaly characteristics
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  confidence: z.number().min(0).max(1),
  anomalyType: z.enum(['SPIKE', 'DROP', 'TREND_CHANGE', 'SEASONAL']),
  
  // Root cause analysis
  rootCause: z.object({
    category: z.enum(['USAGE_INCREASE', 'PRICING_CHANGE', 'NEW_RESOURCES', 'CONFIGURATION_CHANGE', 'UNKNOWN']),
    description: z.string(),
    contributingFactors: z.array(z.string()),
  }).optional(),
  
  // Status
  status: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE']).default('OPEN'),
  assignedTo: z.string().optional(),
  resolution: z.string().optional(),
  resolvedAt: z.date().optional(),
  
  // Notifications
  notificationsSent: z.array(z.object({
    channel: z.string(),
    sentAt: z.date(),
    recipient: z.string(),
  })),
});

export type CostAnomaly = z.infer<typeof CostAnomalySchema>;

/**
 * FinOps dashboard configuration
 */
export const FinOpsDashboardConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  
  // Dashboard layout
  widgets: z.array(z.object({
    id: z.string(),
    type: z.enum(['COST_TREND', 'BUDGET_STATUS', 'TOP_SERVICES', 'RECOMMENDATIONS', 'ANOMALIES', 'SAVINGS_OPPORTUNITIES']),
    title: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }),
    config: z.record(z.any()),
  })),
  
  // Access control
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'TEAM']),
  allowedUsers: z.array(z.string().email()).optional(),
  allowedTeams: z.array(z.string()).optional(),
  
  // Refresh settings
  autoRefresh: z.boolean().default(true),
  refreshInterval: z.number().positive().default(300), // seconds
  
  createdBy: z.string().email(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type FinOpsDashboardConfig = z.infer<typeof FinOpsDashboardConfigSchema>;

/**
 * API response types
 */
export interface FinOpsApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

/**
 * Configuration interfaces
 */
export interface FinOpsConfig {
  aws: {
    region: string;
    accountId?: string;
    organizationId?: string;
    costExplorerEnabled: boolean;
    budgetsEnabled: boolean;
  };
  
  tagging: {
    enforceRequiredTags: boolean;
    requiredTags: string[];
    tagValidationRules: Record<string, RegExp>;
    autoTagging: {
      enabled: boolean;
      defaultTags: Partial<ResourceTags>;
    };
  };
  
  costMonitoring: {
    anomalyDetection: {
      enabled: boolean;
      sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
      minimumImpact: number;
    };
    
    budgetAlerts: {
      enabled: boolean;
      defaultThresholds: number[];
      escalationRules: Array<{
        threshold: number;
        recipients: string[];
        channels: string[];
      }>;
    };
  };
  
  optimization: {
    autoRecommendations: boolean;
    recommendationTypes: string[];
    implementationApproval: 'AUTOMATIC' | 'MANUAL' | 'WORKFLOW';
  };
  
  reporting: {
    defaultCurrency: string;
    timezone: string;
    retentionPeriod: number; // days
    exportFormats: string[];
  };
  
  notifications: {
    slack: {
      enabled: boolean;
      webhookUrl?: string;
      channels: Record<string, string>;
    };
    
    email: {
      enabled: boolean;
      smtpConfig?: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
          user: string;
          pass: string;
        };
      };
    };
    
    webhook: {
      enabled: boolean;
      endpoints: Array<{
        name: string;
        url: string;
        headers?: Record<string, string>;
      }>;
    };
  };
}
