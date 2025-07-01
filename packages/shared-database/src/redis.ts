/**
 * Redis database utilities for Nexus workspace
 * Provides connection management and caching utilities
 */

import { createClient } from 'redis';
import type { RedisConfig } from './config';
import { getDatabaseConfig } from './config';

export class RedisConnection {
  private client: any = null;
  private config: RedisConfig;

  constructor(config?: RedisConfig) {
    this.config = config || getDatabaseConfig().redis;
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    const options = {
      socket: {
        host: this.config.host,
        port: this.config.port,
        connectTimeout: this.config.connectTimeout,
      },
      password: this.config.password,
      database: this.config.database,
    };

    this.client = createClient(options);

    try {
      await this.client.connect();
      await this.client.ping();
    } catch (error) {
      await this.disconnect();
      throw new Error(`Failed to connect to Redis: ${error}`);
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  /**
   * Get the Redis client
   */
  getClient(): any {
    if (!this.client) {
      throw new Error('Redis not connected. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Check if Redis is connected and healthy
   */
  async healthCheck(): Promise<{
    connected: boolean;
    latency?: number;
    error?: string;
  }> {
    if (!this.client) {
      return { connected: false, error: 'Not connected' };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return { connected: true, latency };
    } catch (error) {
      return { connected: false, error: String(error) };
    }
  }

  /**
   * Get Redis server information
   */
  async getInfo(): Promise<any> {
    if (!this.client) {
      throw new Error('Redis not connected. Call connect() first.');
    }

    try {
      const info = await this.client.info();
      return this.parseRedisInfo(info);
    } catch (error) {
      throw new Error(`Failed to get Redis info: ${error}`);
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    const sections = info.split('\r\n\r\n');

    for (const section of sections) {
      const lines = section.split('\r\n');
      const sectionName = lines[0].replace('# ', '').toLowerCase();
      
      if (sectionName) {
        result[sectionName] = {};
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (line && line.includes(':')) {
            const [key, value] = line.split(':');
            result[sectionName][key] = isNaN(Number(value)) ? value : Number(value);
          }
        }
      }
    }

    return result;
  }

  /**
   * Get connection information
   */
  getConnectionInfo(): {
    host: string;
    port: number;
    database: number;
  } {
    return {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database || 0,
    };
  }
}

// Singleton instance for shared use
let sharedConnection: RedisConnection | null = null;

/**
 * Get the shared Redis connection instance
 */
export function getRedisConnection(config?: RedisConfig): RedisConnection {
  if (!sharedConnection) {
    sharedConnection = new RedisConnection(config);
  }
  return sharedConnection;
}

/**
 * Initialize the shared Redis connection
 */
export async function initializeRedis(config?: RedisConfig): Promise<void> {
  const connection = getRedisConnection(config);
  await connection.connect();
}

/**
 * Close the shared Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (sharedConnection) {
    await sharedConnection.disconnect();
    sharedConnection = null;
  }
}

/**
 * Get the Redis client using the shared connection
 */
export function getRedisClient(): any {
  const connection = getRedisConnection();
  return connection.getClient();
}

/**
 * Check Redis health using the shared connection
 */
export async function checkRedisHealth(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
  info?: any;
}> {
  try {
    const connection = getRedisConnection();
    const health = await connection.healthCheck();
    
    if (health.connected) {
      const info = await connection.getInfo().catch(() => null);
      return {
        ...health,
        info,
      };
    }
    
    return health;
  } catch (error) {
    return { connected: false, error: String(error) };
  }
}

/**
 * Common Redis operations
 */
export const redisOperations = {
  /**
   * Set a key-value pair
   */
  async set(key: string, value: string, ttl?: number): Promise<string | null> {
    const client = getRedisClient();
    if (ttl) {
      return await client.setEx(key, ttl, value);
    }
    return await client.set(key, value);
  },

  /**
   * Get a value by key
   */
  async get(key: string): Promise<string | null> {
    const client = getRedisClient();
    return await client.get(key);
  },

  /**
   * Delete a key
   */
  async del(key: string): Promise<number> {
    const client = getRedisClient();
    return await client.del(key);
  },

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<number> {
    const client = getRedisClient();
    return await client.exists(key);
  },

  /**
   * Set expiration for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const client = getRedisClient();
    return await client.expire(key, seconds);
  },

  /**
   * Get time to live for a key
   */
  async ttl(key: string): Promise<number> {
    const client = getRedisClient();
    return await client.ttl(key);
  },

  /**
   * Set a JSON object
   */
  async setJSON(key: string, value: any, ttl?: number): Promise<string | null> {
    const serialized = JSON.stringify(value);
    return await redisOperations.set(key, serialized, ttl);
  },

  /**
   * Get a JSON object
   */
  async getJSON<T = any>(key: string): Promise<T | null> {
    const value = await redisOperations.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON for key ${key}: ${error}`);
    }
  },

  /**
   * Increment a numeric value
   */
  async incr(key: string): Promise<number> {
    const client = getRedisClient();
    return await client.incr(key);
  },

  /**
   * Increment by a specific amount
   */
  async incrBy(key: string, increment: number): Promise<number> {
    const client = getRedisClient();
    return await client.incrBy(key, increment);
  },

  /**
   * Decrement a numeric value
   */
  async decr(key: string): Promise<number> {
    const client = getRedisClient();
    return await client.decr(key);
  },

  /**
   * Get keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    const client = getRedisClient();
    return await client.keys(pattern);
  },

  /**
   * Flush all data from current database
   */
  async flushdb(): Promise<string> {
    const client = getRedisClient();
    return await client.flushDb();
  },

  /**
   * Flush all data from all databases
   */
  async flushall(): Promise<string> {
    const client = getRedisClient();
    return await client.flushAll();
  },
};
