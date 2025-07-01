/**
 * Shared database utilities for Nexus workspace
 * Provides database-agnostic connection management and utilities
 */

// Configuration
export * from './config';

// PostgreSQL
export * from './postgresql';

// MongoDB
export * from './mongodb';

// Redis
export * from './redis';

// Combined utilities
import {
  initializePostgreSQL,
  closePostgreSQL,
  checkPostgreSQLHealth,
} from './postgresql';
import {
  initializeMongoDB,
  closeMongoDB,
  checkMongoDBHealth,
} from './mongodb';
import {
  initializeRedis,
  closeRedis,
  checkRedisHealth,
} from './redis';
import { getDatabaseConfig, validateDatabaseConfig } from './config';

/**
 * Initialize all database connections
 */
export async function initializeDatabases(): Promise<{
  postgresql: boolean;
  mongodb: boolean;
  redis: boolean;
  errors: string[];
}> {
  const config = getDatabaseConfig();
  const validation = validateDatabaseConfig(config);
  
  if (!validation.isValid) {
    return {
      postgresql: false,
      mongodb: false,
      redis: false,
      errors: validation.errors,
    };
  }

  const results = {
    postgresql: false,
    mongodb: false,
    redis: false,
    errors: [] as string[],
  };

  // Initialize PostgreSQL
  try {
    await initializePostgreSQL(config.postgresql);
    results.postgresql = true;
  } catch (error) {
    results.errors.push(`PostgreSQL: ${error}`);
  }

  // Initialize MongoDB
  try {
    await initializeMongoDB(config.mongodb);
    results.mongodb = true;
  } catch (error) {
    results.errors.push(`MongoDB: ${error}`);
  }

  // Initialize Redis
  try {
    await initializeRedis(config.redis);
    results.redis = true;
  } catch (error) {
    results.errors.push(`Redis: ${error}`);
  }

  return results;
}

/**
 * Close all database connections
 */
export async function closeDatabases(): Promise<void> {
  await Promise.all([
    closePostgreSQL().catch(() => {}),
    closeMongoDB().catch(() => {}),
    closeRedis().catch(() => {}),
  ]);
}

/**
 * Check health of all databases
 */
export async function checkDatabasesHealth(): Promise<{
  postgresql: {
    connected: boolean;
    latency?: number;
    error?: string;
    poolStats?: any;
  };
  mongodb: {
    connected: boolean;
    latency?: number;
    error?: string;
    stats?: any;
    collections?: string[];
  };
  redis: {
    connected: boolean;
    latency?: number;
    error?: string;
    info?: any;
  };
  overall: {
    healthy: boolean;
    connectedCount: number;
    totalCount: number;
  };
}> {
  const [postgresql, mongodb, redis] = await Promise.all([
    checkPostgreSQLHealth().catch(error => ({ 
      connected: false, 
      error: String(error) 
    })),
    checkMongoDBHealth().catch(error => ({ 
      connected: false, 
      error: String(error) 
    })),
    checkRedisHealth().catch(error => ({ 
      connected: false, 
      error: String(error) 
    })),
  ]);

  const connectedCount = [postgresql, mongodb, redis].filter(
    db => db.connected
  ).length;

  return {
    postgresql,
    mongodb,
    redis,
    overall: {
      healthy: connectedCount === 3,
      connectedCount,
      totalCount: 3,
    },
  };
}

/**
 * Database connection manager
 */
export class DatabaseManager {
  private initialized = false;

  /**
   * Initialize all database connections
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const results = await initializeDatabases();
    
    if (results.errors.length > 0) {
      throw new Error(`Database initialization failed: ${results.errors.join(', ')}`);
    }

    this.initialized = true;
  }

  /**
   * Close all database connections
   */
  async close(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    await closeDatabases();
    this.initialized = false;
  }

  /**
   * Check if databases are initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get health status of all databases
   */
  async getHealthStatus(): Promise<any> {
    return await checkDatabasesHealth();
  }

  /**
   * Restart all database connections
   */
  async restart(): Promise<void> {
    await this.close();
    await this.initialize();
  }
}

// Singleton instance
let databaseManager: DatabaseManager | null = null;

/**
 * Get the shared database manager instance
 */
export function getDatabaseManager(): DatabaseManager {
  if (!databaseManager) {
    databaseManager = new DatabaseManager();
  }
  return databaseManager;
}

/**
 * Initialize databases using the shared manager
 */
export async function initializeSharedDatabases(): Promise<void> {
  const manager = getDatabaseManager();
  await manager.initialize();
}

/**
 * Close databases using the shared manager
 */
export async function closeSharedDatabases(): Promise<void> {
  const manager = getDatabaseManager();
  await manager.close();
}

/**
 * Get shared database health status
 */
export async function getSharedDatabaseHealth(): Promise<any> {
  const manager = getDatabaseManager();
  return await manager.getHealthStatus();
}
