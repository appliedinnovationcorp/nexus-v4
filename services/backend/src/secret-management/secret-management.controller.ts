import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { SecretManagementService } from './secret-management.service';
import { SecretMetadata } from '@nexus/secret-management';

// Note: In production, these endpoints should be protected with proper authentication and authorization
// @UseGuards(AdminGuard) should be uncommented when admin guard is implemented

@Controller('api/secrets')
export class SecretManagementController {
  constructor(private readonly secretService: SecretManagementService) {}

  @Get('health')
  async getHealth() {
    return await this.secretService.getHealth();
  }

  @Get('database/config')
  // @UseGuards(AdminGuard)
  async getDatabaseConfig() {
    return await this.secretService.getDatabaseConfig();
  }

  @Get('redis/config')
  // @UseGuards(AdminGuard)
  async getRedisConfig() {
    return await this.secretService.getRedisConfig();
  }

  @Get('ssl/config')
  // @UseGuards(AdminGuard)
  async getSSLConfig() {
    return await this.secretService.getSSLConfig();
  }

  @Get('monitoring/config')
  // @UseGuards(AdminGuard)
  async getMonitoringConfig() {
    return await this.secretService.getMonitoringConfig();
  }

  @Get('backup/config')
  // @UseGuards(AdminGuard)
  async getBackupConfig() {
    return await this.secretService.getBackupConfig();
  }

  @Get('api-keys/:service')
  // @UseGuards(AdminGuard)
  async getApiKey(@Param('service') service: 'datadog' | 'stripe' | 'sendgrid' | 'launchdarkly') {
    const apiKey = await this.secretService.getApiKey(service);
    return {
      service,
      hasKey: !!apiKey,
      keyPreview: apiKey ? `${apiKey.substring(0, 8)}...` : null,
    };
  }

  @Get('webhooks/:service')
  // @UseGuards(AdminGuard)
  async getWebhookSecret(@Param('service') service: 'github' | 'stripe') {
    const secret = await this.secretService.getWebhookSecret(service);
    return {
      service,
      hasSecret: !!secret,
      secretPreview: secret ? `${secret.substring(0, 8)}...` : null,
    };
  }

  @Get('batch')
  // @UseGuards(AdminGuard)
  async getBatchSecrets(@Query('keys') keys: string) {
    if (!keys) {
      return { error: 'Keys parameter is required' };
    }

    const keyList = keys.split(',').map(k => k.trim());
    const secrets = await this.secretService.getSecrets(keyList);
    
    // Return only metadata, not actual values for security
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(secrets)) {
      result[key] = {
        exists: !!value,
        preview: value ? `${value.substring(0, 8)}...` : null,
      };
    }
    
    return result;
  }

  @Post('batch')
  // @UseGuards(AdminGuard)
  async setBatchSecrets(
    @Body() body: {
      secrets: Record<string, string | Record<string, any>>;
      metadata?: SecretMetadata;
    }
  ) {
    try {
      await this.secretService.setSecrets(body.secrets, body.metadata);
      return { 
        success: true, 
        message: `Successfully set ${Object.keys(body.secrets).length} secrets`,
        keys: Object.keys(body.secrets),
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  @Put(':key')
  // @UseGuards(AdminGuard)
  async setSecret(
    @Param('key') key: string,
    @Body() body: {
      value: string | Record<string, any>;
      metadata?: SecretMetadata;
    }
  ) {
    try {
      // Validate secret if it's a string
      if (typeof body.value === 'string') {
        const isValid = await this.secretService.validateSecret(key, body.value);
        if (!isValid) {
          return {
            success: false,
            error: 'Secret validation failed. Please ensure the secret meets security requirements.',
          };
        }
      }

      await this.secretService.setSecret(key, body.value, body.metadata);
      return { 
        success: true, 
        message: `Secret ${key} set successfully` 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  @Delete(':key')
  // @UseGuards(AdminGuard)
  async deleteSecret(@Param('key') key: string) {
    try {
      await this.secretService.deleteSecret(key);
      return { 
        success: true, 
        message: `Secret ${key} deleted successfully` 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  @Post(':key/rotate')
  // @UseGuards(AdminGuard)
  async rotateSecret(@Param('key') key: string) {
    try {
      await this.secretService.rotateSecret(key);
      return { 
        success: true, 
        message: `Secret ${key} rotated successfully` 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  @Post(':key/generate')
  // @UseGuards(AdminGuard)
  async generateSecret(
    @Param('key') key: string,
    @Body() body: {
      type?: 'password' | 'key' | 'token';
      setSecret?: boolean;
      metadata?: SecretMetadata;
    }
  ) {
    try {
      const type = body.type || 'password';
      const generatedSecret = await this.secretService.generateSecret(key, type);
      
      if (body.setSecret) {
        await this.secretService.setSecret(key, generatedSecret, body.metadata);
        return {
          success: true,
          message: `Secret ${key} generated and set successfully`,
          preview: `${generatedSecret.substring(0, 8)}...`,
        };
      } else {
        return {
          success: true,
          message: `Secret generated successfully`,
          secret: generatedSecret, // Only return full secret if not setting it
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  @Post('cache/clear')
  // @UseGuards(AdminGuard)
  async clearCache() {
    try {
      await this.secretService.clearCache();
      return { 
        success: true, 
        message: 'Secret cache cleared successfully' 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  @Post('cache/refresh')
  // @UseGuards(AdminGuard)
  async refreshSecrets() {
    try {
      await this.secretService.refreshSecrets();
      return { 
        success: true, 
        message: 'Secrets refreshed successfully' 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  @Get('validate/:key')
  // @UseGuards(AdminGuard)
  async validateSecret(
    @Param('key') key: string,
    @Query('value') value: string
  ) {
    if (!value) {
      return { 
        valid: false, 
        error: 'Value parameter is required' 
      };
    }

    try {
      const isValid = await this.secretService.validateSecret(key, value);
      return { 
        valid: isValid,
        message: isValid ? 'Secret is valid' : 'Secret validation failed',
      };
    } catch (error) {
      return { 
        valid: false, 
        error: error.message 
      };
    }
  }

  // Development/testing endpoints (should be disabled in production)
  @Get('dev/jwt-secret')
  async getJwtSecretForDev() {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'This endpoint is not available in production' };
    }
    
    const secret = await this.secretService.getJwtSecret();
    return {
      hasSecret: !!secret,
      preview: secret ? `${secret.substring(0, 8)}...` : null,
    };
  }

  @Get('dev/database-url')
  async getDatabaseUrlForDev() {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'This endpoint is not available in production' };
    }
    
    const url = await this.secretService.getDatabaseUrl();
    return {
      hasUrl: !!url,
      preview: url ? url.replace(/\/\/.*@/, '//***:***@') : null,
    };
  }

  // Internal endpoints for application use
  @Get('internal/exists/:key')
  async checkSecretExists(@Param('key') key: string) {
    try {
      const secret = await this.secretService.getSecret(key);
      return { exists: !!secret };
    } catch (error) {
      return { exists: false, error: error.message };
    }
  }

  @Get('internal/metadata/:key')
  async getSecretMetadata(@Param('key') key: string) {
    try {
      // This would need to be implemented in the service
      // For now, just return basic info
      const secret = await this.secretService.getSecret(key);
      return {
        exists: !!secret,
        hasValue: !!secret,
        // Don't return actual metadata for security
      };
    } catch (error) {
      return { exists: false, error: error.message };
    }
  }
}
