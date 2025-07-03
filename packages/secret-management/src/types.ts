// Type definitions for secret management system

export interface SecretManagerConfig {
  provider: 'vault' | 'aws-secrets-manager' | 'kubernetes' | 'multi';
  environment: string;
  
  // HashiCorp Vault configuration
  vault?: {
    endpoint: string;
    token?: string;
    roleId?: string;
    secretId?: string;
    namespace?: string;
    mountPath?: string;
    authMethod?: 'token' | 'approle' | 'kubernetes' | 'aws';
    kubernetesRole?: string;
    awsRole?: string;
  };
  
  // AWS Secrets Manager configuration
  aws?: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    roleArn?: string;
    kmsKeyId?: string;
  };
  
  // Kubernetes Secrets configuration
  kubernetes?: {
    namespace: string;
    serviceAccountPath?: string;
    inCluster?: boolean;
  };
  
  // Caching configuration
  cache?: {
    enabled: boolean;
    ttl?: number; // Time to live in seconds
    maxSize?: number;
    refreshInterval?: number;
  };
  
  // Security configuration
  security?: {
    encryptionKey?: string;
    enableAuditLog?: boolean;
    rotationInterval?: number;
    maxRetries?: number;
    backoffMultiplier?: number;
  };
  
  // Multi-provider configuration
  multi?: {
    primary: 'vault' | 'aws-secrets-manager' | 'kubernetes';
    fallback: ('vault' | 'aws-secrets-manager' | 'kubernetes')[];
    strategy: 'failover' | 'priority' | 'distributed';
  };
}

export interface SecretMetadata {
  version?: string;
  createdAt?: Date;
  updatedAt?: Date;
  expiresAt?: Date;
  tags?: Record<string, string>;
  description?: string;
  rotationEnabled?: boolean;
  rotationInterval?: number;
}

export interface Secret {
  key: string;
  value: string | Record<string, any>;
  metadata?: SecretMetadata;
}

export interface SecretProvider {
  initialize(): Promise<void>;
  getSecret(key: string): Promise<Secret | null>;
  setSecret(key: string, value: string | Record<string, any>, metadata?: SecretMetadata): Promise<void>;
  deleteSecret(key: string): Promise<void>;
  listSecrets(prefix?: string): Promise<string[]>;
  rotateSecret(key: string): Promise<void>;
  close(): Promise<void>;
}

export interface SecretCache {
  get(key: string): Promise<Secret | null>;
  set(key: string, secret: Secret, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
}

export interface SecretAuditEvent {
  timestamp: Date;
  operation: 'read' | 'write' | 'delete' | 'rotate' | 'list';
  secretKey: string;
  userId?: string;
  source: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export type SecretAuditHandler = (event: SecretAuditEvent) => void;

// Predefined secret keys for the application
export enum SecretKeys {
  // Database secrets
  DATABASE_URL = 'database/url',
  DATABASE_PASSWORD = 'database/password',
  DATABASE_ENCRYPTION_KEY = 'database/encryption-key',
  
  // API keys
  DATADOG_API_KEY = 'external/datadog/api-key',
  UNLEASH_CLIENT_KEY = 'external/unleash/client-key',
  LAUNCHDARKLY_SDK_KEY = 'external/launchdarkly/sdk-key',
  STRIPE_SECRET_KEY = 'external/stripe/secret-key',
  SENDGRID_API_KEY = 'external/sendgrid/api-key',
  
  // Authentication secrets
  JWT_SECRET = 'auth/jwt-secret',
  JWT_REFRESH_SECRET = 'auth/jwt-refresh-secret',
  SESSION_SECRET = 'auth/session-secret',
  OAUTH_CLIENT_SECRET = 'auth/oauth/client-secret',
  
  // Encryption keys
  ENCRYPTION_KEY = 'encryption/primary-key',
  BACKUP_ENCRYPTION_KEY = 'encryption/backup-key',
  
  // Redis secrets
  REDIS_PASSWORD = 'redis/password',
  REDIS_TLS_CERT = 'redis/tls-cert',
  
  // SSL/TLS certificates
  SSL_PRIVATE_KEY = 'ssl/private-key',
  SSL_CERTIFICATE = 'ssl/certificate',
  SSL_CA_BUNDLE = 'ssl/ca-bundle',
  
  // Webhook secrets
  GITHUB_WEBHOOK_SECRET = 'webhooks/github/secret',
  STRIPE_WEBHOOK_SECRET = 'webhooks/stripe/secret',
  
  // Monitoring secrets
  PROMETHEUS_PASSWORD = 'monitoring/prometheus/password',
  GRAFANA_ADMIN_PASSWORD = 'monitoring/grafana/admin-password',
  
  // Backup secrets
  S3_BACKUP_ACCESS_KEY = 'backup/s3/access-key',
  S3_BACKUP_SECRET_KEY = 'backup/s3/secret-key',
  
  // Feature flag secrets
  FEATURE_FLAG_ENCRYPTION_KEY = 'feature-flags/encryption-key',
}

export interface SecretRotationConfig {
  enabled: boolean;
  interval: number; // in seconds
  beforeExpiry: number; // rotate N seconds before expiry
  notificationWebhook?: string;
  customRotationHandler?: (key: string, currentSecret: Secret) => Promise<Secret>;
}

export interface SecretValidationRule {
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
  customValidator?: (value: string) => boolean;
}

export interface SecretPolicy {
  key: string;
  validation?: SecretValidationRule;
  rotation?: SecretRotationConfig;
  access?: {
    roles: string[];
    users: string[];
    services: string[];
  };
  encryption?: {
    required: boolean;
    algorithm?: string;
    keyId?: string;
  };
}
