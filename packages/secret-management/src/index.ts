// Advanced Secret Management System for Nexus Workspace

export * from './types';
export * from './client';
export * from './cache';
export * from './providers/vault.provider';
export * from './providers/aws-secrets-manager.provider';
export * from './providers/kubernetes.provider';

// Re-export main client
export { SecretManagerClient } from './client';

// Convenience factory function
import { SecretManagerClient } from './client';
import { SecretManagerConfig } from './types';

export function createSecretManager(config: SecretManagerConfig): SecretManagerClient {
  return new SecretManagerClient(config);
}

// Default configuration helpers
export const defaultConfigs = {
  vault: (endpoint: string, token?: string): SecretManagerConfig => ({
    provider: 'vault',
    environment: process.env.NODE_ENV || 'development',
    vault: {
      endpoint,
      token,
      authMethod: 'token',
      mountPath: 'secret',
    },
    cache: {
      enabled: true,
      ttl: 300,
      refreshInterval: 3600, // 1 hour
    },
    security: {
      enableAuditLog: true,
      maxRetries: 3,
      backoffMultiplier: 2,
    },
  }),

  awsSecretsManager: (region: string, kmsKeyId?: string): SecretManagerConfig => ({
    provider: 'aws-secrets-manager',
    environment: process.env.NODE_ENV || 'development',
    aws: {
      region,
      kmsKeyId,
    },
    cache: {
      enabled: true,
      ttl: 300,
      refreshInterval: 3600,
    },
    security: {
      enableAuditLog: true,
      maxRetries: 3,
      backoffMultiplier: 2,
    },
  }),

  kubernetes: (namespace: string = 'default'): SecretManagerConfig => ({
    provider: 'kubernetes',
    environment: process.env.NODE_ENV || 'development',
    kubernetes: {
      namespace,
      inCluster: true,
    },
    cache: {
      enabled: true,
      ttl: 300,
      refreshInterval: 1800, // 30 minutes
    },
    security: {
      enableAuditLog: true,
      maxRetries: 3,
      backoffMultiplier: 2,
    },
  }),

  multi: (primary: 'vault' | 'aws-secrets-manager' | 'kubernetes'): SecretManagerConfig => ({
    provider: 'multi',
    environment: process.env.NODE_ENV || 'development',
    multi: {
      primary,
      fallback: ['vault', 'aws-secrets-manager', 'kubernetes'].filter(p => p !== primary) as any,
      strategy: 'failover',
    },
    vault: {
      endpoint: process.env.VAULT_ENDPOINT || 'http://vault:8200',
      token: process.env.VAULT_TOKEN,
      authMethod: 'token',
      mountPath: 'secret',
    },
    aws: {
      region: process.env.AWS_REGION || 'us-west-2',
      kmsKeyId: process.env.AWS_KMS_KEY_ID,
    },
    kubernetes: {
      namespace: process.env.K8S_NAMESPACE || 'default',
      inCluster: true,
    },
    cache: {
      enabled: true,
      ttl: 300,
      refreshInterval: 3600,
    },
    security: {
      enableAuditLog: true,
      maxRetries: 3,
      backoffMultiplier: 2,
    },
  }),
};

// Utility functions
export function getSecretManagerFromEnv(): SecretManagerClient {
  const provider = process.env.SECRET_MANAGER_PROVIDER || 'kubernetes';
  
  switch (provider) {
    case 'vault':
      return createSecretManager(defaultConfigs.vault(
        process.env.VAULT_ENDPOINT || 'http://vault:8200',
        process.env.VAULT_TOKEN
      ));
      
    case 'aws-secrets-manager':
      return createSecretManager(defaultConfigs.awsSecretsManager(
        process.env.AWS_REGION || 'us-west-2',
        process.env.AWS_KMS_KEY_ID
      ));
      
    case 'kubernetes':
      return createSecretManager(defaultConfigs.kubernetes(
        process.env.K8S_NAMESPACE || 'default'
      ));
      
    case 'multi':
      return createSecretManager(defaultConfigs.multi('vault'));
      
    default:
      throw new Error(`Unsupported secret manager provider: ${provider}`);
  }
}

// Singleton instance for convenience
let globalSecretManager: SecretManagerClient | null = null;

export function getGlobalSecretManager(): SecretManagerClient {
  if (!globalSecretManager) {
    globalSecretManager = getSecretManagerFromEnv();
  }
  return globalSecretManager;
}

export async function initializeGlobalSecretManager(): Promise<void> {
  const manager = getGlobalSecretManager();
  await manager.initialize();
}

export async function closeGlobalSecretManager(): Promise<void> {
  if (globalSecretManager) {
    await globalSecretManager.close();
    globalSecretManager = null;
  }
}
