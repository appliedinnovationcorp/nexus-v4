import { FeatureFlagProvider, FeatureFlagConfig, UserContext, FeatureFlagCache, FeatureFlagEvent, FeatureFlagEventHandler, FeatureFlagEvaluation, FeatureFlagMetrics } from './types';
import { UnleashProvider } from './providers/unleash.provider';
import { LaunchDarklyProvider } from './providers/launchdarkly.provider';
import { LocalProvider } from './providers/local.provider';
import { createCache } from './cache';

export class FeatureFlagClient {
  private provider: FeatureFlagProvider;
  private cache: FeatureFlagCache | null;
  private config: FeatureFlagConfig;
  private metrics: Map<string, FeatureFlagMetrics> = new Map();
  private eventHandlers: FeatureFlagEventHandler[] = [];

  constructor(config: FeatureFlagConfig) {
    this.config = config;
    this.cache = createCache(config);
    this.provider = this.createProvider(config);
    
    // Set up event handling
    this.provider.onEvent(this.handleProviderEvent.bind(this));
  }

  private createProvider(config: FeatureFlagConfig): FeatureFlagProvider {
    switch (config.provider) {
      case 'unleash':
        return new UnleashProvider(config);
      case 'launchdarkly':
        return new LaunchDarklyProvider(config);
      case 'local':
        return new LocalProvider(config);
      default:
        throw new Error(`Unsupported feature flag provider: ${config.provider}`);
    }
  }

  async initialize(): Promise<void> {
    await this.provider.initialize();
  }

  async isEnabled(flagKey: string, userContext?: UserContext, defaultValue: boolean = false): Promise<boolean> {
    const cacheKey = this.buildCacheKey(flagKey, userContext);
    
    // Try cache first
    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached !== undefined) {
        this.recordMetric(flagKey, cached, userContext);
        return cached;
      }
    }

    // Evaluate flag
    const result = await this.provider.isEnabled(flagKey, userContext, defaultValue);
    
    // Cache result
    if (this.cache) {
      await this.cache.set(cacheKey, result, this.config.cache?.ttl);
    }

    // Record metrics
    this.recordMetric(flagKey, result, userContext);

    return result;
  }

  async getVariant(flagKey: string, userContext?: UserContext, defaultValue: string = 'control'): Promise<string> {
    const cacheKey = this.buildCacheKey(flagKey, userContext);
    
    // Try cache first
    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached !== undefined) {
        this.recordMetric(flagKey, cached, userContext);
        return cached;
      }
    }

    // Evaluate flag
    const result = await this.provider.getVariant(flagKey, userContext, defaultValue);
    
    // Cache result
    if (this.cache) {
      await this.cache.set(cacheKey, result, this.config.cache?.ttl);
    }

    // Record metrics
    this.recordMetric(flagKey, result, userContext);

    return result;
  }

  async getNumber(flagKey: string, userContext?: UserContext, defaultValue: number = 0): Promise<number> {
    const cacheKey = this.buildCacheKey(flagKey, userContext);
    
    // Try cache first
    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached !== undefined) {
        this.recordMetric(flagKey, cached, userContext);
        return cached;
      }
    }

    // Evaluate flag
    const result = await this.provider.getNumber(flagKey, userContext, defaultValue);
    
    // Cache result
    if (this.cache) {
      await this.cache.set(cacheKey, result, this.config.cache?.ttl);
    }

    // Record metrics
    this.recordMetric(flagKey, result, userContext);

    return result;
  }

  async getString(flagKey: string, userContext?: UserContext, defaultValue: string = ''): Promise<string> {
    const cacheKey = this.buildCacheKey(flagKey, userContext);
    
    // Try cache first
    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached !== undefined) {
        this.recordMetric(flagKey, cached, userContext);
        return cached;
      }
    }

    // Evaluate flag
    const result = await this.provider.getString(flagKey, userContext, defaultValue);
    
    // Cache result
    if (this.cache) {
      await this.cache.set(cacheKey, result, this.config.cache?.ttl);
    }

    // Record metrics
    this.recordMetric(flagKey, result, userContext);

    return result;
  }

  async getAllFlags(userContext?: UserContext): Promise<Record<string, any>> {
    const cacheKey = this.buildCacheKey('__all_flags__', userContext);
    
    // Try cache first
    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    // Get all flags
    const result = await this.provider.getAllFlags(userContext);
    
    // Cache result with shorter TTL for all flags
    if (this.cache) {
      const ttl = Math.min(this.config.cache?.ttl || 300, 60); // Max 1 minute for all flags
      await this.cache.set(cacheKey, result, ttl);
    }

    return result;
  }

  // Convenience methods for common patterns
  async when<T>(flagKey: string, userContext?: UserContext): Promise<{
    enabled: (callback: () => T | Promise<T>) => Promise<T | undefined>;
    disabled: (callback: () => T | Promise<T>) => Promise<T | undefined>;
    variant: (variants: Record<string, () => T | Promise<T>>) => Promise<T | undefined>;
  }> {
    const isEnabled = await this.isEnabled(flagKey, userContext);
    const variant = await this.getVariant(flagKey, userContext);

    return {
      enabled: async (callback: () => T | Promise<T>) => {
        return isEnabled ? await callback() : undefined;
      },
      disabled: async (callback: () => T | Promise<T>) => {
        return !isEnabled ? await callback() : undefined;
      },
      variant: async (variants: Record<string, () => T | Promise<T>>) => {
        const variantCallback = variants[variant];
        return variantCallback ? await variantCallback() : undefined;
      },
    };
  }

  // Batch evaluation for performance
  async evaluateFlags(flagKeys: string[], userContext?: UserContext): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    // Use Promise.all for parallel evaluation
    const evaluations = await Promise.allSettled(
      flagKeys.map(async (flagKey) => ({
        flagKey,
        value: await this.isEnabled(flagKey, userContext),
      }))
    );

    evaluations.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results[result.value.flagKey] = result.value.value;
      } else {
        results[flagKeys[index]] = false; // Default to false on error
      }
    });

    return results;
  }

  // Event handling
  onEvent(handler: FeatureFlagEventHandler): void {
    this.eventHandlers.push(handler);
  }

  // Metrics
  getMetrics(): Map<string, FeatureFlagMetrics> {
    return new Map(this.metrics);
  }

  clearMetrics(): void {
    this.metrics.clear();
  }

  // Cache management
  async clearCache(): Promise<void> {
    if (this.cache) {
      await this.cache.clear();
    }
  }

  async invalidateFlag(flagKey: string, userContext?: UserContext): Promise<void> {
    if (this.cache) {
      const cacheKey = this.buildCacheKey(flagKey, userContext);
      await this.cache.delete(cacheKey);
    }
  }

  // Cleanup
  async close(): Promise<void> {
    await this.provider.close();
    
    if (this.cache && 'close' in this.cache) {
      await (this.cache as any).close();
    }
  }

  private buildCacheKey(flagKey: string, userContext?: UserContext): string {
    if (!userContext) {
      return `flag:${flagKey}:anonymous`;
    }

    const contextHash = this.hashUserContext(userContext);
    return `flag:${flagKey}:${contextHash}`;
  }

  private hashUserContext(userContext: UserContext): string {
    // Simple hash of user context for cache key
    const contextString = JSON.stringify({
      userId: userContext.userId,
      email: userContext.email,
      country: userContext.country,
      region: userContext.region,
      organization: userContext.organization,
      plan: userContext.plan,
      role: userContext.role,
      beta: userContext.beta,
      customAttributes: userContext.customAttributes,
    });

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < contextString.length; i++) {
      const char = contextString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  private recordMetric(flagKey: string, value: any, userContext?: UserContext): void {
    if (!this.config.monitoring?.trackMetrics) {
      return;
    }

    const existing = this.metrics.get(flagKey) || {
      flagKey,
      evaluations: 0,
      trueEvaluations: 0,
      falseEvaluations: 0,
      variants: {},
      lastEvaluated: 0,
    };

    existing.evaluations++;
    existing.lastEvaluated = Date.now();

    if (typeof value === 'boolean') {
      if (value) {
        existing.trueEvaluations++;
      } else {
        existing.falseEvaluations++;
      }
    } else if (typeof value === 'string') {
      existing.variants[value] = (existing.variants[value] || 0) + 1;
    }

    this.metrics.set(flagKey, existing);
  }

  private handleProviderEvent(event: FeatureFlagEvent): void {
    // Log evaluations if enabled
    if (this.config.monitoring?.logEvaluations && event.type === 'evaluation') {
      console.log(`Feature flag evaluation: ${event.flagKey} = ${event.value}`, {
        userContext: event.userContext,
        timestamp: new Date(event.timestamp).toISOString(),
      });
    }

    // Clear cache on updates
    if (event.type === 'update' && this.cache) {
      this.cache.clear().catch(console.error);
    }

    // Forward event to handlers
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in feature flag event handler:', error);
      }
    });
  }
}
