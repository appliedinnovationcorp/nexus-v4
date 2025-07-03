import { initialize, isEnabled, getVariant, getAllToggles, destroy } from 'unleash-client';
import { FeatureFlagProvider, FeatureFlagConfig, UserContext, FeatureFlagEvent, FeatureFlagEventHandler } from '../types';

export class UnleashProvider implements FeatureFlagProvider {
  private client: any;
  private config: FeatureFlagConfig;
  private eventHandlers: FeatureFlagEventHandler[] = [];
  private isInitialized = false;

  constructor(config: FeatureFlagConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const unleashConfig = this.config.unleash;
    if (!unleashConfig) {
      throw new Error('Unleash configuration is required');
    }

    try {
      this.client = initialize({
        url: unleashConfig.url,
        appName: unleashConfig.appName,
        instanceId: unleashConfig.instanceId || `nexus-${Date.now()}`,
        refreshInterval: unleashConfig.refreshInterval || 15000, // 15 seconds
        metricsInterval: unleashConfig.metricsInterval || 60000, // 1 minute
        strategies: [
          // Custom strategies can be added here
        ],
      });

      // Set up event listeners
      this.client.on('ready', () => {
        this.isInitialized = true;
        this.emitEvent({
          type: 'ready',
          timestamp: Date.now(),
        });
      });

      this.client.on('error', (error: Error) => {
        this.emitEvent({
          type: 'error',
          error,
          timestamp: Date.now(),
        });
      });

      this.client.on('update', () => {
        this.emitEvent({
          type: 'update',
          timestamp: Date.now(),
        });
      });

      // Wait for client to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Unleash client initialization timeout'));
        }, 10000);

        this.client.on('ready', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.client.on('error', (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

    } catch (error) {
      throw new Error(`Failed to initialize Unleash client: ${error.message}`);
    }
  }

  async isEnabled(flagKey: string, userContext?: UserContext, defaultValue: boolean = false): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const context = this.buildUnleashContext(userContext);
      const result = isEnabled(flagKey, context, defaultValue);
      
      this.emitEvent({
        type: 'evaluation',
        flagKey,
        value: result,
        userContext,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      this.emitEvent({
        type: 'error',
        flagKey,
        error: error as Error,
        timestamp: Date.now(),
      });
      return defaultValue;
    }
  }

  async getVariant(flagKey: string, userContext?: UserContext, defaultValue: string = 'control'): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const context = this.buildUnleashContext(userContext);
      const variant = getVariant(flagKey, context);
      const result = variant.enabled ? variant.name : defaultValue;
      
      this.emitEvent({
        type: 'evaluation',
        flagKey,
        value: result,
        userContext,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      this.emitEvent({
        type: 'error',
        flagKey,
        error: error as Error,
        timestamp: Date.now(),
      });
      return defaultValue;
    }
  }

  async getNumber(flagKey: string, userContext?: UserContext, defaultValue: number = 0): Promise<number> {
    const variant = await this.getVariant(flagKey, userContext, defaultValue.toString());
    const parsed = parseFloat(variant);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  async getString(flagKey: string, userContext?: UserContext, defaultValue: string = ''): Promise<string> {
    return await this.getVariant(flagKey, userContext, defaultValue);
  }

  async getAllFlags(userContext?: UserContext): Promise<Record<string, any>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const context = this.buildUnleashContext(userContext);
      const toggles = getAllToggles(context);
      
      const flags: Record<string, any> = {};
      for (const toggle of toggles) {
        flags[toggle.name] = {
          enabled: toggle.enabled,
          variant: toggle.variant?.name || null,
          impressionData: toggle.impressionData,
        };
      }

      return flags;
    } catch (error) {
      this.emitEvent({
        type: 'error',
        error: error as Error,
        timestamp: Date.now(),
      });
      return {};
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      destroy();
      this.isInitialized = false;
    }
  }

  onEvent(handler: FeatureFlagEventHandler): void {
    this.eventHandlers.push(handler);
  }

  private emitEvent(event: FeatureFlagEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in feature flag event handler:', error);
      }
    });
  }

  private buildUnleashContext(userContext?: UserContext): any {
    if (!userContext) {
      return {};
    }

    return {
      userId: userContext.userId,
      sessionId: userContext.userId, // Unleash uses sessionId for user identification
      remoteAddress: '127.0.0.1', // Could be passed in userContext
      properties: {
        email: userContext.email,
        name: userContext.name,
        country: userContext.country,
        region: userContext.region,
        organization: userContext.organization,
        plan: userContext.plan,
        role: userContext.role,
        beta: userContext.beta,
        ...userContext.customAttributes,
      },
    };
  }
}
