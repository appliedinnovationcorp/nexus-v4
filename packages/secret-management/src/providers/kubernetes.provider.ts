import { Client1_13 as k8s } from 'kubernetes-client';
import { SecretProvider, SecretManagerConfig, Secret, SecretMetadata, SecretAuditEvent, SecretAuditHandler } from '../types';

export class KubernetesProvider implements SecretProvider {
  private client: any;
  private config: SecretManagerConfig;
  private auditHandlers: SecretAuditHandler[] = [];
  private isInitialized = false;
  private namespace: string;

  constructor(config: SecretManagerConfig) {
    this.config = config;
    this.namespace = config.kubernetes?.namespace || 'default';
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const k8sConfig = this.config.kubernetes;
    if (!k8sConfig) {
      throw new Error('Kubernetes configuration is required');
    }

    try {
      if (k8sConfig.inCluster !== false) {
        // In-cluster configuration
        this.client = new k8s({ version: '1.13' });
        this.client.loadSpec();
      } else {
        // Out-of-cluster configuration
        this.client = new k8s({ version: '1.13' });
        this.client.loadSpec();
      }

      // Test connection
      await this.client.api.v1.namespaces.get();
      
      this.isInitialized = true;
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'read',
        secretKey: '__k8s_status__',
        source: 'kubernetes-provider',
        success: true,
        metadata: { action: 'initialize', namespace: this.namespace },
      });

    } catch (error) {
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'read',
        secretKey: '__k8s_status__',
        source: 'kubernetes-provider',
        success: false,
        error: error.message,
        metadata: { action: 'initialize', namespace: this.namespace },
      });
      throw new Error(`Failed to initialize Kubernetes client: ${error.message}`);
    }
  }

  async getSecret(key: string): Promise<Secret | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const secretName = this.buildSecretName(key);
      
      const response = await this.client.api.v1.namespaces(this.namespace).secrets(secretName).get();
      
      if (!response.body || !response.body.data) {
        this.emitAuditEvent({
          timestamp: new Date(),
          operation: 'read',
          secretKey: key,
          source: 'kubernetes-provider',
          success: false,
          error: 'Secret not found',
        });
        return null;
      }

      const secretData = response.body.data;
      const metadata = response.body.metadata;

      // Decode base64 values
      const decodedData: Record<string, any> = {};
      for (const [k, v] of Object.entries(secretData)) {
        if (typeof v === 'string') {
          decodedData[k] = Buffer.from(v, 'base64').toString('utf-8');
        }
      }

      // If there's only one key-value pair and the key is 'value', return just the value
      const value = Object.keys(decodedData).length === 1 && decodedData.value 
        ? decodedData.value 
        : decodedData;

      const secret: Secret = {
        key,
        value,
        metadata: {
          version: metadata.resourceVersion,
          createdAt: metadata.creationTimestamp ? new Date(metadata.creationTimestamp) : undefined,
          tags: metadata.labels,
          description: metadata.annotations?.['nexus.workspace/description'],
        },
      };

      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'read',
        secretKey: key,
        source: 'kubernetes-provider',
        success: true,
      });

      return secret;
    } catch (error) {
      if (error.statusCode === 404) {
        this.emitAuditEvent({
          timestamp: new Date(),
          operation: 'read',
          secretKey: key,
          source: 'kubernetes-provider',
          success: false,
          error: 'Secret not found',
        });
        return null;
      }

      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'read',
        secretKey: key,
        source: 'kubernetes-provider',
        success: false,
        error: error.message,
      });
      throw new Error(`Failed to get secret from Kubernetes: ${error.message}`);
    }
  }

  async setSecret(key: string, value: string | Record<string, any>, metadata?: SecretMetadata): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const secretName = this.buildSecretName(key);
      
      // Prepare secret data
      const secretData: Record<string, string> = {};
      if (typeof value === 'string') {
        secretData.value = Buffer.from(value, 'utf-8').toString('base64');
      } else {
        for (const [k, v] of Object.entries(value)) {
          secretData[k] = Buffer.from(String(v), 'utf-8').toString('base64');
        }
      }

      const secretManifest = {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: {
          name: secretName,
          namespace: this.namespace,
          labels: {
            'nexus.workspace/managed': 'true',
            'nexus.workspace/environment': this.config.environment,
            ...metadata?.tags,
          },
          annotations: {
            'nexus.workspace/created-at': new Date().toISOString(),
            'nexus.workspace/description': metadata?.description || '',
          },
        },
        type: 'Opaque',
        data: secretData,
      };

      // Check if secret exists
      let secretExists = false;
      try {
        await this.client.api.v1.namespaces(this.namespace).secrets(secretName).get();
        secretExists = true;
      } catch (error) {
        if (error.statusCode !== 404) {
          throw error;
        }
      }

      if (secretExists) {
        // Update existing secret
        await this.client.api.v1.namespaces(this.namespace).secrets(secretName).put({
          body: secretManifest,
        });
      } else {
        // Create new secret
        await this.client.api.v1.namespaces(this.namespace).secrets.post({
          body: secretManifest,
        });
      }

      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'write',
        secretKey: key,
        source: 'kubernetes-provider',
        success: true,
        metadata: { exists: secretExists, hasMetadata: !!metadata },
      });

    } catch (error) {
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'write',
        secretKey: key,
        source: 'kubernetes-provider',
        success: false,
        error: error.message,
      });
      throw new Error(`Failed to set secret in Kubernetes: ${error.message}`);
    }
  }

  async deleteSecret(key: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const secretName = this.buildSecretName(key);
      
      await this.client.api.v1.namespaces(this.namespace).secrets(secretName).delete();

      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'delete',
        secretKey: key,
        source: 'kubernetes-provider',
        success: true,
      });

    } catch (error) {
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'delete',
        secretKey: key,
        source: 'kubernetes-provider',
        success: false,
        error: error.message,
      });
      throw new Error(`Failed to delete secret from Kubernetes: ${error.message}`);
    }
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const response = await this.client.api.v1.namespaces(this.namespace).secrets.get({
        qs: {
          labelSelector: 'nexus.workspace/managed=true',
        },
      });
      
      if (!response.body || !response.body.items) {
        return [];
      }

      let secrets = response.body.items
        .map((secret: any) => this.extractKeyFromSecretName(secret.metadata.name))
        .filter((key: string | null) => key !== null) as string[];

      if (prefix) {
        secrets = secrets.filter(key => key.startsWith(prefix));
      }

      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'list',
        secretKey: prefix || '__all__',
        source: 'kubernetes-provider',
        success: true,
        metadata: { count: secrets.length },
      });

      return secrets;
    } catch (error) {
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'list',
        secretKey: prefix || '__all__',
        source: 'kubernetes-provider',
        success: false,
        error: error.message,
      });
      throw new Error(`Failed to list secrets from Kubernetes: ${error.message}`);
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

      // Generate new secret value
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
        source: 'kubernetes-provider',
        success: true,
      });

    } catch (error) {
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'rotate',
        secretKey: key,
        source: 'kubernetes-provider',
        success: false,
        error: error.message,
      });
      throw new Error(`Failed to rotate secret in Kubernetes: ${error.message}`);
    }
  }

  async close(): Promise<void> {
    // Kubernetes client doesn't need explicit closing
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

  private buildSecretName(key: string): string {
    // Convert key to valid Kubernetes secret name
    const environment = this.config.environment;
    const safeName = key.replace(/[^a-z0-9-]/g, '-').toLowerCase();
    return `nexus-${environment}-${safeName}`;
  }

  private extractKeyFromSecretName(secretName: string): string | null {
    const environment = this.config.environment;
    const prefix = `nexus-${environment}-`;
    
    if (secretName.startsWith(prefix)) {
      return secretName.substring(prefix.length).replace(/-/g, '/');
    }
    
    return null;
  }

  private generateSecretValue(key: string): string {
    const crypto = require('crypto');
    
    if (key.includes('password') || key.includes('secret')) {
      return crypto.randomBytes(32).toString('base64');
    } else if (key.includes('key')) {
      return crypto.randomBytes(32).toString('hex');
    } else {
      return crypto.randomBytes(16).toString('base64');
    }
  }

  // Kubernetes-specific methods
  async createNamespace(namespace: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const namespaceManifest = {
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: {
          name: namespace,
          labels: {
            'nexus.workspace/managed': 'true',
          },
        },
      };

      await this.client.api.v1.namespaces.post({
        body: namespaceManifest,
      });
    } catch (error) {
      if (error.statusCode !== 409) { // Ignore if namespace already exists
        throw new Error(`Failed to create namespace: ${error.message}`);
      }
    }
  }

  async getSecretAsConfigMap(key: string): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const secret = await this.getSecret(key);
      if (!secret) {
        return null;
      }

      const configMapName = this.buildSecretName(key) + '-config';
      
      return {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: configMapName,
          namespace: this.namespace,
        },
        data: typeof secret.value === 'string' 
          ? { value: secret.value }
          : secret.value,
      };
    } catch (error) {
      throw new Error(`Failed to convert secret to ConfigMap: ${error.message}`);
    }
  }
}
