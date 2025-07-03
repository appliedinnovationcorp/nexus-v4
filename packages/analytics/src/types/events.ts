/**
 * Product Analytics Event Types and Interfaces
 */

export type EventCategory = 
  | 'user'
  | 'feature'
  | 'navigation'
  | 'engagement'
  | 'conversion'
  | 'error'
  | 'performance'
  | 'experiment'
  | 'business';

export type UserRole = 
  | 'admin'
  | 'developer'
  | 'designer'
  | 'product_manager'
  | 'analyst'
  | 'viewer'
  | 'guest';

export type FeatureArea = 
  | 'authentication'
  | 'dashboard'
  | 'api_management'
  | 'secret_management'
  | 'design_system'
  | 'monitoring'
  | 'settings'
  | 'onboarding'
  | 'collaboration'
  | 'integrations';

export type ConversionGoal = 
  | 'signup'
  | 'activation'
  | 'feature_adoption'
  | 'retention'
  | 'upgrade'
  | 'referral';

export interface BaseEventProperties {
  /** Timestamp when the event occurred */
  timestamp?: Date;
  /** User ID (if authenticated) */
  userId?: string;
  /** Anonymous session ID */
  sessionId: string;
  /** Device/browser information */
  device?: {
    type: 'desktop' | 'mobile' | 'tablet';
    os: string;
    browser: string;
    viewport: {
      width: number;
      height: number;
    };
  };
  /** Geographic information */
  location?: {
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
  };
  /** UTM parameters */
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  /** A/B test variants */
  experiments?: Record<string, string>;
  /** Feature flags */
  featureFlags?: Record<string, boolean>;
}

export interface UserEventProperties extends BaseEventProperties {
  /** User profile information */
  userProfile?: {
    role: UserRole;
    plan: 'free' | 'pro' | 'enterprise';
    signupDate: Date;
    lastActiveDate: Date;
    totalSessions: number;
    isNewUser: boolean;
  };
}

export interface FeatureEventProperties extends BaseEventProperties {
  /** Feature-specific information */
  feature: {
    area: FeatureArea;
    name: string;
    version?: string;
    isNewFeature?: boolean;
  };
  /** Context about feature usage */
  context?: {
    source: 'menu' | 'button' | 'shortcut' | 'onboarding' | 'search' | 'recommendation';
    previousAction?: string;
    timeSpentOnPage?: number;
  };
}

export interface NavigationEventProperties extends BaseEventProperties {
  /** Navigation information */
  navigation: {
    from: string;
    to: string;
    method: 'click' | 'keyboard' | 'browser' | 'redirect';
    duration?: number;
  };
  /** Page information */
  page?: {
    title: string;
    url: string;
    referrer?: string;
    loadTime?: number;
  };
}

export interface EngagementEventProperties extends BaseEventProperties {
  /** Engagement metrics */
  engagement: {
    type: 'scroll' | 'click' | 'hover' | 'focus' | 'time_spent' | 'interaction';
    element?: string;
    value?: number;
    duration?: number;
  };
  /** Content information */
  content?: {
    type: 'article' | 'video' | 'tutorial' | 'documentation' | 'component';
    id?: string;
    title?: string;
    category?: string;
  };
}

export interface ConversionEventProperties extends BaseEventProperties {
  /** Conversion information */
  conversion: {
    goal: ConversionGoal;
    funnel: string;
    step: number;
    totalSteps: number;
    value?: number;
    currency?: string;
  };
  /** Attribution information */
  attribution?: {
    firstTouch: string;
    lastTouch: string;
    touchpoints: string[];
    timeToConversion: number;
  };
}

export interface ErrorEventProperties extends BaseEventProperties {
  /** Error information */
  error: {
    type: 'javascript' | 'network' | 'validation' | 'authentication' | 'authorization';
    message: string;
    stack?: string;
    code?: string | number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  };
  /** Context when error occurred */
  context?: {
    action: string;
    component?: string;
    url: string;
    userAgent: string;
  };
}

export interface PerformanceEventProperties extends BaseEventProperties {
  /** Performance metrics */
  performance: {
    metric: 'page_load' | 'api_response' | 'component_render' | 'bundle_size' | 'core_web_vitals';
    value: number;
    unit: 'ms' | 'bytes' | 'score';
    threshold?: number;
    isGoodPerformance: boolean;
  };
  /** Additional context */
  context?: {
    endpoint?: string;
    component?: string;
    bundleName?: string;
  };
}

export interface ExperimentEventProperties extends BaseEventProperties {
  /** A/B test information */
  experiment: {
    id: string;
    name: string;
    variant: string;
    isControl: boolean;
    startDate: Date;
    endDate?: Date;
  };
  /** Experiment outcome */
  outcome?: {
    metric: string;
    value: number;
    isSuccess: boolean;
  };
}

export interface BusinessEventProperties extends BaseEventProperties {
  /** Business metrics */
  business: {
    metric: 'revenue' | 'usage' | 'adoption' | 'churn' | 'satisfaction' | 'support';
    value: number;
    unit?: string;
    period?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  };
  /** Segmentation */
  segment?: {
    plan: string;
    industry?: string;
    companySize?: string;
    region?: string;
  };
}

// Event type definitions
export interface AnalyticsEvent<T extends BaseEventProperties = BaseEventProperties> {
  /** Event name */
  event: string;
  /** Event category */
  category: EventCategory;
  /** Event properties */
  properties: T;
  /** Event metadata */
  metadata?: {
    source: 'client' | 'server' | 'mobile';
    version: string;
    environment: 'development' | 'staging' | 'production';
    batchId?: string;
  };
}

// Predefined event types
export type UserEvent = AnalyticsEvent<UserEventProperties>;
export type FeatureEvent = AnalyticsEvent<FeatureEventProperties>;
export type NavigationEvent = AnalyticsEvent<NavigationEventProperties>;
export type EngagementEvent = AnalyticsEvent<EngagementEventProperties>;
export type ConversionEvent = AnalyticsEvent<ConversionEventProperties>;
export type ErrorEvent = AnalyticsEvent<ErrorEventProperties>;
export type PerformanceEvent = AnalyticsEvent<PerformanceEventProperties>;
export type ExperimentEvent = AnalyticsEvent<ExperimentEventProperties>;
export type BusinessEvent = AnalyticsEvent<BusinessEventProperties>;

// Union type for all events
export type AnyAnalyticsEvent = 
  | UserEvent
  | FeatureEvent
  | NavigationEvent
  | EngagementEvent
  | ConversionEvent
  | ErrorEvent
  | PerformanceEvent
  | ExperimentEvent
  | BusinessEvent;

// Event configuration
export interface EventConfig {
  /** Whether to track this event */
  enabled: boolean;
  /** Sampling rate (0-1) */
  sampleRate?: number;
  /** Whether to send to PostHog */
  posthog?: boolean;
  /** Whether to send to Mixpanel */
  mixpanel?: boolean;
  /** Custom properties to add */
  customProperties?: Record<string, any>;
  /** PII scrubbing rules */
  piiScrubbing?: {
    enabled: boolean;
    fields: string[];
  };
}

// Analytics configuration
export interface AnalyticsConfig {
  /** PostHog configuration */
  posthog?: {
    apiKey: string;
    host?: string;
    options?: Record<string, any>;
  };
  /** Mixpanel configuration */
  mixpanel?: {
    token: string;
    options?: Record<string, any>;
  };
  /** Global settings */
  global: {
    /** Whether analytics is enabled */
    enabled: boolean;
    /** Environment */
    environment: 'development' | 'staging' | 'production';
    /** Debug mode */
    debug: boolean;
    /** Consent management */
    consent: {
      required: boolean;
      categories: string[];
    };
    /** Data retention */
    retention: {
      days: number;
      autoDelete: boolean;
    };
  };
  /** Event-specific configuration */
  events: Record<string, EventConfig>;
  /** User identification */
  user: {
    /** Auto-identify users */
    autoIdentify: boolean;
    /** User properties to track */
    properties: string[];
    /** Anonymous user handling */
    anonymous: {
      enabled: boolean;
      sessionTimeout: number; // minutes
    };
  };
  /** Privacy settings */
  privacy: {
    /** IP address handling */
    ipAddress: 'collect' | 'anonymize' | 'exclude';
    /** Geolocation precision */
    geolocation: 'precise' | 'city' | 'country' | 'none';
    /** Cookie settings */
    cookies: {
      enabled: boolean;
      sameSite: 'strict' | 'lax' | 'none';
      secure: boolean;
    };
  };
}
