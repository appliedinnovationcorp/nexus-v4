import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  SecretManagerClient, 
  createSecretManager, 
  defaultConfigs, 
  SecretKeys,
  Secret,
  SecretMetadata 
} from '@nexus/secret-management';

@Injectable()
export class SecretManagementService implements OnModuleInit, OnModuleDestroy {
  private client: SecretManagerClient;
  private secretCache: Map<string, { value: any; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(private configService: ConfigService) {
    this.initializeClient();
  }

  private initializeClient(): void {
    const provider = this.configService.get('SECRET_MANAGER_PROVIDER', 'kubernetes');
    
    switch (provider) {
      case 'vault':
        this.client = createSecretManager(defaultConfigs.vault(
          this.configService.get('VAULT_ENDPOINT', 'http://vault.vault.svc.cluster.local:8200'),
          this.configService.get('VAULT_TOKEN')
        ));
        break;
        
      case 'aws-secrets-manager':
        this.client = createSecretManager(defaultConfigs.awsSecretsManager(
          this.configService.get('AWS_REGION', 'us-west-2'),
          this.configService.get('AWS_KMS_KEY_ID')
        ));
        break;
        
      case 'multi':
        this.client = createSecretManager(defaultConfigs.multi('vault'));
        break;
        
      default:
        // Default to Kubernetes
        this.client = createSecretManager(defaultConfigs.kubernetes(
          this.configService.get('K8S_NAMESPACE', 'default')
        ));
    }

    // Set up audit logging
    this.client.onAudit((event) => {
      console.log('Secret audit event:', {
        timestamp: event.timestamp.toISOString(),
        operation: event.operation,
        secretKey: event.secretKey,
        source: event.source,
        success: event.success,
        error: event.error,
        userId: event.userId,
      });
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.initialize();
    
    // Warm up cache with critical secrets
    await this.warmupCriticalSecrets();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  private async warmupCriticalSecrets(): Promise<void> {
    const criticalSecrets = [
      SecretKeys.DATABASE_URL,
      SecretKeys.JWT_SECRET,
      SecretKeys.ENCRYPTION_KEY,
    ];

    try {
      await this.client.warmupCache(criticalSecrets);
    } catch (error) {
      console.warn('Failed to warm up critical secrets:', error.message);
    }
  }

  // Core secret management methods
  async getSecret(key: string | SecretKeys): Promise<string | null> {
    try {
      const secret = await this.client.getSecret(key);
      return secret?.value as string || null;
    } catch (error) {
      console.error(`Failed to get secret ${key}:`, error.message);
      return null;
    }
  }

  async getSecretObject(key: string | SecretKeys): Promise<Record<string, any> | null> {
    try {
      const secret = await this.client.getSecret(key);
      if (!secret) return null;
      
      return typeof secret.value === 'object' ? secret.value : { value: secret.value };
    } catch (error) {
      console.error(`Failed to get secret object ${key}:`, error.message);
      return null;
    }
  }

  async setSecret(key: string | SecretKeys, value: string | Record<string, any>, metadata?: SecretMetadata): Promise<void> {
    try {
      await this.client.setSecret(key, value, metadata);
      // Clear local cache for this key
      this.secretCache.delete(key.toString());
    } catch (error) {
      console.error(`Failed to set secret ${key}:`, error.message);
      throw error;
    }
  }

  async deleteSecret(key: string | SecretKeys): Promise<void> {
    try {
      await this.client.deleteSecret(key);
      // Clear local cache for this key
      this.secretCache.delete(key.toString());
    } catch (error) {
      console.error(`Failed to delete secret ${key}:`, error.message);
      throw error;
    }
  }

  async rotateSecret(key: string | SecretKeys): Promise<void> {
    try {
      await this.client.rotateSecret(key);
      // Clear local cache for this key
      this.secretCache.delete(key.toString());
    } catch (error) {
      console.error(`Failed to rotate secret ${key}:`, error.message);
      throw error;
    }
  }

  // Application-specific secret methods with caching
  async getDatabaseUrl(): Promise<string | null> {
    return this.getCachedSecret(SecretKeys.DATABASE_URL, async () => {
      return await this.client.getDatabaseUrl();
    });
  }

  async getJwtSecret(): Promise<string | null> {
    return this.getCachedSecret(SecretKeys.JWT_SECRET, async () => {
      return await this.client.getJwtSecret();
    });
  }

  async getJwtRefreshSecret(): Promise<string | null> {
    return this.getCachedSecret(SecretKeys.JWT_REFRESH_SECRET, async () => {
      return await this.getSecret(SecretKeys.JWT_REFRESH_SECRET);
    });
  }

  async getEncryptionKey(): Promise<string | null> {
    return this.getCachedSecret(SecretKeys.ENCRYPTION_KEY, async () => {
      return await this.client.getEncryptionKey();
    });
  }

  async getApiKey(service: 'datadog' | 'stripe' | 'sendgrid' | 'launchdarkly'): Promise<string | null> {
    const cacheKey = `api_key_${service}`;
    return this.getCachedSecret(cacheKey, async () => {
      return await this.client.getApiKey(service);
    });
  }

  async getRedisPassword(): Promise<string | null> {
    return this.getCachedSecret(SecretKeys.REDIS_PASSWORD, async () => {
      return await this.getSecret(SecretKeys.REDIS_PASSWORD);
    });
  }

  async getSessionSecret(): Promise<string | null> {
    return this.getCachedSecret(SecretKeys.SESSION_SECRET, async () => {
      return await this.getSecret(SecretKeys.SESSION_SECRET);
    });
  }

  async getOAuthClientSecret(): Promise<string | null> {
    return this.getCachedSecret(SecretKeys.OAUTH_CLIENT_SECRET, async () => {
      return await this.getSecret(SecretKeys.OAUTH_CLIENT_SECRET);
    });
  }

  // Database connection helper
  async getDatabaseConfig(): Promise<any> {
    const url = await this.getDatabaseUrl();
    const password = await this.getSecret(SecretKeys.DATABASE_PASSWORD);
    const encryptionKey = await this.getSecret(SecretKeys.DATABASE_ENCRYPTION_KEY);

    return {
      url,
      password,
      encryptionKey,
      ssl: process.env.NODE_ENV === 'production',
    };
  }

  // Redis connection helper
  async getRedisConfig(): Promise<any> {
    const password = await this.getRedisPassword();
    const tlsCert = await this.getSecret(SecretKeys.REDIS_TLS_CERT);

    return {
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password,
      tls: tlsCert ? { cert: tlsCert } : undefined,
    };
  }

  // SSL/TLS configuration helper
  async getSSLConfig(): Promise<any> {
    const privateKey = await this.getSecret(SecretKeys.SSL_PRIVATE_KEY);
    const certificate = await this.getSecret(SecretKeys.SSL_CERTIFICATE);
    const caBundle = await this.getSecret(SecretKeys.SSL_CA_BUNDLE);

    return {
      key: privateKey,
      cert: certificate,
      ca: caBundle,
    };
  }

  // Webhook secrets
  async getWebhookSecret(service: 'github' | 'stripe'): Promise<string | null> {
    const keyMap = {
      github: SecretKeys.GITHUB_WEBHOOK_SECRET,
      stripe: SecretKeys.STRIPE_WEBHOOK_SECRET,
    };

    return await this.getSecret(keyMap[service]);
  }

  // Monitoring secrets
  async getMonitoringConfig(): Promise<any> {
    const prometheusPassword = await this.getSecret(SecretKeys.PROMETHEUS_PASSWORD);
    const grafanaPassword = await this.getSecret(SecretKeys.GRAFANA_ADMIN_PASSWORD);

    return {
      prometheus: {
        password: prometheusPassword,
      },
      grafana: {
        adminPassword: grafanaPassword,
      },
    };
  }

  // Backup configuration
  async getBackupConfig(): Promise<any> {
    const s3AccessKey = await this.getSecret(SecretKeys.S3_BACKUP_ACCESS_KEY);
    const s3SecretKey = await this.getSecret(SecretKeys.S3_BACKUP_SECRET_KEY);

    return {
      s3: {
        accessKeyId: s3AccessKey,
        secretAccessKey: s3SecretKey,
        region: process.env.AWS_REGION || 'us-west-2',
        bucket: process.env.BACKUP_S3_BUCKET,
      },
    };
  }

  // Batch operations
  async getSecrets(keys: (string | SecretKeys)[]): Promise<Record<string, string | null>> {
    try {
      const secrets = await this.client.getSecrets(keys);
      const result: Record<string, string | null> = {};
      
      for (const [key, secret] of Object.entries(secrets)) {
        result[key] = secret?.value as string || null;
      }
      
      return result;
    } catch (error) {
      console.error('Failed to get batch secrets:', error.message);
      throw error;
    }
  }

  async setSecrets(secrets: Record<string, string | Record<string, any>>, metadata?: SecretMetadata): Promise<void> {
    try {
      await this.client.setSecrets(secrets, metadata);
      // Clear local cache for all keys
      Object.keys(secrets).forEach(key => {
        this.secretCache.delete(key);
      });
    } catch (error) {
      console.error('Failed to set batch secrets:', error.message);
      throw error;
    }
  }

  // Health check
  async getHealth(): Promise<any> {
    try {
      return await this.client.getHealth();
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        provider: this.configService.get('SECRET_MANAGER_PROVIDER', 'kubernetes'),
      };
    }
  }

  // Cache management
  async clearCache(): Promise<void> {
    this.secretCache.clear();
    await this.client.clearCache();
  }

  async refreshSecrets(): Promise<void> {
    this.secretCache.clear();
    await this.warmupCriticalSecrets();
  }

  // Private helper methods
  private async getCachedSecret(key: string, fetcher: () => Promise<string | null>): Promise<string | null> {
    const cached = this.secretCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.value;
    }

    try {
      const value = await fetcher();
      this.secretCache.set(key, {
        value,
        timestamp: Date.now(),
      });
      return value;
    } catch (error) {
      console.error(`Failed to fetch secret ${key}:`, error.message);
      // Return cached value if available, even if expired
      return cached?.value || null;
    }
  }

  // Secret validation
  async validateSecret(key: string | SecretKeys, value: string): Promise<boolean> {
    // Basic validation - can be extended with specific rules
    if (!value || value.length < 8) {
      return false;
    }

    // Key-specific validation
    const keyStr = key.toString();
    
    if (keyStr.includes('password') || keyStr.includes('secret')) {
      // Password/secret should have minimum complexity
      return value.length >= 12 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value);
    }

    if (keyStr.includes('key') && keyStr.includes('encryption')) {
      // Encryption keys should be base64 or hex
      return /^[A-Fa-f0-9]+$/.test(value) || /^[A-Za-z0-9+/]+=*$/.test(value);
    }

    if (keyStr.includes('url')) {
      // URLs should be valid
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }

    return true;
  }

  // Secret generation
  async generateSecret(key: string | SecretKeys, type: 'password' | 'key' | 'token' = 'password'): Promise<string> {
    const crypto = require('crypto');
    
    switch (type) {
      case 'password':
        // Generate a strong password
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 32; i++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
        
      case 'key':
        // Generate a hex key
        return crypto.randomBytes(32).toString('hex');
        
      case 'token':
        // Generate a base64 token
        return crypto.randomBytes(32).toString('base64');
        
      default:
        throw new Error(`Unsupported secret type: ${type}`);
    }
  }
}
