import { Injectable, Logger } from '@nestjs/common';
import Redis from 'redis';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyGenerator?: (identifier: string, route: string) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

@Injectable()
export class RateLimitingService {
  private readonly logger = new Logger(RateLimitingService.name);
  private redis: Redis.RedisClientType;
  private readonly RATE_LIMIT_PREFIX = 'nexus:ratelimit';

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    this.redis = Redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });

    await this.redis.connect();
    this.logger.log('Connected to Redis for rate limiting');
  }

  async checkRateLimit(
    identifier: string,
    route: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = this.generateKey(identifier, route, config);
    const windowStart = Math.floor(Date.now() / config.windowMs) * config.windowMs;
    const windowEnd = windowStart + config.windowMs;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.multi();
      
      // Get current count
      pipeline.get(key);
      
      // Increment counter
      pipeline.incr(key);
      
      // Set expiration
      pipeline.expireAt(key, Math.ceil(windowEnd / 1000));
      
      const results = await pipeline.exec();
      
      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }

      const currentCount = parseInt(results[1] as string) || 1;
      const remaining = Math.max(0, config.max - currentCount);
      const resetTime = new Date(windowEnd);

      const allowed = currentCount <= config.max;

      if (!allowed) {
        this.logger.debug(`Rate limit exceeded for ${identifier} on route ${route}: ${currentCount}/${config.max}`);
      }

      return {
        allowed,
        remaining,
        resetTime,
        retryAfter: allowed ? undefined : Math.ceil((windowEnd - Date.now()) / 1000),
      };
    } catch (error) {
      this.logger.error('Rate limiting check failed:', error);
      
      // Fail open - allow request if Redis is unavailable
      return {
        allowed: true,
        remaining: config.max,
        resetTime: new Date(Date.now() + config.windowMs),
      };
    }
  }

  async checkMultipleRateLimits(
    identifier: string,
    route: string,
    configs: RateLimitConfig[]
  ): Promise<RateLimitResult> {
    const results = await Promise.all(
      configs.map(config => this.checkRateLimit(identifier, route, config))
    );

    // Return the most restrictive result
    const restrictive = results.find(result => !result.allowed);
    
    if (restrictive) {
      return restrictive;
    }

    // All limits passed, return the one with least remaining
    return results.reduce((min, current) => 
      current.remaining < min.remaining ? current : min
    );
  }

  async getRateLimitStatus(
    identifier: string,
    route: string,
    config: RateLimitConfig
  ): Promise<{
    current: number;
    limit: number;
    remaining: number;
    resetTime: Date;
  }> {
    const key = this.generateKey(identifier, route, config);
    const windowStart = Math.floor(Date.now() / config.windowMs) * config.windowMs;
    const windowEnd = windowStart + config.windowMs;

    try {
      const current = parseInt(await this.redis.get(key) || '0');
      const remaining = Math.max(0, config.max - current);

      return {
        current,
        limit: config.max,
        remaining,
        resetTime: new Date(windowEnd),
      };
    } catch (error) {
      this.logger.error('Failed to get rate limit status:', error);
      
      return {
        current: 0,
        limit: config.max,
        remaining: config.max,
        resetTime: new Date(Date.now() + config.windowMs),
      };
    }
  }

  async resetRateLimit(identifier: string, route: string, config: RateLimitConfig): Promise<void> {
    const key = this.generateKey(identifier, route, config);
    
    try {
      await this.redis.del(key);
      this.logger.debug(`Reset rate limit for ${identifier} on route ${route}`);
    } catch (error) {
      this.logger.error('Failed to reset rate limit:', error);
    }
  }

  // Advanced rate limiting strategies
  async slidingWindowRateLimit(
    identifier: string,
    route: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = `${this.RATE_LIMIT_PREFIX}:sliding:${identifier}:${route}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // Remove old entries and add current timestamp
      const pipeline = this.redis.multi();
      
      // Remove entries older than window
      pipeline.zRemRangeByScore(key, 0, windowStart);
      
      // Add current request
      pipeline.zAdd(key, { score: now, value: now.toString() });
      
      // Count current requests
      pipeline.zCard(key);
      
      // Set expiration
      pipeline.expire(key, Math.ceil(config.windowMs / 1000));
      
      const results = await pipeline.exec();
      
      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }

      const currentCount = results[2] as number;
      const remaining = Math.max(0, config.max - currentCount);
      const allowed = currentCount <= config.max;

      return {
        allowed,
        remaining,
        resetTime: new Date(now + config.windowMs),
        retryAfter: allowed ? undefined : Math.ceil(config.windowMs / 1000),
      };
    } catch (error) {
      this.logger.error('Sliding window rate limit check failed:', error);
      
      return {
        allowed: true,
        remaining: config.max,
        resetTime: new Date(now + config.windowMs),
      };
    }
  }

  // Token bucket rate limiting
  async tokenBucketRateLimit(
    identifier: string,
    route: string,
    config: RateLimitConfig & { refillRate: number; bucketSize: number }
  ): Promise<RateLimitResult> {
    const key = `${this.RATE_LIMIT_PREFIX}:bucket:${identifier}:${route}`;
    const now = Date.now();

    try {
      const bucketData = await this.redis.hGetAll(key);
      
      let tokens = parseInt(bucketData.tokens || config.bucketSize.toString());
      let lastRefill = parseInt(bucketData.lastRefill || now.toString());
      
      // Calculate tokens to add based on time elapsed
      const timePassed = now - lastRefill;
      const tokensToAdd = Math.floor((timePassed / 1000) * config.refillRate);
      
      tokens = Math.min(config.bucketSize, tokens + tokensToAdd);
      
      const allowed = tokens > 0;
      
      if (allowed) {
        tokens -= 1;
      }

      // Update bucket state
      await this.redis.hSet(key, {
        tokens: tokens.toString(),
        lastRefill: now.toString(),
      });
      
      await this.redis.expire(key, config.windowMs / 1000);

      return {
        allowed,
        remaining: tokens,
        resetTime: new Date(now + ((config.bucketSize - tokens) / config.refillRate) * 1000),
        retryAfter: allowed ? undefined : Math.ceil(1 / config.refillRate),
      };
    } catch (error) {
      this.logger.error('Token bucket rate limit check failed:', error);
      
      return {
        allowed: true,
        remaining: config.bucketSize,
        resetTime: new Date(now + config.windowMs),
      };
    }
  }

  private generateKey(identifier: string, route: string, config: RateLimitConfig): string {
    if (config.keyGenerator) {
      return config.keyGenerator(identifier, route);
    }
    
    return `${this.RATE_LIMIT_PREFIX}:${identifier}:${route}`;
  }

  // Rate limiting metrics
  async getMetrics(): Promise<{
    totalRequests: number;
    blockedRequests: number;
    topLimitedRoutes: Array<{ route: string; count: number }>;
    topLimitedIPs: Array<{ ip: string; count: number }>;
  }> {
    try {
      const keys = await this.redis.keys(`${this.RATE_LIMIT_PREFIX}:*`);
      
      let totalRequests = 0;
      let blockedRequests = 0;
      const routeCounts = new Map<string, number>();
      const ipCounts = new Map<string, number>();

      for (const key of keys) {
        const count = parseInt(await this.redis.get(key) || '0');
        totalRequests += count;
        
        // Extract route and IP from key
        const keyParts = key.split(':');
        if (keyParts.length >= 4) {
          const ip = keyParts[2];
          const route = keyParts[3];
          
          routeCounts.set(route, (routeCounts.get(route) || 0) + count);
          ipCounts.set(ip, (ipCounts.get(ip) || 0) + count);
        }
      }

      // Get top limited routes and IPs
      const topLimitedRoutes = Array.from(routeCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([route, count]) => ({ route, count }));

      const topLimitedIPs = Array.from(ipCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, count }));

      return {
        totalRequests,
        blockedRequests,
        topLimitedRoutes,
        topLimitedIPs,
      };
    } catch (error) {
      this.logger.error('Failed to get rate limiting metrics:', error);
      
      return {
        totalRequests: 0,
        blockedRequests: 0,
        topLimitedRoutes: [],
        topLimitedIPs: [],
      };
    }
  }

  // Cleanup expired rate limit entries
  async cleanup(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.RATE_LIMIT_PREFIX}:*`);
      const expiredKeys = [];

      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) { // No expiration set
          expiredKeys.push(key);
        }
      }

      if (expiredKeys.length > 0) {
        await this.redis.del(expiredKeys);
        this.logger.debug(`Cleaned up ${expiredKeys.length} expired rate limit entries`);
      }
    } catch (error) {
      this.logger.error('Rate limit cleanup failed:', error);
    }
  }
}
