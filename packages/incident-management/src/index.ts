/**
 * Incident Management Package
 * 
 * Comprehensive incident management and response system
 */

// Core modules
export { IncidentManager } from './core/IncidentManager';

// Types
export * from './types';

// Providers
export * from './providers';

// Convenience factory function
import { IncidentManager } from './core/IncidentManager';

export function createIncidentManager(config: any): IncidentManager {
  return new IncidentManager(config);
}
