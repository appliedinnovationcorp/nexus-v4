/**
 * Service Level Objective (SLO) Types and Interfaces
 */

export type SLIType = 
  | 'availability'
  | 'latency'
  | 'throughput'
  | 'error_rate'
  | 'durability'
  | 'correctness'
  | 'freshness'
  | 'coverage'
  | 'quality';

export type TimeWindow = 
  | '1h'
  | '6h'
  | '24h'
  | '7d'
  | '30d'
  | '90d';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type ServiceTier = 'tier-0' | 'tier-1' | 'tier-2' | 'tier-3';

export interface SLI {
  /** Unique identifier for the SLI */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description */
  description: string;
  /** Type of SLI */
  type: SLIType;
  /** Query to calculate the SLI */
  query: string;
  /** Query language (prometheus, datadog, etc.) */
  queryLanguage: 'prometheus' | 'datadog' | 'cloudwatch' | 'grafana';
  /** Unit of measurement */
  unit: string;
  /** Tags for categorization */
  tags: string[];
}

export interface SLO {
  /** Unique identifier for the SLO */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description */
  description: string;
  /** Service this SLO applies to */
  service: string;
  /** Service tier (affects alerting and escalation) */
  tier: ServiceTier;
  /** Associated SLI */
  sli: SLI;
  /** Target percentage (e.g., 99.9) */
  target: number;
  /** Time window for evaluation */
  timeWindow: TimeWindow;
  /** Alert thresholds */
  alerting: {
    /** Burn rate thresholds */
    burnRate: {
      /** Fast burn (short window, high sensitivity) */
      fast: {
        threshold: number;
        window: TimeWindow;
        severity: AlertSeverity;
      };
      /** Slow burn (long window, low sensitivity) */
      slow: {
        threshold: number;
        window: TimeWindow;
        severity: AlertSeverity;
      };
    };
    /** Error budget exhaustion alerts */
    budgetExhaustion: {
      /** Alert when X% of budget is consumed */
      thresholds: Array<{
        percentage: number;
        severity: AlertSeverity;
      }>;
    };
  };
  /** Metadata */
  metadata: {
    /** Owner team */
    owner: string;
    /** Creation date */
    createdAt: string;
    /** Last updated */
    updatedAt: string;
    /** Documentation URL */
    documentation?: string;
    /** Runbook URL */
    runbook?: string;
    /** Tags for categorization */
    tags: string[];
  };
}

export interface ErrorBudget {
  /** Associated SLO ID */
  sloId: string;
  /** Time window */
  timeWindow: TimeWindow;
  /** Total allowed errors in the window */
  totalAllowedErrors: number;
  /** Current error count */
  currentErrors: number;
  /** Remaining error budget */
  remainingBudget: number;
  /** Budget consumption percentage */
  consumptionPercentage: number;
  /** Current burn rate */
  burnRate: number;
  /** Time until budget exhaustion at current rate */
  timeToExhaustion?: string;
  /** Budget status */
  status: 'healthy' | 'warning' | 'critical' | 'exhausted';
  /** Last calculated timestamp */
  lastCalculated: string;
}

export interface SLOReport {
  /** Report ID */
  id: string;
  /** Report period */
  period: {
    start: string;
    end: string;
  };
  /** SLO performance data */
  slos: Array<{
    slo: SLO;
    performance: {
      /** Actual SLI value */
      actualValue: number;
      /** Target value */
      targetValue: number;
      /** Whether target was met */
      targetMet: boolean;
      /** Error budget status */
      errorBudget: ErrorBudget;
    };
  }>;
  /** Summary statistics */
  summary: {
    /** Total SLOs */
    totalSLOs: number;
    /** SLOs meeting target */
    slosMeetingTarget: number;
    /** Overall compliance percentage */
    overallCompliance: number;
    /** Services with budget exhaustion */
    servicesWithExhaustedBudgets: string[];
  };
  /** Generated timestamp */
  generatedAt: string;
}

export interface SLOConfig {
  /** Configuration version */
  version: string;
  /** Global settings */
  global: {
    /** Default time window */
    defaultTimeWindow: TimeWindow;
    /** Default alert settings */
    defaultAlerting: SLO['alerting'];
    /** Monitoring backend */
    monitoringBackend: 'prometheus' | 'datadog' | 'cloudwatch';
    /** Dashboard settings */
    dashboards: {
      /** Auto-generate dashboards */
      autoGenerate: boolean;
      /** Dashboard platform */
      platform: 'grafana' | 'datadog' | 'cloudwatch';
      /** Refresh interval */
      refreshInterval: string;
    };
  };
  /** Service definitions */
  services: Array<{
    /** Service name */
    name: string;
    /** Service tier */
    tier: ServiceTier;
    /** Service description */
    description: string;
    /** Owner team */
    owner: string;
    /** Dependencies */
    dependencies: string[];
    /** SLOs for this service */
    slos: SLO[];
  }>;
}

export interface BurnRateAlert {
  /** Alert ID */
  id: string;
  /** SLO ID */
  sloId: string;
  /** Service name */
  service: string;
  /** Alert type */
  type: 'fast_burn' | 'slow_burn' | 'budget_exhaustion';
  /** Severity */
  severity: AlertSeverity;
  /** Current burn rate */
  burnRate: number;
  /** Threshold that was exceeded */
  threshold: number;
  /** Time window */
  timeWindow: TimeWindow;
  /** Alert message */
  message: string;
  /** Alert status */
  status: 'firing' | 'resolved';
  /** Fired at timestamp */
  firedAt: string;
  /** Resolved at timestamp */
  resolvedAt?: string;
  /** Metadata */
  metadata: {
    /** Error budget remaining */
    errorBudgetRemaining: number;
    /** Time to exhaustion */
    timeToExhaustion?: string;
    /** Runbook URL */
    runbook?: string;
  };
}
