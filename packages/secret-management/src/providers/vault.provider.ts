import vault from 'node-vault';
import { SecretProvider, SecretManagerConfig, Secret, SecretMetadata, SecretAuditEvent, SecretAuditHandler } from '../types';

export class VaultProvider implements SecretProvider {
  private client: any;
  private config: SecretManagerConfig;
  private auditHandlers: SecretAuditHandler[] = [];
  private isInitialized = false;

  constructor(config: SecretManagerConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const vaultConfig = this.config.vault;
    if (!vaultConfig) {
      throw new Error('Vault configuration is required');
    }

    try {
      // Initialize Vault client
      this.client = vault({
        apiVersion: 'v1',
        endpoint: vaultConfig.endpoint,
        token: vaultConfig.token,
        namespace: vaultConfig.namespace,
      });

      // Authenticate based on auth method
      await this.authenticate();

      // Verify connection
      await this.client.status();
      
      this.isInitialized = true;
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'read',
        secretKey: '__vault_status__',
        source: 'vault-provider',
        success: true,
        metadata: { action: 'initialize' },
      });

    } catch (error) {
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'read',
        secretKey: '__vault_status__',
        source: 'vault-provider',
        success: false,
        error: error.message,
        metadata: { action: 'initialize' },
      });
      throw new Error(`Failed to initialize Vault client: ${error.message}`);
    }
  }

  private async authenticate(): Promise<void> {
    const vaultConfig = this.config.vault!;

    switch (vaultConfig.authMethod) {
      case 'token':
        // Token authentication is handled in client initialization
        break;

      case 'approle':
        if (!vaultConfig.roleId || !vaultConfig.secretId) {
          throw new Error('AppRole authentication requires roleId and secretId');
        }
        
        const appRoleAuth = await this.client.approleLogin({
          role_id: vaultConfig.roleId,
          secret_id: vaultConfig.secretId,
        });
        
        this.client.token = appRoleAuth.auth.client_token;
        break;

      case 'kubernetes':
        if (!vaultConfig.kubernetesRole) {
          throw new Error('Kubernetes authentication requires kubernetesRole');
        }
        
        const fs = require('fs');
        const jwt = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8');
        
        const k8sAuth = await this.client.kubernetesLogin({
          role: vaultConfig.kubernetesRole,
          jwt: jwt,
        });
        
        this.client.token = k8sAuth.auth.client_token;
        break;

      case 'aws':
        if (!vaultConfig.awsRole) {
          throw new Error('AWS authentication requires awsRole');
        }
        
        // AWS IAM authentication
        const awsAuth = await this.client.awsIamLogin({
          role: vaultConfig.awsRole,
        });
        
        this.client.token = awsAuth.auth.client_token;
        break;

      default:
        throw new Error(`Unsupported Vault auth method: ${vaultConfig.authMethod}`);
    }
  }

  async getSecret(key: string): Promise<Secret | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const mountPath = this.config.vault?.mountPath || 'secret';
      const secretPath = `${mountPath}/data/${key}`;
      
      const response = await this.client.read(secretPath);
      
      if (!response || !response.data || !response.data.data) {
        this.emitAuditEvent({
          timestamp: new Date(),
          operation: 'read',
          secretKey: key,
          source: 'vault-provider',
          success: false,
          error: 'Secret not found',
        });
        return null;
      }

      const secretData = response.data.data;
      const metadata = response.data.metadata;

      const secret: Secret = {
        key,
        value: typeof secretData === 'object' && Object.keys(secretData).length === 1 && secretData.value 
          ? secretData.value 
          : secretData,
        metadata: {
          version: metadata?.version?.toString(),
          createdAt: metadata?.created_time ? new Date(metadata.created_time) : undefined,
          updatedAt: metadata?.updated_time ? new Date(metadata.updated_time) : undefined,
          expiresAt: metadata?.deletion_time ? new Date(metadata.deletion_time) : undefined,
        },
      };

      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'read',
        secretKey: key,
        source: 'vault-provider',
        success: true,
      });

      return secret;
    } catch (error) {
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'read',
        secretKey: key,
        source: 'vault-provider',
        success: false,
        error: error.message,
      });
      throw new Error(`Failed to get secret from Vault: ${error.message}`);
    }
  }

  async setSecret(key: string, value: string | Record<string, any>, metadata?: SecretMetadata): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const mountPath = this.config.vault?.mountPath || 'secret';
      const secretPath = `${mountPath}/data/${key}`;
      
      // Prepare secret data
      const secretData = typeof value === 'string' ? { value } : value;
      
      // Add metadata if provided
      const requestData: any = {
        data: secretData,
      };

      if (metadata) {
        requestData.options = {};
        if (metadata.tags) {
          requestData.options.tags = metadata.tags;
        }
      }

      await this.client.write(secretPath, requestData);

      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'write',
        secretKey: key,
        source: 'vault-provider',
        success: true,
        metadata: { hasMetadata: !!metadata },
      });

    } catch (error) {
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'write',
        secretKey: key,
        source: 'vault-provider',
        success: false,
        error: error.message,
      });
      throw new Error(`Failed to set secret in Vault: ${error.message}`);
    }
  }

  async deleteSecret(key: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const mountPath = this.config.vault?.mountPath || 'secret';
      const secretPath = `${mountPath}/data/${key}`;
      
      await this.client.delete(secretPath);

      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'delete',
        secretKey: key,
        source: 'vault-provider',
        success: true,
      });

    } catch (error) {
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'delete',
        secretKey: key,
        source: 'vault-provider',
        success: false,
        error: error.message,
      });
      throw new Error(`Failed to delete secret from Vault: ${error.message}`);
    }
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const mountPath = this.config.vault?.mountPath || 'secret';
      const listPath = `${mountPath}/metadata/${prefix || ''}`;
      
      const response = await this.client.list(listPath);
      
      if (!response || !response.data || !response.data.keys) {
        return [];
      }

      const keys = response.data.keys.filter((key: string) => !key.endsWith('/'));

      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'list',
        secretKey: prefix || '__all__',
        source: 'vault-provider',
        success: true,
        metadata: { count: keys.length },
      });

      return keys;
    } catch (error) {
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'list',
        secretKey: prefix || '__all__',
        source: 'vault-provider',
        success: false,
        error: error.message,
      });
      throw new Error(`Failed to list secrets from Vault: ${error.message}`);
    }
  }

  async rotateSecret(key: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Get current secret
      const currentSecret = await this.getSecret(key);
      if (!currentSecret) {
        throw new Error(`Secret ${key} not found for rotation`);
      }

      // Generate new secret value (this is a basic implementation)
      // In practice, you might want to use specific rotation logic per secret type
      const newValue = this.generateSecretValue(key);
      
      // Update secret with new value
      await this.setSecret(key, newValue, {
        ...currentSecret.metadata,
        updatedAt: new Date(),
        description: `Rotated on ${new Date().toISOString()}`,
      });

      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'rotate',
        secretKey: key,
        source: 'vault-provider',
        success: true,
      });

    } catch (error) {
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'rotate',
        secretKey: key,
        source: 'vault-provider',
        success: false,
        error: error.message,
      });
      throw new Error(`Failed to rotate secret in Vault: ${error.message}`);
    }
  }

  async close(): Promise<void> {
    // Vault client doesn't need explicit closing
    this.isInitialized = false;
  }

  onAudit(handler: SecretAuditHandler): void {
    this.auditHandlers.push(handler);
  }

  private emitAuditEvent(event: SecretAuditEvent): void {
    this.auditHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in secret audit handler:', error);
      }
    });
  }

  private generateSecretValue(key: string): string {
    // Basic secret generation - in practice, this should be more sophisticated
    const crypto = require('crypto');
    
    if (key.includes('password') || key.includes('secret')) {
      // Generate a strong password
      return crypto.randomBytes(32).toString('base64');
    } else if (key.includes('key')) {
      // Generate a hex key
      return crypto.randomBytes(32).toString('hex');
    } else {
      // Generate a random string
      return crypto.randomBytes(16).toString('base64');
    }
  }

  // Vault-specific methods
  async enableSecretsEngine(path: string, type: string = 'kv-v2'): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.client.mount({
        mount_point: path,
        type: type,
        options: {
          version: '2',
        },
      });
    } catch (error) {
      throw new Error(`Failed to enable secrets engine: ${error.message}`);
    }
  }

  async createPolicy(name: string, policy: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.client.addPolicy({
        name: name,
        rules: policy,
      });
    } catch (error) {
      throw new Error(`Failed to create policy: ${error.message}`);
    }
  }

  async getHealth(): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      return await this.client.health();
    } catch (error) {
      throw new Error(`Failed to get Vault health: ${error.message}`);
    }
  }
}
