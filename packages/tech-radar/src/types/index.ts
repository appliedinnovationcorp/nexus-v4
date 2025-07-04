import { z } from 'zod';

/**
 * Technology radar quadrants
 */
export type TechRadarQuadrant = 'languages-frameworks' | 'tools' | 'platforms' | 'techniques';

/**
 * Technology radar rings (adoption stages)
 */
export type TechRadarRing = 'adopt' | 'trial' | 'assess' | 'hold';

/**
 * Technology movement direction
 */
export type TechMovement = 'in' | 'out' | 'no-change';

/**
 * API versioning strategy
 */
export type APIVersioningStrategy = 'semantic' | 'date-based' | 'sequential' | 'header-based';

/**
 * Deprecation status
 */
export type DeprecationStatus = 'active' | 'deprecated' | 'sunset' | 'removed';

/**
 * Technology entry schema
 */
export const TechnologyEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  quadrant: z.enum(['languages-frameworks', 'tools', 'platforms', 'techniques']),
  ring: z.enum(['adopt', 'trial', 'assess', 'hold']),
  movement: z.enum(['in', 'out', 'no-change']).default('no-change'),
  
  // Metadata
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  url: z.string().url().optional(),
  
  // Lifecycle information
  introducedDate: z.date(),
  lastReviewDate: z.date(),
  nextReviewDate: z.date(),
  
  // Adoption information
  adoptionLevel: z.number().min(0).max(100).default(0), // Percentage
  teamUsage: z.array(z.object({
    team: z.string(),
    projects: z.array(z.string()),
    adoptionDate: z.date(),
    experience: z.enum(['beginner', 'intermediate', 'expert']),
  })).default([]),
  
  // Assessment criteria
  assessment: z.object({
    maturity: z.number().min(1).max(5), // 1-5 scale
    community: z.number().min(1).max(5),
    documentation: z.number().min(1).max(5),
    performance: z.number().min(1).max(5),
    security: z.number().min(1).max(5),
    maintenance: z.number().min(1).max(5),
    learningCurve: z.number().min(1).max(5), // 1=easy, 5=hard
    overallScore: z.number().min(1).max(5),
  }),
  
  // Business impact
  businessImpact: z.object({
    strategicValue: z.enum(['low', 'medium', 'high', 'critical']),
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
    costImpact: z.enum(['low', 'medium', 'high']),
    timeToValue: z.enum(['immediate', 'short', 'medium', 'long']),
  }),
  
  // Dependencies and relationships
  dependencies: z.array(z.string()).default([]), // IDs of other technologies
  alternatives: z.array(z.string()).default([]), // IDs of alternative technologies
  supersedes: z.array(z.string()).default([]), // IDs of technologies this replaces
  
  // Deprecation information
  deprecation: z.object({
    status: z.enum(['active', 'deprecated', 'sunset', 'removed']).default('active'),
    deprecatedDate: z.date().optional(),
    sunsetDate: z.date().optional(),
    removalDate: z.date().optional(),
    reason: z.string().optional(),
    migrationPath: z.string().optional(),
    replacementTechnology: z.string().optional(), // ID of replacement
  }).optional(),
  
  // Decision rationale
  rationale: z.object({
    pros: z.array(z.string()),
    cons: z.array(z.string()),
    tradeoffs: z.array(z.string()),
    decisionFactors: z.array(z.string()),
    keyStakeholders: z.array(z.string()),
  }),
  
  // Metadata
  createdBy: z.string(),
  createdAt: z.date(),
  updatedBy: z.string(),
  updatedAt: z.date(),
  version: z.number().default(1),
});

export type TechnologyEntry = z.infer<typeof TechnologyEntrySchema>;

/**
 * API version schema
 */
export const APIVersionSchema = z.object({
  id: z.string(),
  version: z.string(),
  apiName: z.string(),
  
  // Version information
  versioningStrategy: z.enum(['semantic', 'date-based', 'sequential', 'header-based']),
  majorVersion: z.number(),
  minorVersion: z.number(),
  patchVersion: z.number().optional(),
  
  // Lifecycle status
  status: z.enum(['development', 'beta', 'stable', 'deprecated', 'sunset', 'removed']),
  releaseDate: z.date(),
  
  // Deprecation timeline
  deprecation: z.object({
    deprecatedDate: z.date().optional(),
    sunsetDate: z.date().optional(),
    removalDate: z.date().optional(),
    reason: z.string().optional(),
    migrationGuide: z.string().optional(),
    breakingChanges: z.array(z.string()).default([]),
  }).optional(),
  
  // Usage metrics
  usage: z.object({
    activeClients: z.number().default(0),
    requestsPerDay: z.number().default(0),
    errorRate: z.number().min(0).max(1).default(0),
    averageResponseTime: z.number().default(0), // milliseconds
    lastUsed: z.date().optional(),
  }),
  
  // Compatibility
  compatibility: z.object({
    backwardCompatible: z.boolean().default(true),
    forwardCompatible: z.boolean().default(false),
    supportedClients: z.array(z.string()).default([]),
    minimumClientVersion: z.string().optional(),
  }),
  
  // Documentation
  documentation: z.object({
    changelogUrl: z.string().url().optional(),
    migrationGuideUrl: z.string().url().optional(),
    apiDocumentationUrl: z.string().url().optional(),
    examplesUrl: z.string().url().optional(),
  }),
  
  // Support information
  support: z.object({
    supportLevel: z.enum(['full', 'maintenance', 'security-only', 'none']),
    supportEndDate: z.date().optional(),
    contactEmail: z.string().email().optional(),
    slackChannel: z.string().optional(),
  }),
  
  // Metadata
  createdBy: z.string(),
  createdAt: z.date(),
  updatedBy: z.string(),
  updatedAt: z.date(),
});

export type APIVersion = z.infer<typeof APIVersionSchema>;

/**
 * Tech radar configuration
 */
export const TechRadarConfigSchema = z.object({
  // Radar settings
  title: z.string().default('Technology Radar'),
  subtitle: z.string().optional(),
  organization: z.string(),
  
  // Visual settings
  visualization: z.object({
    width: z.number().default(1200),
    height: z.number().default(800),
    colors: z.object({
      adopt: z.string().default('#5cb85c'),
      trial: z.string().default('#f0ad4e'),
      assess: z.string().default('#5bc0de'),
      hold: z.string().default('#d9534f'),
    }),
    showLegend: z.boolean().default(true),
    showLabels: z.boolean().default(true),
  }),
  
  // Quadrant definitions
  quadrants: z.object({
    'languages-frameworks': z.object({
      name: z.string().default('Languages & Frameworks'),
      description: z.string().default('Programming languages, frameworks, and libraries'),
    }),
    'tools': z.object({
      name: z.string().default('Tools'),
      description: z.string().default('Development tools, IDEs, and utilities'),
    }),
    'platforms': z.object({
      name: z.string().default('Platforms'),
      description: z.string().default('Infrastructure, cloud platforms, and services'),
    }),
    'techniques': z.object({
      name: z.string().default('Techniques'),
      description: z.string().default('Methods, practices, and architectural patterns'),
    }),
  }),
  
  // Ring definitions
  rings: z.object({
    adopt: z.object({
      name: z.string().default('Adopt'),
      description: z.string().default('Technologies we have high confidence in and actively use'),
      color: z.string().default('#5cb85c'),
    }),
    trial: z.object({
      name: z.string().default('Trial'),
      description: z.string().default('Technologies worth pursuing with a goal to understand their impact'),
      color: z.string().default('#f0ad4e'),
    }),
    assess: z.object({
      name: z.string().default('Assess'),
      description: z.string().default('Technologies to explore with the goal of understanding their fit'),
      color: z.string().default('#5bc0de'),
    }),
    hold: z.object({
      name: z.string().default('Hold'),
      description: z.string().default('Technologies to avoid or phase out'),
      color: z.string().default('#d9534f'),
    }),
  }),
  
  // Review process
  reviewProcess: z.object({
    reviewCycle: z.enum(['monthly', 'quarterly', 'biannual', 'annual']).default('quarterly'),
    reviewers: z.array(z.string()).default([]),
    approvalRequired: z.boolean().default(true),
    votingThreshold: z.number().min(0).max(1).default(0.6), // 60% consensus
  }),
  
  // API versioning settings
  apiVersioning: z.object({
    defaultStrategy: z.enum(['semantic', 'date-based', 'sequential', 'header-based']).default('semantic'),
    deprecationPeriod: z.number().default(365), // days
    sunsetPeriod: z.number().default(180), // days after deprecation
    notificationPeriods: z.array(z.number()).default([90, 30, 7]), // days before deprecation
    supportLevels: z.object({
      full: z.number().default(730), // 2 years
      maintenance: z.number().default(365), // 1 year
      securityOnly: z.number().default(180), // 6 months
    }),
  }),
  
  // Integration settings
  integrations: z.object({
    github: z.object({
      enabled: z.boolean().default(false),
      repository: z.string().optional(),
      branch: z.string().default('main'),
      path: z.string().default('tech-radar'),
    }),
    
    confluence: z.object({
      enabled: z.boolean().default(false),
      baseUrl: z.string().optional(),
      spaceKey: z.string().optional(),
      pageId: z.string().optional(),
    }),
    
    slack: z.object({
      enabled: z.boolean().default(false),
      webhookUrl: z.string().optional(),
      channels: z.object({
        announcements: z.string().optional(),
        discussions: z.string().optional(),
      }),
    }),
  }),
  
  // Notification settings
  notifications: z.object({
    deprecationWarnings: z.array(z.string().email()).default([]),
    radarUpdates: z.array(z.string().email()).default([]),
    reviewReminders: z.array(z.string().email()).default([]),
  }),
});

export type TechRadarConfig = z.infer<typeof TechRadarConfigSchema>;

/**
 * Tech radar snapshot
 */
export const TechRadarSnapshotSchema = z.object({
  id: z.string(),
  version: z.string(),
  title: z.string(),
  date: z.date(),
  
  // Technologies in this snapshot
  technologies: z.array(TechnologyEntrySchema),
  
  // Changes from previous snapshot
  changes: z.object({
    added: z.array(z.string()), // Technology IDs
    moved: z.array(z.object({
      technologyId: z.string(),
      from: z.enum(['adopt', 'trial', 'assess', 'hold']),
      to: z.enum(['adopt', 'trial', 'assess', 'hold']),
    })),
    removed: z.array(z.string()), // Technology IDs
    updated: z.array(z.string()), // Technology IDs
  }),
  
  // Summary statistics
  summary: z.object({
    totalTechnologies: z.number(),
    byQuadrant: z.record(z.number()),
    byRing: z.record(z.number()),
    newTechnologies: z.number(),
    deprecatedTechnologies: z.number(),
  }),
  
  // Metadata
  createdBy: z.string(),
  createdAt: z.date(),
  publishedAt: z.date().optional(),
  isPublished: z.boolean().default(false),
});

export type TechRadarSnapshot = z.infer<typeof TechRadarSnapshotSchema>;

/**
 * Deprecation notice
 */
export const DeprecationNoticeSchema = z.object({
  id: z.string(),
  type: z.enum(['technology', 'api-version']),
  targetId: z.string(), // Technology or API version ID
  
  // Notice details
  title: z.string(),
  message: z.string(),
  severity: z.enum(['info', 'warning', 'critical']),
  
  // Timeline
  noticeDate: z.date(),
  deprecationDate: z.date(),
  sunsetDate: z.date().optional(),
  removalDate: z.date().optional(),
  
  // Recipients
  recipients: z.array(z.object({
    type: z.enum(['email', 'slack', 'webhook']),
    target: z.string(),
    sent: z.boolean().default(false),
    sentAt: z.date().optional(),
  })),
  
  // Migration information
  migration: z.object({
    hasAutomatedMigration: z.boolean().default(false),
    migrationGuideUrl: z.string().url().optional(),
    replacementTechnology: z.string().optional(),
    estimatedEffort: z.enum(['low', 'medium', 'high']).optional(),
  }).optional(),
  
  // Acknowledgment tracking
  acknowledgments: z.array(z.object({
    userId: z.string(),
    acknowledgedAt: z.date(),
    comments: z.string().optional(),
  })).default([]),
  
  // Metadata
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DeprecationNotice = z.infer<typeof DeprecationNoticeSchema>;

/**
 * Technology assessment
 */
export const TechnologyAssessmentSchema = z.object({
  id: z.string(),
  technologyId: z.string(),
  assessorId: z.string(),
  
  // Assessment details
  assessmentDate: z.date(),
  assessmentType: z.enum(['initial', 'periodic', 'migration', 'deprecation']),
  
  // Scores (1-5 scale)
  scores: z.object({
    maturity: z.number().min(1).max(5),
    community: z.number().min(1).max(5),
    documentation: z.number().min(1).max(5),
    performance: z.number().min(1).max(5),
    security: z.number().min(1).max(5),
    maintenance: z.number().min(1).max(5),
    learningCurve: z.number().min(1).max(5),
    overallScore: z.number().min(1).max(5),
  }),
  
  // Qualitative assessment
  assessment: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    opportunities: z.array(z.string()),
    threats: z.array(z.string()),
    recommendations: z.array(z.string()),
  }),
  
  // Usage context
  context: z.object({
    useCase: z.string(),
    projectSize: z.enum(['small', 'medium', 'large', 'enterprise']),
    teamSize: z.number(),
    timeline: z.enum(['immediate', 'short', 'medium', 'long']),
    budget: z.enum(['low', 'medium', 'high', 'unlimited']),
  }),
  
  // Recommendation
  recommendation: z.object({
    ring: z.enum(['adopt', 'trial', 'assess', 'hold']),
    confidence: z.number().min(0).max(1), // 0-1 scale
    reasoning: z.string(),
    conditions: z.array(z.string()).optional(),
    timeline: z.string().optional(),
  }),
  
  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TechnologyAssessment = z.infer<typeof TechnologyAssessmentSchema>;

/**
 * API response types
 */
export interface TechRadarApiResponse<T = any> {
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
 * Radar visualization data
 */
export interface RadarVisualizationData {
  quadrants: Array<{
    name: string;
    technologies: Array<{
      id: string;
      name: string;
      ring: TechRadarRing;
      movement: TechMovement;
      x: number;
      y: number;
    }>;
  }>;
  rings: Array<{
    name: string;
    radius: number;
    color: string;
  }>;
  metadata: {
    title: string;
    date: string;
    version: string;
  };
}

/**
 * Migration plan
 */
export interface MigrationPlan {
  id: string;
  fromTechnology: string;
  toTechnology: string;
  
  // Plan details
  title: string;
  description: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  estimatedDuration: string;
  
  // Phases
  phases: Array<{
    name: string;
    description: string;
    duration: string;
    tasks: Array<{
      name: string;
      description: string;
      assignee?: string;
      dueDate?: Date;
      status: 'pending' | 'in-progress' | 'completed';
    }>;
  }>;
  
  // Risks and mitigation
  risks: Array<{
    description: string;
    impact: 'low' | 'medium' | 'high';
    probability: 'low' | 'medium' | 'high';
    mitigation: string;
  }>;
  
  // Success criteria
  successCriteria: Array<{
    metric: string;
    target: string;
    measurement: string;
  }>;
  
  // Resources
  resources: Array<{
    type: 'documentation' | 'training' | 'tool' | 'support';
    name: string;
    url?: string;
    description: string;
  }>;
  
  // Timeline
  startDate: Date;
  endDate: Date;
  milestones: Array<{
    name: string;
    date: Date;
    description: string;
  }>;
  
  // Status
  status: 'draft' | 'approved' | 'in-progress' | 'completed' | 'cancelled';
  progress: number; // 0-100
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Event types for tech radar
 */
export type TechRadarEvent = 
  | { type: 'technology_added'; payload: { technologyId: string; ring: TechRadarRing } }
  | { type: 'technology_moved'; payload: { technologyId: string; from: TechRadarRing; to: TechRadarRing } }
  | { type: 'technology_deprecated'; payload: { technologyId: string; reason: string } }
  | { type: 'api_version_deprecated'; payload: { apiId: string; version: string; sunsetDate: Date } }
  | { type: 'radar_published'; payload: { snapshotId: string; version: string } }
  | { type: 'migration_started'; payload: { planId: string; fromTechnology: string; toTechnology: string } };
