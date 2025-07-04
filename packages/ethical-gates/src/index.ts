/**
 * Ethical & Sustainable Quality Gates Package
 * 
 * Automated accessibility and carbon footprint compliance checks
 */

// Core modules
export { EthicalGatesManager } from './core/ethical-gates-manager';
export { AccessibilityAuditor } from './accessibility/accessibility-auditor';
export { CarbonFootprintEstimator } from './carbon/carbon-estimator';

// Types
export * from './types';

// CLI (for programmatic access)
export { program as EthicalGatesCLI } from './cli/ethical-gates-cli';

// GitHub Actions (for programmatic access)
export { run as runGitHubAction } from './github-actions/index';
