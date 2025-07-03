// Feature Flag System for Nexus Workspace

export * from './types';
export * from './client';
export * from './cache';
export * from './providers/unleash.provider';
export * from './providers/launchdarkly.provider';
export * from './providers/local.provider';

// Re-export main client
export { FeatureFlagClient } from './client';

// Convenience factory function
import { FeatureFlagClient } from './client';
import { FeatureFlagConfig } from './types';

export function createFeatureFlagClient(config: FeatureFlagConfig): FeatureFlagClient {
  return new FeatureFlagClient(config);
}

// Default configuration helpers
export const defaultConfigs = {
  unleash: (url: string, appName: string, clientKey?: string): FeatureFlagConfig => ({
    provider: 'unleash',
    environment: process.env.NODE_ENV || 'development',
    unleash: {
      url,
      appName,
      clientKey,
      refreshInterval: 15000,
      metricsInterval: 60000,
    },
    cache: {
      enabled: true,
      ttl: 300,
    },
    monitoring: {
      enabled: true,
      logEvaluations: process.env.NODE_ENV === 'development',
      trackMetrics: true,
    },
  }),

  launchdarkly: (sdkKey: string): FeatureFlagConfig => ({
    provider: 'launchdarkly',
    environment: process.env.NODE_ENV || 'development',
    launchdarkly: {
      sdkKey,
      timeout: 5,
    },
    cache: {
      enabled: true,
      ttl: 300,
    },
    monitoring: {
      enabled: true,
      logEvaluations: process.env.NODE_ENV === 'development',
      trackMetrics: true,
    },
  }),

  local: (flags: Record<string, any> = {}): FeatureFlagConfig => ({
    provider: 'local',
    environment: process.env.NODE_ENV || 'development',
    local: {
      flags,
    },
    cache: {
      enabled: false,
    },
    monitoring: {
      enabled: true,
      logEvaluations: true,
      trackMetrics: true,
    },
  }),
};
