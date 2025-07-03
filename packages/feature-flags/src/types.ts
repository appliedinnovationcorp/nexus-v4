// Type definitions for feature flag system

export interface FeatureFlagConfig {
  provider: 'unleash' | 'launchdarkly' | 'local';
  environment: string;
  
  // Unleash configuration
  unleash?: {
    url: string;
    appName: string;
    instanceId?: string;
    clientKey?: string;
    refreshInterval?: number;
    metricsInterval?: number;
  };
  
  // LaunchDarkly configuration
  launchdarkly?: {
    sdkKey: string;
    mobileKey?: string;
    clientSideId?: string;
    offline?: boolean;
    timeout?: number;
  };
  
  // Local/fallback configuration
  local?: {
    flags: Record<string, boolean | string | number>;
  };
  
  // Caching configuration
  cache?: {
    enabled: boolean;
    ttl?: number; // Time to live in seconds
    redis?: {
      host: string;
      port: number;
      password?: string;
      db?: number;
    };
  };
  
  // Monitoring configuration
  monitoring?: {
    enabled: boolean;
    logEvaluations?: boolean;
    trackMetrics?: boolean;
  };
}

export interface UserContext {
  userId?: string;
  email?: string;
  name?: string;
  country?: string;
  region?: string;
  organization?: string;
  plan?: string;
  role?: string;
  beta?: boolean;
  customAttributes?: Record<string, string | number | boolean>;
}

export interface FeatureFlagEvaluation {
  flagKey: string;
  value: boolean | string | number;
  variant?: string;
  reason?: string;
  timestamp: number;
  userContext?: UserContext;
}

export interface FeatureFlagMetrics {
  flagKey: string;
  evaluations: number;
  trueEvaluations: number;
  falseEvaluations: number;
  variants: Record<string, number>;
  lastEvaluated: number;
}

export interface FeatureFlagProvider {
  initialize(): Promise<void>;
  isEnabled(flagKey: string, userContext?: UserContext, defaultValue?: boolean): Promise<boolean>;
  getVariant(flagKey: string, userContext?: UserContext, defaultValue?: string): Promise<string>;
  getNumber(flagKey: string, userContext?: UserContext, defaultValue?: number): Promise<number>;
  getString(flagKey: string, userContext?: UserContext, defaultValue?: string): Promise<string>;
  getAllFlags(userContext?: UserContext): Promise<Record<string, any>>;
  close(): Promise<void>;
}

export interface FeatureFlagCache {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface FeatureFlagEvent {
  type: 'evaluation' | 'error' | 'ready' | 'update';
  flagKey?: string;
  value?: any;
  userContext?: UserContext;
  error?: Error;
  timestamp: number;
}

export type FeatureFlagEventHandler = (event: FeatureFlagEvent) => void;

// Predefined feature flags for the application
export enum FeatureFlags {
  // UI/UX Features
  NEW_DASHBOARD = 'new-dashboard',
  DARK_MODE = 'dark-mode',
  ADVANCED_SEARCH = 'advanced-search',
  BETA_FEATURES = 'beta-features',
  
  // Business Features
  PREMIUM_FEATURES = 'premium-features',
  ANALYTICS_DASHBOARD = 'analytics-dashboard',
  EXPORT_FUNCTIONALITY = 'export-functionality',
  COLLABORATION_TOOLS = 'collaboration-tools',
  
  // Technical Features
  NEW_API_VERSION = 'new-api-version',
  ENHANCED_SECURITY = 'enhanced-security',
  PERFORMANCE_OPTIMIZATIONS = 'performance-optimizations',
  EXPERIMENTAL_FEATURES = 'experimental-features',
  
  // A/B Testing
  CHECKOUT_FLOW_V2 = 'checkout-flow-v2',
  ONBOARDING_FLOW_V2 = 'onboarding-flow-v2',
  PRICING_PAGE_V2 = 'pricing-page-v2',
  
  // Operational
  MAINTENANCE_MODE = 'maintenance-mode',
  READ_ONLY_MODE = 'read-only-mode',
  RATE_LIMITING = 'rate-limiting',
  DEBUG_MODE = 'debug-mode',
}

// Feature flag variants for A/B testing
export enum FeatureFlagVariants {
  CONTROL = 'control',
  VARIANT_A = 'variant-a',
  VARIANT_B = 'variant-b',
  VARIANT_C = 'variant-c',
}

// User segments for targeting
export enum UserSegments {
  BETA_USERS = 'beta-users',
  PREMIUM_USERS = 'premium-users',
  ENTERPRISE_USERS = 'enterprise-users',
  INTERNAL_USERS = 'internal-users',
  NEW_USERS = 'new-users',
  POWER_USERS = 'power-users',
}
