import NodeCache from 'node-cache';
import { createClient, RedisClientType } from 'redis';
import { SecretCache, Secret, SecretManagerConfig } from './types';

export class MemorySecretCache implements SecretCache {
  private cache: NodeCache;

  constructor(ttl: number = 300, maxSize: number = 1000) {
    this.cache = new NodeCache({
      stdTTL: ttl,
      checkperiod: ttl * 0.2,
      useClones: false,
      maxKeys: maxSize,
    });
  }

  async get(key: string): Promise<Secret | null> {
    const cached = this.cache.get(key);
    return cached ? (cached as Secret) : null;
  }

  async set(key: string, secret: Secret, ttl?: number): Promise<void> {
    this.cache.set(key, secret, ttl);
  }

  async delete(key: string): Promise<void> {
    this.cache.del(key);
  }

  async clear(): Promise<void> {
    this.cache.flushAll();
  }

  async size(): Promise<number> {
    return this.cache.keys().length;
  }
}

export class RedisSecretCache implements SecretCache {
  private client: RedisClientType;
  private defaultTtl: number;
  private keyPrefix: string;

  constructor(config: NonNullable<SecretManagerConfig['cache']>, environment: string) {
    if (!config.redis) {
      throw new Error('Redis configuration is required');
    }

    this.defaultTtl = config.ttl || 300;
    this.keyPrefix = `nexus:secrets:${environment}:`;
    
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db || 0,
    });

    this.client.on('error', (error) => {
      console.error('Redis secret cache error:', error);
    });
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async get(key: string): Promise<Secret | null> {
    await this.connect();
    
    try {
      const cacheKey = this.keyPrefix + key;
      const value = await this.client.get(cacheKey);
      
      if (!value) {
        return null;
      }

      const parsed = JSON.parse(value);
      
      // Convert date strings back to Date objects
      if (parsed.metadata) {
        if (parsed.metadata.createdAt) {
          parsed.metadata.createdAt = new Date(parsed.metadata.createdAt);
        }
        if (parsed.metadata.updatedAt) {
          parsed.metadata.updatedAt = new Date(parsed.metadata.updatedAt);
        }
        if (parsed.metadata.expiresAt) {
          parsed.metadata.expiresAt = new Date(parsed.metadata.expiresAt);
        }
      }

      return parsed as Secret;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, secret: Secret, ttl?: number): Promise<void> {
    await this.connect();
    
    try {
      const cacheKey = this.keyPrefix + key;
      const serialized = JSON.stringify(secret);
      const expiration = ttl || this.defaultTtl;
      
      await this.client.setEx(cacheKey, expiration, serialized);
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    await this.connect();
    
    try {
      const cacheKey = this.keyPrefix + key;
      await this.client.del(cacheKey);
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }

  async clear(): Promise<void> {
    await this.connect();
    
    try {
      const keys = await this.client.keys(this.keyPrefix + '*');
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }

  async size(): Promise<number> {
    await this.connect();
    
    try {
      const keys = await this.client.keys(this.keyPrefix + '*');
      return keys.length;
    } catch (error) {
      console.error('Redis size error:', error);
      return 0;
    }
  }

  async close(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}

export class EncryptedSecretCache implements SecretCache {
  private cache: SecretCache;
  private encryptionKey: string;

  constructor(cache: SecretCache, encryptionKey: string) {
    this.cache = cache;
    this.encryptionKey = encryptionKey;
  }

  async get(key: string): Promise<Secret | null> {
    const encrypted = await this.cache.get(key);
    if (!encrypted) {
      return null;
    }

    try {
      // Decrypt the secret value
      const decryptedValue = this.decrypt(encrypted.value as string);
      
      return {
        ...encrypted,
        value: decryptedValue,
      };
    } catch (error) {
      console.error('Failed to decrypt cached secret:', error);
      return null;
    }
  }

  async set(key: string, secret: Secret, ttl?: number): Promise<void> {
    try {
      // Encrypt the secret value
      const encryptedValue = this.encrypt(
        typeof secret.value === 'string' ? secret.value : JSON.stringify(secret.value)
      );
      
      const encryptedSecret: Secret = {
        ...secret,
        value: encryptedValue,
      };

      await this.cache.set(key, encryptedSecret, ttl);
    } catch (error) {
      console.error('Failed to encrypt secret for cache:', error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.cache.delete(key);
  }

  async clear(): Promise<void> {
    await this.cache.clear();
  }

  async size(): Promise<number> {
    return await this.cache.size();
  }

  private encrypt(value: string): string {
    const crypto = require('crypto');
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);
    cipher.setAAD(Buffer.from('nexus-secret-cache', 'utf8'));
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      iv: iv.toString('hex'),
      encrypted,
      authTag: authTag.toString('hex'),
    });
  }

  private decrypt(encryptedData: string): string {
    const crypto = require('crypto');
    const algorithm = 'aes-256-gcm';
    
    const data = JSON.parse(encryptedData);
    const iv = Buffer.from(data.iv, 'hex');
    const authTag = Buffer.from(data.authTag, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
    decipher.setAAD(Buffer.from('nexus-secret-cache', 'utf8'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

export function createSecretCache(config: SecretManagerConfig): SecretCache | null {
  if (!config.cache?.enabled) {
    return null;
  }

  const ttl = config.cache.ttl || 300;
  const maxSize = config.cache.maxSize || 1000;

  let cache: SecretCache;

  if (config.cache.redis) {
    cache = new RedisSecretCache(config.cache, config.environment);
  } else {
    cache = new MemorySecretCache(ttl, maxSize);
  }

  // Add encryption layer if encryption key is provided
  if (config.security?.encryptionKey) {
    cache = new EncryptedSecretCache(cache, config.security.encryptionKey);
  }

  return cache;
}

// Cache warming utility
export class SecretCacheWarmer {
  private cache: SecretCache;
  private provider: any; // SecretProvider
  private warmupKeys: string[];

  constructor(cache: SecretCache, provider: any, warmupKeys: string[] = []) {
    this.cache = cache;
    this.provider = provider;
    this.warmupKeys = warmupKeys;
  }

  async warmup(): Promise<void> {
    console.log('Warming up secret cache...');
    
    const promises = this.warmupKeys.map(async (key) => {
      try {
        const secret = await this.provider.getSecret(key);
        if (secret) {
          await this.cache.set(key, secret);
        }
      } catch (error) {
        console.warn(`Failed to warm up secret ${key}:`, error.message);
      }
    });

    await Promise.allSettled(promises);
    console.log(`Cache warmed up with ${this.warmupKeys.length} secrets`);
  }

  async refresh(): Promise<void> {
    console.log('Refreshing secret cache...');
    
    // Clear existing cache
    await this.cache.clear();
    
    // Warm up again
    await this.warmup();
  }

  addWarmupKey(key: string): void {
    if (!this.warmupKeys.includes(key)) {
      this.warmupKeys.push(key);
    }
  }

  removeWarmupKey(key: string): void {
    const index = this.warmupKeys.indexOf(key);
    if (index > -1) {
      this.warmupKeys.splice(index, 1);
    }
  }
}
