import { 
  SecretsManagerClient, 
  GetSecretValueCommand, 
  CreateSecretCommand, 
  UpdateSecretCommand,
  DeleteSecretCommand,
  ListSecretsCommand,
  RotateSecretCommand,
  DescribeSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { SecretProvider, SecretManagerConfig, Secret, SecretMetadata, SecretAuditEvent, SecretAuditHandler } from '../types';

export class AWSSecretsManagerProvider implements SecretProvider {
  private client: SecretsManagerClient;
  private kmsClient: KMSClient;
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

    const awsConfig = this.config.aws;
    if (!awsConfig) {
      throw new Error('AWS configuration is required');
    }

    try {
      const clientConfig: any = {
        region: awsConfig.region,
      };

      // Configure credentials if provided
      if (awsConfig.accessKeyId && awsConfig.secretAccessKey) {
        clientConfig.credentials = {
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
          sessionToken: awsConfig.sessionToken,
        };
      }

      this.client = new SecretsManagerClient(clientConfig);
      this.kmsClient = new KMSClient(clientConfig);

      // Test connection
      await this.client.send(new ListSecretsCommand({ MaxResults: 1 }));
      
      this.isInitialized = true;
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'read',
        secretKey: '__aws_status__',
        source: 'aws-secrets-manager-provider',
        success: true,
        metadata: { action: 'initialize' },
      });

    } catch (error) {
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'read',
        secretKey: '__aws_status__',
        source: 'aws-secrets-manager-provider',
        success: false,
        error: error.message,
        metadata: { action: 'initialize' },
      });
      throw new Error(`Failed to initialize AWS Secrets Manager client: ${error.message}`);
    }
  }

  async getSecret(key: string): Promise<Secret | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const secretName = this.buildSecretName(key);
      
      const command = new GetSecretValueCommand({
        SecretId: secretName,
      });

      const response = await this.client.send(command);
      
      if (!response.SecretString && !response.SecretBinary) {
        this.emitAuditEvent({
          timestamp: new Date(),
          operation: 'read',
          secretKey: key,
          source: 'aws-secrets-manager-provider',
          success: false,
          error: 'Secret not found',
        });
        return null;
      }

      let secretValue: string | Record<string, any>;
      
      if (response.SecretString) {
        try {
          secretValue = JSON.parse(response.SecretString);
        } catch {
          secretValue = response.SecretString;
        }
      } else if (response.SecretBinary) {
        secretValue = Buffer.from(response.SecretBinary).toString('utf-8');
      } else {
        return null;
      }

      const secret: Secret = {
        key,
        value: secretValue,
        metadata: {
          version: response.VersionId,
          createdAt: response.CreatedDate,
          updatedAt: response.CreatedDate,
          description: response.Description,
          tags: this.parseAwsTags(response.Tags),
        },
      };

      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'read',
        secretKey: key,
        source: 'aws-secrets-manager-provider',
        success: true,
      });

      return secret;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        this.emitAuditEvent({
          timestamp: new Date(),
          operation: 'read',
          secretKey: key,
          source: 'aws-secrets-manager-provider',
          success: false,
          error: 'Secret not found',
        });
        return null;
      }

      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'read',
        secretKey: key,
        source: 'aws-secrets-manager-provider',
        success: false,
        error: error.message,
      });
      throw new Error(`Failed to get secret from AWS Secrets Manager: ${error.message}`);
    }
  }

  async setSecret(key: string, value: string | Record<string, any>, metadata?: SecretMetadata): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const secretName = this.buildSecretName(key);
      const secretString = typeof value === 'string' ? value : JSON.stringify(value);

      // Check if secret exists
      let secretExists = false;
      try {
        await this.client.send(new DescribeSecretCommand({ SecretId: secretName }));
        secretExists = true;
      } catch (error) {
        if (error.name !== 'ResourceNotFoundException') {
          throw error;
        }
      }

      if (secretExists) {
        // Update existing secret
        const updateCommand = new UpdateSecretCommand({
          SecretId: secretName,
          SecretString: secretString,
          Description: metadata?.description,
          KmsKeyId: this.config.aws?.kmsKeyId,
        });

        await this.client.send(updateCommand);
      } else {
        // Create new secret
        const createCommand = new CreateSecretCommand({
          Name: secretName,
          SecretString: secretString,
          Description: metadata?.description,
          KmsKeyId: this.config.aws?.kmsKeyId,
          Tags: this.buildAwsTags(metadata?.tags),
        });

        await this.client.send(createCommand);
      }

      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'write',
        secretKey: key,
        source: 'aws-secrets-manager-provider',
        success: true,
        metadata: { exists: secretExists, hasMetadata: !!metadata },
      });

    } catch (error) {
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'write',
        secretKey: key,
        source: 'aws-secrets-manager-provider',
        success: false,
        error: error.message,
      });
      throw new Error(`Failed to set secret in AWS Secrets Manager: ${error.message}`);
    }
  }

  async deleteSecret(key: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const secretName = this.buildSecretName(key);
      
      const command = new DeleteSecretCommand({
        SecretId: secretName,
        ForceDeleteWithoutRecovery: false, // Allow recovery for 30 days
      });

      await this.client.send(command);

      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'delete',
        secretKey: key,
        source: 'aws-secrets-manager-provider',
        success: true,
      });

    } catch (error) {
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'delete',
        secretKey: key,
        source: 'aws-secrets-manager-provider',
        success: false,
        error: error.message,
      });
      throw new Error(`Failed to delete secret from AWS Secrets Manager: ${error.message}`);
    }
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const command = new ListSecretsCommand({
        MaxResults: 100,
      });

      const response = await this.client.send(command);
      
      if (!response.SecretList) {
        return [];
      }

      const secretPrefix = this.buildSecretName('');
      let secrets = response.SecretList
        .filter(secret => secret.Name?.startsWith(secretPrefix))
        .map(secret => this.extractKeyFromSecretName(secret.Name!))
        .filter(key => key !== null) as string[];

      if (prefix) {
        secrets = secrets.filter(key => key.startsWith(prefix));
      }

      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'list',
        secretKey: prefix || '__all__',
        source: 'aws-secrets-manager-provider',
        success: true,
        metadata: { count: secrets.length },
      });

      return secrets;
    } catch (error) {
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'list',
        secretKey: prefix || '__all__',
        source: 'aws-secrets-manager-provider',
        success: false,
        error: error.message,
      });
      throw new Error(`Failed to list secrets from AWS Secrets Manager: ${error.message}`);
    }
  }

  async rotateSecret(key: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const secretName = this.buildSecretName(key);
      
      const command = new RotateSecretCommand({
        SecretId: secretName,
        ForceRotateSecrets: true,
      });

      await this.client.send(command);

      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'rotate',
        secretKey: key,
        source: 'aws-secrets-manager-provider',
        success: true,
      });

    } catch (error) {
      this.emitAuditEvent({
        timestamp: new Date(),
        operation: 'rotate',
        secretKey: key,
        source: 'aws-secrets-manager-provider',
        success: false,
        error: error.message,
      });
      throw new Error(`Failed to rotate secret in AWS Secrets Manager: ${error.message}`);
    }
  }

  async close(): Promise<void> {
    // AWS SDK clients don't need explicit closing
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
    const environment = this.config.environment;
    return `nexus-workspace/${environment}/${key}`;
  }

  private extractKeyFromSecretName(secretName: string): string | null {
    const environment = this.config.environment;
    const prefix = `nexus-workspace/${environment}/`;
    
    if (secretName.startsWith(prefix)) {
      return secretName.substring(prefix.length);
    }
    
    return null;
  }

  private parseAwsTags(tags?: any[]): Record<string, string> | undefined {
    if (!tags || !Array.isArray(tags)) {
      return undefined;
    }

    const result: Record<string, string> = {};
    tags.forEach(tag => {
      if (tag.Key && tag.Value) {
        result[tag.Key] = tag.Value;
      }
    });

    return Object.keys(result).length > 0 ? result : undefined;
  }

  private buildAwsTags(tags?: Record<string, string>): any[] | undefined {
    if (!tags) {
      return undefined;
    }

    return Object.entries(tags).map(([key, value]) => ({
      Key: key,
      Value: value,
    }));
  }

  // AWS-specific methods
  async encryptValue(value: string, keyId?: string): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const command = new EncryptCommand({
        KeyId: keyId || this.config.aws?.kmsKeyId,
        Plaintext: Buffer.from(value, 'utf-8'),
      });

      const response = await this.kmsClient.send(command);
      
      if (!response.CiphertextBlob) {
        throw new Error('Failed to encrypt value');
      }

      return Buffer.from(response.CiphertextBlob).toString('base64');
    } catch (error) {
      throw new Error(`Failed to encrypt value: ${error.message}`);
    }
  }

  async decryptValue(encryptedValue: string): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const command = new DecryptCommand({
        CiphertextBlob: Buffer.from(encryptedValue, 'base64'),
      });

      const response = await this.kmsClient.send(command);
      
      if (!response.Plaintext) {
        throw new Error('Failed to decrypt value');
      }

      return Buffer.from(response.Plaintext).toString('utf-8');
    } catch (error) {
      throw new Error(`Failed to decrypt value: ${error.message}`);
    }
  }

  async getSecretVersions(key: string): Promise<any[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const secretName = this.buildSecretName(key);
      
      const command = new DescribeSecretCommand({
        SecretId: secretName,
      });

      const response = await this.client.send(command);
      
      return response.VersionIdsToStages ? Object.keys(response.VersionIdsToStages) : [];
    } catch (error) {
      throw new Error(`Failed to get secret versions: ${error.message}`);
    }
  }
}
