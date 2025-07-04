/**
 * SRE Package
 * 
 * Site Reliability Engineering tools and utilities
 */

// Core modules
export { SLOManager } from './core/SLOManager';

// Types
export * from './types';

// Monitoring
export * from './monitoring';

// Convenience factory function
import { SLOManager } from './core/SLOManager';

export function createSLOManager(config: any): SLOManager {
  return new SLOManager(config);
}
