/**
 * Analytics Package
 * 
 * Comprehensive analytics and tracking system
 */

// Core modules
export { AnalyticsManager } from './core/AnalyticsManager';

// Types
export * from './types';

// Providers
export * from './providers/PostHogProvider';
export * from './providers/MixpanelProvider';

// React hooks (if React is available)
export * from './react/hooks';

// Convenience factory function
import { AnalyticsManager } from './core/AnalyticsManager';
import { AnalyticsConfig } from './types';

export function createAnalyticsManager(config: AnalyticsConfig): AnalyticsManager {
  return new AnalyticsManager(config);
}

// Re-export for compatibility
export { AnalyticsManager as AnalyticsTracker } from './core/AnalyticsManager';
