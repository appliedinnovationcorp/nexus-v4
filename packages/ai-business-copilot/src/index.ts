/**
 * AI Business Copilot Package
 * 
 * The GitHub Copilot for SMB Getting Things Done
 * AI-powered business automation and productivity for small-to-medium businesses
 */

// Core AI Copilot
export { AIBusinessCopilot } from './core/business-copilot';

// Types
export * from './types';

// Utilities and helpers
export { CopilotError } from './types';

// Version
export const VERSION = '1.0.0';

// Default configurations
export const DEFAULT_CONFIG = {
  aiProvider: 'openai' as const,
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 1000,
  riskTolerance: 'moderate' as const,
  automationLevel: 'semi_automatic' as const,
  reportingFrequency: 'weekly' as const,
};
