import NodeCache from 'node-cache';
import { createClient, RedisClientType } from 'redis';
import { FeatureFlagCache, FeatureFlagConfig } from './types';

export class MemoryCache implements FeatureFlagCache {
  private cache: NodeCache;

  constructor(ttl: number = 300) { // 5 minutes default
    this.cache = new NodeCache({
      stdTTL: ttl,
      checkperiod: ttl * 0.2,
      useClones: false,
    });
  }

  async get(key: string): Promise<any> {
    return this.cache.get(key);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    this.cache.set(key, value, ttl);
  }

  async delete(key: string): Promise<void> {
    this.cache.del(key);
  }

  async clear(): Promise<void> {
    this.cache.flushAll();
  }
}

export class RedisCache implements FeatureFlagCache {
  private client: RedisClientType;
  private defaultTtl: number;

  constructor(config: NonNullable<FeatureFlagConfig['cache']>['redis'], defaultTtl: number = 300) {
    if (!config) {
      throw new Error('Redis configuration is required');
    }

    this.defaultTtl = defaultTtl;
    this.client = createClient({
      socket: {
        host: config.host,
        port: config.port,
      },
      password: config.password,
      database: config.db || 0,
    });

    this.client.on('error', (error) => {
      console.error('Redis cache error:', error);
    });
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async get(key: string): Promise<any> {
    await this.connect();
    
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : undefined;
    } catch (error) {
      console.error('Redis get error:', error);
      return undefined;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    await this.connect();
    
    try {
      const serialized = JSON.stringify(value);
      const expiration = ttl || this.defaultTtl;
      
      await this.client.setEx(key, expiration, serialized);
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    await this.connect();
    
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }

  async clear(): Promise<void> {
    await this.connect();
    
    try {
      await this.client.flushDb();
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }

  async close(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}

export function createCache(config: FeatureFlagConfig): FeatureFlagCache | null {
  if (!config.cache?.enabled) {
    return null;
  }

  const ttl = config.cache.ttl || 300;

  if (config.cache.redis) {
    return new RedisCache(config.cache.redis, ttl);
  }

  return new MemoryCache(ttl);
}
