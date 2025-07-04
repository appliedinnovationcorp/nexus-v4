import { z } from 'zod';

/**
 * Chaos experiment configuration
 */
export const ChaosExperimentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  
  // Experiment metadata
  version: z.string().default('1.0.0'),
  tags: z.array(z.string()).default([]),
  
  // Environment and targeting
  environment: z.enum(['staging', 'production', 'development']),
  targetSelector: z.object({
    type: z.enum(['service', 'instance', 'container', 'lambda', 'database']),
    filters: z.record(z.any()),
    percentage: z.number().min(0).max(100).default(100),
    maxTargets: z.number().positive().optional(),
  }),
  
  // Failure injection configuration
  faultType: z.enum([
    'cpu_stress',
    'memory_stress',
    'disk_stress',
    'network_latency',
    'network_loss',
    'network_corruption',
    'service_shutdown',
    'process_kill',
    'disk_fill',
    'dns_failure',
    'dependency_failure',
    'database_connection_failure',
    'lambda_timeout',
    'lambda_error',
    'container_kill',
    'pod_kill'
  ]),
  
  faultParameters: z.record(z.any()),
  
  // Timing configuration
  duration: z.number().positive(), // seconds
  delay: z.number().min(0).default(0), // seconds before starting
  
  // Safety and rollback
  steadyStateHypothesis: z.object({
    title: z.string(),
    probes: z.array(z.object({
      name: z.string(),
      type: z.enum(['http', 'metric', 'log', 'custom']),
      configuration: z.record(z.any()),
      tolerance: z.record(z.any()),
    })),
  }),
  
  rollbackStrategy: z.object({
    automatic: z.boolean().default(true),
    conditions: z.array(z.object({
      type: z.enum(['metric_threshold', 'error_rate', 'response_time', 'custom']),
      configuration: z.record(z.any()),
    })),
    actions: z.array(z.object({
      type: z.enum(['stop_experiment', 'alert', 'scale_up', 'failover']),
      configuration: z.record(z.any()),
    })),
  }),
  
  // Scheduling
  schedule: z.object({
    enabled: z.boolean().default(false),
    cron: z.string().optional(),
    timezone: z.string().default('UTC'),
    maxConcurrentRuns: z.number().positive().default(1),
  }).optional(),
  
  // Notifications
  notifications: z.object({
    onStart: z.array(z.string()).default([]),
    onComplete: z.array(z.string()).default([]),
    onFailure: z.array(z.string()).default([]),
    onRollback: z.array(z.string()).default([]),
  }),
  
  // Metadata
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  enabled: z.boolean().default(true),
});

export type ChaosExperiment = z.infer<typeof ChaosExperimentSchema>;

/**
 * Chaos experiment execution
 */
export const ChaosExecutionSchema = z.object({
  id: z.string(),
  experimentId: z.string(),
  
  // Execution metadata
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled', 'rolled_back']),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  duration: z.number().optional(), // actual duration in seconds
  
  // Target information
  targets: z.array(z.object({
    id: z.string(),
    type: z.string(),
    metadata: z.record(z.any()),
    status: z.enum(['targeted', 'affected', 'recovered', 'failed']),
  })),
  
  // Execution phases
  phases: z.array(z.object({
    name: z.string(),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
    startedAt: z.date().optional(),
    completedAt: z.date().optional(),
    logs: z.array(z.object({
      timestamp: z.date(),
      level: z.enum(['debug', 'info', 'warn', 'error']),
      message: z.string(),
      metadata: z.record(z.any()).optional(),
    })),
  })),
  
  // Steady state validation
  steadyStateResults: z.object({
    before: z.array(z.object({
      probe: z.string(),
      status: z.enum(['passed', 'failed', 'error']),
      value: z.any(),
      tolerance: z.any(),
      timestamp: z.date(),
    })),
    during: z.array(z.object({
      probe: z.string(),
      status: z.enum(['passed', 'failed', 'error']),
      value: z.any(),
      tolerance: z.any(),
      timestamp: z.date(),
    })),
    after: z.array(z.object({
      probe: z.string(),
      status: z.enum(['passed', 'failed', 'error']),
      value: z.any(),
      tolerance: z.any(),
      timestamp: z.date(),
    })),
  }),
  
  // Metrics and observations
  metrics: z.array(z.object({
    name: z.string(),
    value: z.number(),
    unit: z.string(),
    timestamp: z.date(),
    tags: z.record(z.string()).optional(),
  })),
  
  // Error and rollback information
  error: z.object({
    message: z.string(),
    code: z.string(),
    details: z.record(z.any()).optional(),
  }).optional(),
  
  rollbackTriggered: z.boolean().default(false),
  rollbackReason: z.string().optional(),
  
  // Results and insights
  results: z.object({
    hypothesis: z.enum(['confirmed', 'refuted', 'inconclusive']),
    insights: z.array(z.string()),
    recommendations: z.array(z.string()),
    weaknessesFound: z.array(z.object({
      type: z.string(),
      description: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      impact: z.string(),
      recommendation: z.string(),
    })),
  }),
});

export type ChaosExecution = z.infer<typeof ChaosExecutionSchema>;

/**
 * Chaos engineering configuration
 */
export const ChaosConfigSchema = z.object({
  // Global settings
  global: z.object({
    enabled: z.boolean().default(true),
    dryRun: z.boolean().default(false),
    maxConcurrentExperiments: z.number().positive().default(3),
    defaultTimeout: z.number().positive().default(300), // seconds
  }),
  
  // Environment settings
  environments: z.record(z.object({
    enabled: z.boolean(),
    approvalRequired: z.boolean(),
    maxImpactLevel: z.enum(['low', 'medium', 'high']),
    allowedFaultTypes: z.array(z.string()),
    businessHours: z.object({
      enabled: z.boolean(),
      timezone: z.string(),
      start: z.string(), // HH:MM format
      end: z.string(),   // HH:MM format
      days: z.array(z.number().min(0).max(6)), // 0=Sunday, 6=Saturday
    }).optional(),
  })),
  
  // AWS configuration
  aws: z.object({
    region: z.string(),
    assumeRoleArn: z.string().optional(),
    tags: z.record(z.string()).optional(),
  }),
  
  // Monitoring and observability
  monitoring: z.object({
    prometheus: z.object({
      enabled: z.boolean(),
      endpoint: z.string().optional(),
      pushgateway: z.string().optional(),
    }).optional(),
    
    cloudwatch: z.object({
      enabled: z.boolean(),
      namespace: z.string().default('ChaosEngineering'),
    }).optional(),
    
    customMetrics: z.array(z.object({
      name: z.string(),
      query: z.string(),
      datasource: z.string(),
    })).optional(),
  }),
  
  // Safety mechanisms
  safety: z.object({
    circuitBreaker: z.object({
      enabled: z.boolean().default(true),
      failureThreshold: z.number().positive().default(3),
      recoveryTimeout: z.number().positive().default(300), // seconds
    }),
    
    rateLimiting: z.object({
      enabled: z.boolean().default(true),
      maxExperimentsPerHour: z.number().positive().default(10),
      maxExperimentsPerDay: z.number().positive().default(50),
    }),
    
    blastRadius: z.object({
      maxTargetPercentage: z.number().min(0).max(100).default(25),
      maxTargetCount: z.number().positive().default(10),
    }),
  }),
  
  // Notifications
  notifications: z.object({
    slack: z.object({
      enabled: z.boolean(),
      webhookUrl: z.string().optional(),
      channels: z.record(z.string()).optional(),
    }).optional(),
    
    email: z.object({
      enabled: z.boolean(),
      recipients: z.array(z.string().email()).optional(),
    }).optional(),
    
    webhook: z.object({
      enabled: z.boolean(),
      endpoints: z.array(z.object({
        name: z.string(),
        url: z.string(),
        headers: z.record(z.string()).optional(),
      })).optional(),
    }).optional(),
  }),
  
  // Integration settings
  integrations: z.object({
    gremlin: z.object({
      enabled: z.boolean(),
      apiKey: z.string().optional(),
      teamId: z.string().optional(),
    }).optional(),
    
    litmus: z.object({
      enabled: z.boolean(),
      endpoint: z.string().optional(),
      namespace: z.string().optional(),
    }).optional(),
    
    chaosMonkey: z.object({
      enabled: z.boolean(),
      configuration: z.record(z.any()).optional(),
    }).optional(),
  }),
});

export type ChaosConfig = z.infer<typeof ChaosConfigSchema>;

/**
 * Fault injection types and parameters
 */
export interface FaultInjectionConfig {
  cpu_stress: {
    percentage: number; // 0-100
    duration: number;   // seconds
    workers?: number;
  };
  
  memory_stress: {
    percentage: number; // 0-100
    duration: number;   // seconds
    fillMemory?: boolean;
  };
  
  disk_stress: {
    path: string;
    size: string;       // e.g., "1GB", "500MB"
    duration: number;   // seconds
  };
  
  network_latency: {
    delay: number;      // milliseconds
    jitter?: number;    // milliseconds
    correlation?: number; // 0-100
    duration: number;   // seconds
    interfaces?: string[];
  };
  
  network_loss: {
    percentage: number; // 0-100
    correlation?: number; // 0-100
    duration: number;   // seconds
    interfaces?: string[];
  };
  
  network_corruption: {
    percentage: number; // 0-100
    duration: number;   // seconds
    interfaces?: string[];
  };
  
  service_shutdown: {
    serviceName: string;
    graceful: boolean;
    duration: number;   // seconds
  };
  
  process_kill: {
    processName: string;
    signal: string;     // e.g., "SIGTERM", "SIGKILL"
    killChildren?: boolean;
  };
  
  disk_fill: {
    path: string;
    size: string;       // e.g., "1GB", "90%"
    duration: number;   // seconds
  };
  
  dns_failure: {
    domains: string[];
    duration: number;   // seconds
  };
  
  dependency_failure: {
    service: string;
    endpoint?: string;
    statusCode?: number;
    duration: number;   // seconds
  };
  
  database_connection_failure: {
    database: string;
    connectionString?: string;
    duration: number;   // seconds
  };
  
  lambda_timeout: {
    functionName: string;
    timeoutMs: number;
  };
  
  lambda_error: {
    functionName: string;
    errorType: string;
    errorMessage: string;
  };
  
  container_kill: {
    containerName?: string;
    containerId?: string;
    signal: string;
  };
  
  pod_kill: {
    namespace: string;
    podName?: string;
    labelSelector?: string;
  };
}

/**
 * Probe configurations for steady state validation
 */
export interface ProbeConfig {
  http: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    timeout: number;
    expectedStatus: number;
    expectedBody?: string;
  };
  
  metric: {
    query: string;
    datasource: string;
    threshold: number;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  };
  
  log: {
    query: string;
    source: string;
    expectedCount: number;
    timeWindow: number; // seconds
  };
  
  custom: {
    script: string;
    timeout: number;
    expectedExitCode: number;
  };
}

/**
 * Chaos engineering metrics
 */
export interface ChaosMetrics {
  experimentsTotal: number;
  experimentsSuccessful: number;
  experimentsFailed: number;
  experimentsRolledBack: number;
  averageExecutionTime: number;
  weaknessesFound: number;
  mttr: number; // Mean Time To Recovery
  blastRadiusAverage: number;
  confidenceScore: number; // 0-100
}

/**
 * System resilience assessment
 */
export interface ResilienceAssessment {
  overallScore: number; // 0-100
  categories: {
    availability: {
      score: number;
      findings: string[];
      recommendations: string[];
    };
    performance: {
      score: number;
      findings: string[];
      recommendations: string[];
    };
    scalability: {
      score: number;
      findings: string[];
      recommendations: string[];
    };
    security: {
      score: number;
      findings: string[];
      recommendations: string[];
    };
    observability: {
      score: number;
      findings: string[];
      recommendations: string[];
    };
  };
  trends: {
    period: string;
    scoreChange: number;
    improvementAreas: string[];
  };
  nextSteps: string[];
}

/**
 * API response types
 */
export interface ChaosApiResponse<T = any> {
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
    executionId?: string;
  };
}

/**
 * Event types for chaos engineering
 */
export type ChaosEvent = 
  | { type: 'experiment_started'; payload: { experimentId: string; executionId: string } }
  | { type: 'experiment_completed'; payload: { experimentId: string; executionId: string; status: string } }
  | { type: 'experiment_failed'; payload: { experimentId: string; executionId: string; error: string } }
  | { type: 'rollback_triggered'; payload: { experimentId: string; executionId: string; reason: string } }
  | { type: 'weakness_found'; payload: { experimentId: string; weakness: any } }
  | { type: 'steady_state_violated'; payload: { experimentId: string; probe: string; value: any } };
