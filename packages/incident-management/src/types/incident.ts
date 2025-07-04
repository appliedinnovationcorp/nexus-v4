/**
 * Incident Management Types and Interfaces
 */

export type IncidentSeverity = 'sev1' | 'sev2' | 'sev3' | 'sev4';
export type IncidentStatus = 'triggered' | 'acknowledged' | 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type IncidentPriority = 'p1' | 'p2' | 'p3' | 'p4';
export type EscalationLevel = 'l1' | 'l2' | 'l3' | 'executive';

export interface IncidentClassification {
  /** Primary service affected */
  primaryService: string;
  /** Secondary services affected */
  secondaryServices: string[];
  /** Incident category */
  category: 'availability' | 'performance' | 'security' | 'data' | 'integration' | 'infrastructure';
  /** Root cause category */
  rootCauseCategory?: 'code' | 'config' | 'infrastructure' | 'external' | 'process' | 'human_error';
  /** Business impact level */
  businessImpact: 'none' | 'low' | 'medium' | 'high' | 'critical';
  /** Customer impact */
  customerImpact: {
    affected: boolean;
    userCount?: number;
    revenueImpact?: number;
    description?: string;
  };
}

export interface IncidentTimeline {
  /** When the incident was first detected */
  detectedAt: Date;
  /** When the incident actually started (if different from detection) */
  startedAt?: Date;
  /** When the incident was acknowledged */
  acknowledgedAt?: Date;
  /** When investigation began */
  investigationStartedAt?: Date;
  /** When root cause was identified */
  identifiedAt?: Date;
  /** When mitigation was applied */
  mitigatedAt?: Date;
  /** When the incident was resolved */
  resolvedAt?: Date;
  /** When post-incident activities were completed */
  closedAt?: Date;
}

export interface IncidentMetrics {
  /** Time to detect (TTD) */
  timeToDetect?: number; // minutes
  /** Time to acknowledge (TTA) */
  timeToAcknowledge?: number; // minutes
  /** Time to mitigate (TTM) */
  timeToMitigate?: number; // minutes
  /** Time to resolve (TTR) */
  timeToResolve?: number; // minutes
  /** Mean time to recovery (MTTR) */
  mttr?: number; // minutes
  /** Total duration */
  totalDuration?: number; // minutes
}

export interface IncidentParticipant {
  /** User ID */
  userId: string;
  /** User name */
  name: string;
  /** User email */
  email: string;
  /** Role in incident */
  role: 'incident_commander' | 'primary_responder' | 'subject_matter_expert' | 'communications_lead' | 'observer';
  /** When they joined the incident */
  joinedAt: Date;
  /** When they left the incident */
  leftAt?: Date;
  /** Whether they were on-call */
  wasOnCall: boolean;
}

export interface IncidentAction {
  /** Unique action ID */
  id: string;
  /** Action description */
  description: string;
  /** Who performed the action */
  performedBy: string;
  /** When the action was performed */
  performedAt: Date;
  /** Action type */
  type: 'investigation' | 'mitigation' | 'communication' | 'escalation' | 'resolution';
  /** Action outcome */
  outcome?: 'successful' | 'failed' | 'partial';
  /** Additional details */
  details?: string;
}

export interface IncidentCommunication {
  /** Communication ID */
  id: string;
  /** Communication type */
  type: 'status_page' | 'slack' | 'email' | 'phone' | 'internal' | 'external';
  /** Message content */
  message: string;
  /** Who sent the communication */
  sentBy: string;
  /** When it was sent */
  sentAt: Date;
  /** Recipients */
  recipients?: string[];
  /** Communication channel */
  channel?: string;
}

export interface Incident {
  /** Unique incident ID */
  id: string;
  /** Incident title */
  title: string;
  /** Detailed description */
  description: string;
  /** Current status */
  status: IncidentStatus;
  /** Severity level */
  severity: IncidentSeverity;
  /** Priority level */
  priority: IncidentPriority;
  /** Classification details */
  classification: IncidentClassification;
  /** Timeline information */
  timeline: IncidentTimeline;
  /** Calculated metrics */
  metrics: IncidentMetrics;
  /** Incident participants */
  participants: IncidentParticipant[];
  /** Actions taken during incident */
  actions: IncidentAction[];
  /** Communications sent */
  communications: IncidentCommunication[];
  /** Related alerts */
  alerts: string[];
  /** Related SLO breaches */
  sloBreaches: string[];
  /** External ticket IDs */
  externalTickets: {
    pagerduty?: string;
    opsgenie?: string;
    jira?: string;
    github?: string;
  };
  /** Tags for categorization */
  tags: string[];
  /** Metadata */
  metadata: {
    /** Who created the incident */
    createdBy: string;
    /** When it was created */
    createdAt: Date;
    /** Last updated by */
    updatedBy: string;
    /** When it was last updated */
    updatedAt: Date;
    /** Source of incident creation */
    source: 'manual' | 'alert' | 'slo_breach' | 'monitoring' | 'user_report';
    /** Environment */
    environment: 'production' | 'staging' | 'development';
  };
}

export interface PostMortem {
  /** Unique post-mortem ID */
  id: string;
  /** Associated incident ID */
  incidentId: string;
  /** Post-mortem title */
  title: string;
  /** Executive summary */
  summary: string;
  /** Detailed timeline */
  timeline: {
    /** Key events during the incident */
    events: Array<{
      timestamp: Date;
      description: string;
      type: 'detection' | 'investigation' | 'mitigation' | 'communication' | 'resolution';
    }>;
  };
  /** Impact analysis */
  impact: {
    /** Duration of impact */
    duration: number; // minutes
    /** Services affected */
    servicesAffected: string[];
    /** Users affected */
    usersAffected?: number;
    /** Revenue impact */
    revenueImpact?: number;
    /** SLO impact */
    sloImpact: Array<{
      sloId: string;
      budgetConsumed: number;
      targetMissed: boolean;
    }>;
  };
  /** Root cause analysis */
  rootCause: {
    /** Primary root cause */
    primary: string;
    /** Contributing factors */
    contributing: string[];
    /** Why it wasn't caught earlier */
    detection: string;
    /** Timeline of how the issue developed */
    development: string;
  };
  /** What went well */
  whatWentWell: string[];
  /** What could be improved */
  whatCouldBeImproved: string[];
  /** Action items */
  actionItems: Array<{
    id: string;
    description: string;
    owner: string;
    dueDate: Date;
    priority: 'high' | 'medium' | 'low';
    status: 'open' | 'in_progress' | 'completed' | 'cancelled';
    category: 'prevention' | 'detection' | 'mitigation' | 'communication' | 'process';
  }>;
  /** Lessons learned */
  lessonsLearned: string[];
  /** Status */
  status: 'draft' | 'review' | 'approved' | 'published';
  /** Metadata */
  metadata: {
    /** Author */
    author: string;
    /** Reviewers */
    reviewers: string[];
    /** Created date */
    createdAt: Date;
    /** Published date */
    publishedAt?: Date;
    /** Last updated */
    updatedAt: Date;
  };
}

export interface OnCallSchedule {
  /** Schedule ID */
  id: string;
  /** Schedule name */
  name: string;
  /** Team or service */
  team: string;
  /** Current on-call person */
  currentOnCall: {
    userId: string;
    name: string;
    email: string;
    phone?: string;
    startTime: Date;
    endTime: Date;
  };
  /** Next on-call person */
  nextOnCall?: {
    userId: string;
    name: string;
    email: string;
    phone?: string;
    startTime: Date;
    endTime: Date;
  };
  /** Escalation policy */
  escalationPolicy: {
    levels: Array<{
      level: EscalationLevel;
      targets: Array<{
        type: 'user' | 'schedule' | 'team';
        id: string;
        name: string;
      }>;
      escalationDelay: number; // minutes
    }>;
  };
  /** Schedule configuration */
  configuration: {
    timezone: string;
    rotationType: 'daily' | 'weekly' | 'custom';
    rotationLength: number; // hours
    handoffTime: string; // HH:MM format
  };
}

export interface AlertRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Description */
  description: string;
  /** Service this rule applies to */
  service: string;
  /** Alert condition */
  condition: {
    /** Metric or SLO being monitored */
    metric: string;
    /** Threshold value */
    threshold: number;
    /** Comparison operator */
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    /** Evaluation window */
    window: string; // e.g., "5m", "1h"
    /** Number of consecutive breaches */
    consecutiveBreaches?: number;
  };
  /** Severity mapping */
  severity: IncidentSeverity;
  /** Priority mapping */
  priority: IncidentPriority;
  /** Auto-escalation settings */
  escalation: {
    /** Whether to auto-escalate */
    enabled: boolean;
    /** Time before escalation */
    delay: number; // minutes
    /** Target escalation level */
    targetLevel: EscalationLevel;
  };
  /** Notification settings */
  notifications: {
    /** PagerDuty integration key */
    pagerdutyKey?: string;
    /** Opsgenie API key */
    opsgenieKey?: string;
    /** Slack channels */
    slackChannels?: string[];
    /** Email recipients */
    emailRecipients?: string[];
  };
  /** Rule status */
  enabled: boolean;
  /** Metadata */
  metadata: {
    createdBy: string;
    createdAt: Date;
    updatedBy: string;
    updatedAt: Date;
  };
}

export interface IncidentResponse {
  /** Response ID */
  id: string;
  /** Associated incident */
  incidentId: string;
  /** Response type */
  type: 'page' | 'escalation' | 'notification' | 'auto_resolution';
  /** Target of response */
  target: {
    type: 'user' | 'team' | 'schedule';
    id: string;
    name: string;
  };
  /** Response status */
  status: 'pending' | 'delivered' | 'acknowledged' | 'failed';
  /** Delivery method */
  method: 'sms' | 'phone' | 'email' | 'push' | 'slack';
  /** Response details */
  details: {
    /** When response was triggered */
    triggeredAt: Date;
    /** When response was delivered */
    deliveredAt?: Date;
    /** When response was acknowledged */
    acknowledgedAt?: Date;
    /** Delivery attempts */
    attempts: number;
    /** Error message if failed */
    error?: string;
  };
}

export interface IncidentMetricsReport {
  /** Report period */
  period: {
    start: Date;
    end: Date;
  };
  /** Summary statistics */
  summary: {
    /** Total incidents */
    totalIncidents: number;
    /** Incidents by severity */
    bySeverity: Record<IncidentSeverity, number>;
    /** Incidents by service */
    byService: Record<string, number>;
    /** Average MTTR */
    averageMTTR: number;
    /** Average time to acknowledge */
    averageTTA: number;
    /** SLO breaches caused */
    sloBreaches: number;
  };
  /** Trends */
  trends: {
    /** Incident frequency trend */
    frequency: 'increasing' | 'decreasing' | 'stable';
    /** MTTR trend */
    mttr: 'improving' | 'degrading' | 'stable';
    /** Severity distribution changes */
    severityTrend: Record<IncidentSeverity, 'increasing' | 'decreasing' | 'stable'>;
  };
  /** Top issues */
  topIssues: Array<{
    service: string;
    incidentCount: number;
    averageMTTR: number;
    totalDowntime: number;
  }>;
  /** Recommendations */
  recommendations: Array<{
    type: 'prevention' | 'detection' | 'response' | 'process';
    description: string;
    priority: 'high' | 'medium' | 'low';
    estimatedImpact: string;
  }>;
}
