/**
 * Technology Radar & API Versioning Package
 * 
 * Comprehensive technology lifecycle management and API versioning strategy
 */

// Core modules
export { TechRadarManager } from './core/tech-radar-manager';
export { APIVersionManager } from './api/api-version-manager';
export { RadarGenerator } from './visualization/radar-generator';

// Types
export * from './types';

// CLI (for programmatic access)
export { program as TechRadarCLI } from './cli/tech-radar-cli';
