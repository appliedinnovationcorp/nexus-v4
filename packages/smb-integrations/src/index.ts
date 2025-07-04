/**
 * SMB Integrations Package
 * 
 * Popular business tool integrations for SMBs
 * QuickBooks, Shopify, Gmail, Slack, and more
 */

// Integrations
export { QuickBooksIntegration } from './integrations/quickbooks';

// Types
export * from './types';

// Utilities
export { IntegrationError } from './types';

// Popular integrations list
export { POPULAR_INTEGRATIONS } from './types';

// Version
export const VERSION = '1.0.0';
