import { z } from 'zod';

/**
 * WCAG Compliance Levels
 */
export type WCAGLevel = 'A' | 'AA' | 'AAA';

/**
 * Accessibility audit configuration
 */
export const AccessibilityConfigSchema = z.object({
  // WCAG compliance settings
  wcagLevel: z.enum(['A', 'AA', 'AAA']).default('AA'),
  includeExperimental: z.boolean().default(false),
  
  // Audit tools configuration
  tools: z.object({
    axe: z.object({
      enabled: z.boolean().default(true),
      rules: z.record(z.enum(['enabled', 'disabled', 'warning'])).optional(),
      tags: z.array(z.string()).optional(),
    }),
    lighthouse: z.object({
      enabled: z.boolean().default(true),
      categories: z.array(z.enum(['accessibility', 'performance', 'best-practices', 'seo'])).default(['accessibility']),
      threshold: z.number().min(0).max(100).default(90),
    }),
    pa11y: z.object({
      enabled: z.boolean().default(true),
      standard: z.enum(['WCAG2A', 'WCAG2AA', 'WCAG2AAA']).default('WCAG2AA'),
      includeNotices: z.boolean().default(false),
      includeWarnings: z.boolean().default(true),
    }),
  }),
  
  // Target configuration
  targets: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    viewport: z.object({
      width: z.number().default(1920),
      height: z.number().default(1080),
    }).optional(),
    authentication: z.object({
      type: z.enum(['none', 'basic', 'bearer', 'cookie']),
      credentials: z.record(z.string()).optional(),
    }).optional(),
    waitFor: z.object({
      selector: z.string().optional(),
      timeout: z.number().default(5000),
    }).optional(),
  })),
  
  // Reporting configuration
  reporting: z.object({
    formats: z.array(z.enum(['json', 'html', 'csv', 'junit'])).default(['json', 'html']),
    outputDir: z.string().default('./accessibility-reports'),
    includeScreenshots: z.boolean().default(true),
    generateSummary: z.boolean().default(true),
  }),
  
  // Quality gates
  qualityGates: z.object({
    failOnViolations: z.boolean().default(true),
    maxViolations: z.object({
      critical: z.number().default(0),
      serious: z.number().default(0),
      moderate: z.number().default(5),
      minor: z.number().default(10),
    }),
    minScore: z.number().min(0).max(100).default(90),
  }),
});

export type AccessibilityConfig = z.infer<typeof AccessibilityConfigSchema>;

/**
 * Accessibility violation
 */
export const AccessibilityViolationSchema = z.object({
  id: z.string(),
  impact: z.enum(['minor', 'moderate', 'serious', 'critical']),
  tags: z.array(z.string()),
  description: z.string(),
  help: z.string(),
  helpUrl: z.string(),
  
  // Location information
  nodes: z.array(z.object({
    target: z.array(z.string()),
    html: z.string(),
    failureSummary: z.string().optional(),
    element: z.string().optional(),
  })),
  
  // WCAG information
  wcag: z.object({
    level: z.enum(['A', 'AA', 'AAA']),
    criteria: z.array(z.string()),
    techniques: z.array(z.string()).optional(),
  }).optional(),
});

export type AccessibilityViolation = z.infer<typeof AccessibilityViolationSchema>;

/**
 * Accessibility audit result
 */
export const AccessibilityAuditResultSchema = z.object({
  id: z.string(),
  url: z.string(),
  timestamp: z.date(),
  
  // Tool results
  axeResults: z.object({
    violations: z.array(AccessibilityViolationSchema),
    passes: z.array(z.object({
      id: z.string(),
      description: z.string(),
      nodes: z.array(z.object({
        target: z.array(z.string()),
        html: z.string(),
      })),
    })),
    incomplete: z.array(AccessibilityViolationSchema),
    inapplicable: z.array(z.object({
      id: z.string(),
      description: z.string(),
    })),
  }).optional(),
  
  lighthouseResults: z.object({
    score: z.number().min(0).max(100),
    audits: z.record(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      score: z.number().nullable(),
      scoreDisplayMode: z.string(),
      displayValue: z.string().optional(),
      details: z.any().optional(),
    })),
  }).optional(),
  
  pa11yResults: z.object({
    issues: z.array(z.object({
      code: z.string(),
      type: z.enum(['error', 'warning', 'notice']),
      message: z.string(),
      context: z.string(),
      selector: z.string(),
      runner: z.string(),
      runnerExtras: z.record(z.any()).optional(),
    })),
  }).optional(),
  
  // Summary
  summary: z.object({
    totalViolations: z.number(),
    violationsByImpact: z.object({
      critical: z.number(),
      serious: z.number(),
      moderate: z.number(),
      minor: z.number(),
    }),
    overallScore: z.number().min(0).max(100),
    wcagLevel: z.enum(['A', 'AA', 'AAA']),
    isCompliant: z.boolean(),
  }),
  
  // Metadata
  metadata: z.object({
    userAgent: z.string(),
    viewport: z.object({
      width: z.number(),
      height: z.number(),
    }),
    duration: z.number(), // milliseconds
    toolVersions: z.record(z.string()),
  }),
});

export type AccessibilityAuditResult = z.infer<typeof AccessibilityAuditResultSchema>;

/**
 * Carbon footprint configuration
 */
export const CarbonFootprintConfigSchema = z.object({
  // Estimation methods
  methods: z.object({
    websiteCarbon: z.object({
      enabled: z.boolean().default(true),
      apiKey: z.string().optional(),
    }),
    lighthouse: z.object({
      enabled: z.boolean().default(true),
      includeNetworkPayload: z.boolean().default(true),
    }),
    custom: z.object({
      enabled: z.boolean().default(false),
      calculator: z.string().optional(), // Custom calculator function
    }),
  }),
  
  // Infrastructure configuration
  infrastructure: z.object({
    // Cloud provider carbon intensity
    cloudProvider: z.enum(['aws', 'gcp', 'azure', 'other']).default('aws'),
    region: z.string().default('us-east-1'),
    
    // Server specifications
    servers: z.array(z.object({
      name: z.string(),
      type: z.enum(['compute', 'storage', 'network', 'database']),
      specifications: z.object({
        cpu: z.object({
          cores: z.number(),
          architecture: z.string().optional(),
          tdp: z.number().optional(), // Thermal Design Power in watts
        }).optional(),
        memory: z.object({
          size: z.number(), // GB
          type: z.string().optional(),
        }).optional(),
        storage: z.object({
          size: z.number(), // GB
          type: z.enum(['ssd', 'hdd', 'nvme']).optional(),
        }).optional(),
        network: z.object({
          bandwidth: z.number().optional(), // Mbps
          dataTransfer: z.number().optional(), // GB per month
        }).optional(),
      }),
      utilizationRate: z.number().min(0).max(1).default(0.5),
      hoursPerMonth: z.number().min(0).max(744).default(744), // 24*31
    })),
    
    // CDN and edge locations
    cdn: z.object({
      enabled: z.boolean().default(false),
      provider: z.string().optional(),
      locations: z.array(z.string()).optional(),
      cacheHitRate: z.number().min(0).max(1).default(0.8),
    }).optional(),
  }),
  
  // Application metrics
  application: z.object({
    // Traffic patterns
    traffic: z.object({
      monthlyPageViews: z.number().default(10000),
      averageSessionDuration: z.number().default(180), // seconds
      bounceRate: z.number().min(0).max(1).default(0.4),
      peakTrafficMultiplier: z.number().default(2),
    }),
    
    // Performance metrics
    performance: z.object({
      averagePageSize: z.number().optional(), // KB
      averageLoadTime: z.number().optional(), // seconds
      cacheEfficiency: z.number().min(0).max(1).default(0.7),
      compressionRatio: z.number().min(0).max(1).default(0.7),
    }),
  }),
  
  // Reporting configuration
  reporting: z.object({
    formats: z.array(z.enum(['json', 'html', 'csv'])).default(['json', 'html']),
    outputDir: z.string().default('./carbon-reports'),
    includeComparisons: z.boolean().default(true),
    includeRecommendations: z.boolean().default(true),
  }),
  
  // Quality gates
  qualityGates: z.object({
    maxCarbonPerPageView: z.number().default(5), // grams CO2
    maxCarbonPerMonth: z.number().default(1000), // grams CO2
    maxEnergyPerPageView: z.number().default(0.01), // kWh
    improvementThreshold: z.number().default(0.05), // 5% improvement required
  }),
});

export type CarbonFootprintConfig = z.infer<typeof CarbonFootprintConfigSchema>;

/**
 * Carbon footprint estimation result
 */
export const CarbonFootprintResultSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
  timestamp: z.date(),
  
  // Estimation results
  estimates: z.object({
    // Per page view
    perPageView: z.object({
      carbonGrams: z.number(),
      energyKwh: z.number(),
      waterLiters: z.number().optional(),
    }),
    
    // Monthly totals
    monthly: z.object({
      carbonKg: z.number(),
      energyKwh: z.number(),
      waterLiters: z.number().optional(),
      costUsd: z.number().optional(),
    }),
    
    // Annual projections
    annual: z.object({
      carbonKg: z.number(),
      energyMwh: z.number(),
      equivalents: z.object({
        treesRequired: z.number(), // Trees needed to offset
        carMiles: z.number(), // Equivalent car miles
        homeEnergyDays: z.number(), // Days of average home energy use
      }),
    }),
  }),
  
  // Breakdown by component
  breakdown: z.object({
    frontend: z.object({
      carbonGrams: z.number(),
      percentage: z.number(),
      factors: z.array(z.string()),
    }),
    backend: z.object({
      carbonGrams: z.number(),
      percentage: z.number(),
      factors: z.array(z.string()),
    }),
    infrastructure: z.object({
      carbonGrams: z.number(),
      percentage: z.number(),
      factors: z.array(z.string()),
    }),
    dataTransfer: z.object({
      carbonGrams: z.number(),
      percentage: z.number(),
      factors: z.array(z.string()),
    }),
  }),
  
  // Performance factors
  factors: z.object({
    pageSize: z.number(), // KB
    loadTime: z.number(), // seconds
    requests: z.number(),
    thirdPartyRequests: z.number(),
    imageOptimization: z.number().min(0).max(1), // 0-1 score
    cacheEfficiency: z.number().min(0).max(1),
    compressionRatio: z.number().min(0).max(1),
  }),
  
  // Recommendations
  recommendations: z.array(z.object({
    category: z.enum(['performance', 'infrastructure', 'frontend', 'backend']),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    title: z.string(),
    description: z.string(),
    potentialSaving: z.object({
      carbonGrams: z.number(),
      percentage: z.number(),
    }),
    implementation: z.object({
      effort: z.enum(['low', 'medium', 'high']),
      timeframe: z.string(),
      resources: z.array(z.string()),
    }),
  })),
  
  // Metadata
  metadata: z.object({
    method: z.string(),
    dataSource: z.string(),
    confidence: z.enum(['low', 'medium', 'high']),
    assumptions: z.array(z.string()),
    limitations: z.array(z.string()),
  }),
});

export type CarbonFootprintResult = z.infer<typeof CarbonFootprintResultSchema>;

/**
 * Ethical gates configuration
 */
export const EthicalGatesConfigSchema = z.object({
  // Global settings
  enabled: z.boolean().default(true),
  enforceInCI: z.boolean().default(true),
  
  // Accessibility configuration
  accessibility: AccessibilityConfigSchema,
  
  // Carbon footprint configuration
  carbonFootprint: CarbonFootprintConfigSchema,
  
  // Integration settings
  integrations: z.object({
    github: z.object({
      enabled: z.boolean().default(true),
      createIssues: z.boolean().default(true),
      addComments: z.boolean().default(true),
      labels: z.array(z.string()).default(['accessibility', 'sustainability']),
    }),
    
    slack: z.object({
      enabled: z.boolean().default(false),
      webhookUrl: z.string().optional(),
      channels: z.record(z.string()).optional(),
    }),
    
    jira: z.object({
      enabled: z.boolean().default(false),
      serverUrl: z.string().optional(),
      projectKey: z.string().optional(),
      issueType: z.string().default('Bug'),
    }),
  }),
  
  // Notification settings
  notifications: z.object({
    onViolation: z.array(z.string().email()).default([]),
    onImprovement: z.array(z.string().email()).default([]),
    onThresholdExceeded: z.array(z.string().email()).default([]),
  }),
  
  // Historical tracking
  tracking: z.object({
    enabled: z.boolean().default(true),
    retentionDays: z.number().default(90),
    trendAnalysis: z.boolean().default(true),
    benchmarking: z.boolean().default(true),
  }),
});

export type EthicalGatesConfig = z.infer<typeof EthicalGatesConfigSchema>;

/**
 * Ethical gates audit result
 */
export const EthicalGatesResultSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  
  // Results
  accessibility: AccessibilityAuditResultSchema,
  carbonFootprint: CarbonFootprintResultSchema,
  
  // Overall assessment
  overall: z.object({
    score: z.number().min(0).max(100),
    grade: z.enum(['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F']),
    isCompliant: z.boolean(),
    
    // Quality gates status
    qualityGates: z.object({
      accessibility: z.object({
        passed: z.boolean(),
        score: z.number(),
        violations: z.number(),
        criticalIssues: z.number(),
      }),
      sustainability: z.object({
        passed: z.boolean(),
        carbonPerPageView: z.number(),
        monthlyCarbon: z.number(),
        efficiency: z.number(),
      }),
    }),
  }),
  
  // Trends and comparisons
  trends: z.object({
    accessibility: z.object({
      scoreChange: z.number(),
      violationChange: z.number(),
      trend: z.enum(['improving', 'stable', 'declining']),
    }),
    sustainability: z.object({
      carbonChange: z.number(),
      efficiencyChange: z.number(),
      trend: z.enum(['improving', 'stable', 'declining']),
    }),
  }).optional(),
  
  // Action items
  actionItems: z.array(z.object({
    category: z.enum(['accessibility', 'sustainability', 'both']),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    title: z.string(),
    description: z.string(),
    impact: z.string(),
    effort: z.enum(['low', 'medium', 'high']),
    dueDate: z.date().optional(),
  })),
  
  // Metadata
  metadata: z.object({
    version: z.string(),
    environment: z.string(),
    branch: z.string().optional(),
    commit: z.string().optional(),
    pullRequest: z.string().optional(),
    duration: z.number(), // milliseconds
  }),
});

export type EthicalGatesResult = z.infer<typeof EthicalGatesResultSchema>;

/**
 * API response types
 */
export interface EthicalGatesApiResponse<T = any> {
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
    version: string;
  };
}

/**
 * Sustainability metrics
 */
export interface SustainabilityMetrics {
  // Energy efficiency
  energyEfficiency: {
    score: number; // 0-100
    kwhPerPageView: number;
    kwhPerUser: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  
  // Carbon footprint
  carbonFootprint: {
    gramsPerPageView: number;
    kgPerMonth: number;
    tonnesPerYear: number;
    offsetRequired: number; // trees
  };
  
  // Resource utilization
  resourceUtilization: {
    cpuEfficiency: number; // 0-1
    memoryEfficiency: number; // 0-1
    storageEfficiency: number; // 0-1
    networkEfficiency: number; // 0-1
  };
  
  // Green hosting
  greenHosting: {
    renewableEnergy: number; // percentage
    carbonNeutral: boolean;
    greenCertifications: string[];
  };
}

/**
 * Accessibility metrics
 */
export interface AccessibilityMetrics {
  // WCAG compliance
  wcagCompliance: {
    level: WCAGLevel;
    score: number; // 0-100
    violations: {
      critical: number;
      serious: number;
      moderate: number;
      minor: number;
    };
  };
  
  // User experience
  userExperience: {
    keyboardNavigation: number; // 0-100 score
    screenReaderCompatibility: number; // 0-100 score
    colorContrast: number; // 0-100 score
    textReadability: number; // 0-100 score
  };
  
  // Inclusive design
  inclusiveDesign: {
    multiLanguageSupport: boolean;
    culturalSensitivity: number; // 0-100 score
    cognitiveLoad: number; // 0-100 score (lower is better)
    motorAccessibility: number; // 0-100 score
  };
}

/**
 * Event types for ethical gates
 */
export type EthicalGatesEvent = 
  | { type: 'audit_started'; payload: { auditId: string; targets: string[] } }
  | { type: 'audit_completed'; payload: { auditId: string; result: EthicalGatesResult } }
  | { type: 'violation_detected'; payload: { auditId: string; violation: AccessibilityViolation } }
  | { type: 'threshold_exceeded'; payload: { auditId: string; metric: string; value: number; threshold: number } }
  | { type: 'improvement_detected'; payload: { auditId: string; metric: string; improvement: number } }
  | { type: 'quality_gate_failed'; payload: { auditId: string; gate: string; reason: string } };
