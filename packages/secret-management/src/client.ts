import { 
  SecretProvider, 
  SecretManagerConfig, 
  Secret, 
  SecretMetadata, 
  SecretCache, 
  SecretAuditEvent, 
  SecretAuditHandler,
  SecretKeys 
} from './types';
import { VaultProvider } from './providers/vault.provider';
import { AWSSecretsManagerProvider } from './providers/aws-secrets-manager.provider';
import { KubernetesProvider } from './providers/kubernetes.provider';
import { createSecretCache, SecretCacheWarmer } from './cache';

export class SecretManagerClient {
  private providers: Map<string, SecretProvider> = new Map();
  private primaryProvider: SecretProvider;
  private cache: SecretCache | null;
  private cacheWarmer: SecretCacheWarmer | null = null;
  private config: SecretManagerConfig;
  private auditHandlers: SecretAuditHandler[] = [];
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor(config: SecretManagerConfig) {
    this.config = config;
    this.cache = createSecretCache(config);
    this.primaryProvider = this.createProvider(config);
    
    // Set up audit handling
    this.primaryProvider.onAudit?.(this.handleAuditEvent.bind(this));
  }

  private createProvider(config: SecretManagerConfig): SecretProvider {
    switch (config.provider) {
      case 'vault':
        const vaultProvider = new VaultProvider(config);
        this.providers.set('vault', vaultProvider);
        return vaultProvider;
        
      case 'aws-secrets-manager':
        const awsProvider = new AWSSecretsManagerProvider(config);
        this.providers.set('aws-secrets-manager', awsProvider);
        return awsProvider;
        
      case 'kubernetes':
        const k8sProvider = new KubernetesProvider(config);
        this.providers.set('kubernetes', k8sProvider);
        return k8sProvider;
        
      case 'multi':
        return this.createMultiProvider(config);
        
      default:
        throw new Error(`Unsupported secret provider: ${config.provider}`);
    }
  }

  private createMultiProvider(config: SecretManagerConfig): SecretProvider {
    if (!config.multi) {
      throw new Error('Multi-provider configuration is required');
    }

    // Create all configured providers
    const providers: SecretProvider[] = [];
    
    if (config.vault) {
      const vaultProvider = new VaultProvider({ ...config, provider: 'vault' });
      this.providers.set('vault', vaultProvider);
      providers.push(vaultProvider);
    }
    
    if (config.aws) {
      const awsProvider = new AWSSecretsManagerProvider({ ...config, provider: 'aws-secrets-manager' });
      this.providers.set('aws-secrets-manager', awsProvider);
      providers.push(awsProvider);
    }
    
    if (config.kubernetes) {
      const k8sProvider = new KubernetesProvider({ ...config, provider: 'kubernetes' });
      this.providers.set('kubernetes', k8sProvider);
      providers.push(k8sProvider);
    }

    // Return a multi-provider wrapper
    return new MultiProvider(providers, config.multi);
  }

  async initialize(): Promise<void> {
    await this.primaryProvider.initialize();
    
    // Initialize all providers in multi-provider setup
    if (this.config.provider === 'multi') {
      const initPromises = Array.from(this.providers.values()).map(provider => 
        provider.initialize().catch(error => {
          console.warn(`Failed to initialize provider:`, error.message);
        })
      );
      await Promise.allSettled(initPromises);
    }

    // Set up cache warming
    if (this.cache) {
      const warmupKeys = Object.values(SecretKeys);
      this.cacheWarmer = new SecretCacheWarmer(this.cache, this.primaryProvider, warmupKeys);
      
      // Initial warmup
      await this.cacheWarmer.warmup().catch(error => {
        console.warn('Cache warmup failed:', error.message);
      });

      // Set up periodic refresh
      if (this.config.cache?.refreshInterval) {
        this.refreshInterval = setInterval(async () => {
          try {
            await this.cacheWarmer!.refresh();
          } catch (error) {
            console.error('Cache refresh failed:', error.message);
          }
        }, this.config.cache.refreshInterval * 1000);
      }
    }
  }

  async getSecret(key: string | SecretKeys): Promise<Secret | null> {
    const secretKey = typeof key === 'string' ? key : key.toString();
    
    // Try cache first
    if (this.cache) {
      try {
        const cached = await this.cache.get(secretKey);
        if (cached) {
          this.emitAuditEvent({
            timestamp: new Date(),
            operation: 'read',
            secretKey,
            source: 'cache',
            success: true,
          });
          return cached;
        }
      } catch (error) {
        console.warn(`Cache read failed for ${secretKey}:`, error.message);
      }
    }

    // Get from provider
    const secret = await this.primaryProvider.getSecret(secretKey);
    
    // Cache the result
    if (secret && this.cache) {
      try {
        await this.cache.set(secretKey, secret, this.config.cache?.ttl);
      } catch (error) {
        console.warn(`Cache write failed for ${secretKey}:`, error.message);
      }
    }

    return secret;
  }

  async setSecret(key: string | SecretKeys, value: string | Record<string, any>, metadata?: SecretMetadata): Promise<void> {
    const secretKey = typeof key === 'string' ? key : key.toString();
    
    await this.primaryProvider.setSecret(secretKey, value, metadata);
    
    // Invalidate cache
    if (this.cache) {
      try {
        await this.cache.delete(secretKey);
      } catch (error) {
        console.warn(`Cache invalidation failed for ${secretKey}:`, error.message);
      }
    }
  }

  async deleteSecret(key: string | SecretKeys): Promise<void> {
    const secretKey = typeof key === 'string' ? key : key.toString();
    
    await this.primaryProvider.deleteSecret(secretKey);
    
    // Remove from cache
    if (this.cache) {
      try {
        await this.cache.delete(secretKey);
      } catch (error) {
        console.warn(`Cache deletion failed for ${secretKey}:`, error.message);
      }
    }
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    return await this.primaryProvider.listSecrets(prefix);
  }

  async rotateSecret(key: string | SecretKeys): Promise<void> {
    const secretKey = typeof key === 'string' ? key : key.toString();
    
    await this.primaryProvider.rotateSecret(secretKey);
    
    // Invalidate cache
    if (this.cache) {
      try {
        await this.cache.delete(secretKey);
      } catch (error) {
        console.warn(`Cache invalidation failed for ${secretKey}:`, error.message);
      }
    }
  }

  // Convenience methods for common secret types
  async getDatabaseUrl(): Promise<string | null> {
    const secret = await this.getSecret(SecretKeys.DATABASE_URL);
    return secret?.value as string || null;
  }

  async getJwtSecret(): Promise<string | null> {
    const secret = await this.getSecret(SecretKeys.JWT_SECRET);
    return secret?.value as string || null;
  }

  async getApiKey(service: 'datadog' | 'stripe' | 'sendgrid' | 'launchdarkly'): Promise<string | null> {
    const keyMap = {
      datadog: SecretKeys.DATADOG_API_KEY,
      stripe: SecretKeys.STRIPE_SECRET_KEY,
      sendgrid: SecretKeys.SENDGRID_API_KEY,
      launchdarkly: SecretKeys.LAUNCHDARKLY_SDK_KEY,
    };
    
    const secret = await this.getSecret(keyMap[service]);
    return secret?.value as string || null;
  }

  async getEncryptionKey(type: 'primary' | 'backup' = 'primary'): Promise<string | null> {
    const key = type === 'primary' ? SecretKeys.ENCRYPTION_KEY : SecretKeys.BACKUP_ENCRYPTION_KEY;
    const secret = await this.getSecret(key);
    return secret?.value as string || null;
  }

  // Batch operations
  async getSecrets(keys: (string | SecretKeys)[]): Promise<Record<string, Secret | null>> {
    const results: Record<string, Secret | null> = {};
    
    const promises = keys.map(async (key) => {
      const secretKey = typeof key === 'string' ? key : key.toString();
      try {
        results[secretKey] = await this.getSecret(secretKey);
      } catch (error) {
        console.error(`Failed to get secret ${secretKey}:`, error.message);
        results[secretKey] = null;
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  async setSecrets(secrets: Record<string, string | Record<string, any>>, metadata?: SecretMetadata): Promise<void> {
    const promises = Object.entries(secrets).map(async ([key, value]) => {
      try {
        await this.setSecret(key, value, metadata);
      } catch (error) {
        console.error(`Failed to set secret ${key}:`, error.message);
        throw error;
      }
    });

    await Promise.all(promises);
  }

  // Environment-specific methods
  async getSecretsForEnvironment(environment: string): Promise<Record<string, Secret | null>> {
    const allKeys = await this.listSecrets();
    const envKeys = allKeys.filter(key => key.includes(environment) || !key.includes('/'));
    
    return await this.getSecrets(envKeys);
  }

  // Health and monitoring
  async getHealth(): Promise<any> {
    const health: any = {
      provider: this.config.provider,
      cache: {
        enabled: !!this.cache,
        size: this.cache ? await this.cache.size() : 0,
      },
      providers: {},
    };

    // Check primary provider health
    try {
      if ('getHealth' in this.primaryProvider) {
        health.primary = await (this.primaryProvider as any).getHealth();
      } else {
        // Basic health check by listing secrets
        await this.primaryProvider.listSecrets();
        health.primary = { status: 'healthy' };
      }
    } catch (error) {
      health.primary = { status: 'unhealthy', error: error.message };
    }

    // Check all providers in multi-provider setup
    if (this.config.provider === 'multi') {
      for (const [name, provider] of this.providers.entries()) {
        try {
          if ('getHealth' in provider) {
            health.providers[name] = await (provider as any).getHealth();
          } else {
            await provider.listSecrets();
            health.providers[name] = { status: 'healthy' };
          }
        } catch (error) {
          health.providers[name] = { status: 'unhealthy', error: error.message };
        }
      }
    }

    return health;
  }

  // Cache management
  async clearCache(): Promise<void> {
    if (this.cache) {
      await this.cache.clear();
    }
  }

  async warmupCache(keys?: string[]): Promise<void> {
    if (this.cacheWarmer) {
      if (keys) {
        // Temporarily add keys for warmup
        const originalKeys = [...this.cacheWarmer['warmupKeys']];
        keys.forEach(key => this.cacheWarmer!.addWarmupKey(key));
        await this.cacheWarmer.warmup();
        // Restore original keys
        this.cacheWarmer['warmupKeys'] = originalKeys;
      } else {
        await this.cacheWarmer.warmup();
      }
    }
  }

  // Event handling
  onAudit(handler: SecretAuditHandler): void {
    this.auditHandlers.push(handler);
  }

  private handleAuditEvent(event: SecretAuditEvent): void {
    this.auditHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in secret audit handler:', error);
      }
    });
  }

  private emitAuditEvent(event: SecretAuditEvent): void {
    this.handleAuditEvent(event);
  }

  // Cleanup
  async close(): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    await this.primaryProvider.close();
    
    // Close all providers in multi-provider setup
    if (this.config.provider === 'multi') {
      const closePromises = Array.from(this.providers.values()).map(provider => 
        provider.close().catch(error => {
          console.warn('Failed to close provider:', error.message);
        })
      );
      await Promise.allSettled(closePromises);
    }

    // Close cache if it has a close method
    if (this.cache && 'close' in this.cache) {
      await (this.cache as any).close();
    }
  }
}

// Multi-provider implementation
class MultiProvider implements SecretProvider {
  private providers: SecretProvider[];
  private config: NonNullable<SecretManagerConfig['multi']>;
  private primaryProvider: SecretProvider;

  constructor(providers: SecretProvider[], config: NonNullable<SecretManagerConfig['multi']>) {
    this.providers = providers;
    this.config = config;
    this.primaryProvider = providers.find(p => 
      (p.constructor.name.toLowerCase().includes(config.primary))
    ) || providers[0];
  }

  async initialize(): Promise<void> {
    const promises = this.providers.map(provider => provider.initialize());
    await Promise.allSettled(promises);
  }

  async getSecret(key: string): Promise<Secret | null> {
    if (this.config.strategy === 'failover') {
      // Try primary first, then fallback providers
      try {
        return await this.primaryProvider.getSecret(key);
      } catch (error) {
        console.warn(`Primary provider failed for ${key}, trying fallback providers`);
        
        for (const provider of this.providers) {
          if (provider === this.primaryProvider) continue;
          
          try {
            return await provider.getSecret(key);
          } catch (fallbackError) {
            console.warn(`Fallback provider failed for ${key}:`, fallbackError.message);
          }
        }
        
        throw error;
      }
    } else {
      // For other strategies, use primary provider
      return await this.primaryProvider.getSecret(key);
    }
  }

  async setSecret(key: string, value: string | Record<string, any>, metadata?: SecretMetadata): Promise<void> {
    // Always write to primary provider
    await this.primaryProvider.setSecret(key, value, metadata);
  }

  async deleteSecret(key: string): Promise<void> {
    await this.primaryProvider.deleteSecret(key);
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    return await this.primaryProvider.listSecrets(prefix);
  }

  async rotateSecret(key: string): Promise<void> {
    await this.primaryProvider.rotateSecret(key);
  }

  async close(): Promise<void> {
    const promises = this.providers.map(provider => provider.close());
    await Promise.allSettled(promises);
  }

  onAudit(handler: SecretAuditHandler): void {
    this.providers.forEach(provider => {
      if (provider.onAudit) {
        provider.onAudit(handler);
      }
    });
  }
}
