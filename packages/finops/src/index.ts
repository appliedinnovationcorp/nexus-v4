/**
 * FinOps & Cost Management Package
 * 
 * Comprehensive cloud cost management and optimization tools
 */

// Core modules
export { ResourceTaggingManager } from './core/tagging';
export { CostMonitoringManager } from './core/cost-monitoring';
export { CostEstimationEngine } from './core/cost-estimation';

// CI/CD integration
export { CostImpactAnalyzer } from './ci/cost-impact-analyzer';

// Types
export * from './types';

// React hooks (if React is available)
export * from './react/hooks';

// Default export for convenience
export { FinOpsManager } from './finops-manager';
