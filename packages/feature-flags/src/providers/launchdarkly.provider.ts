import * as LaunchDarkly from 'launchdarkly-node-server-sdk';
import { FeatureFlagProvider, FeatureFlagConfig, UserContext, FeatureFlagEvent, FeatureFlagEventHandler } from '../types';

export class LaunchDarklyProvider implements FeatureFlagProvider {
  private client: LaunchDarkly.LDClient | null = null;
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

    const ldConfig = this.config.launchdarkly;
    if (!ldConfig || !ldConfig.sdkKey) {
      throw new Error('LaunchDarkly SDK key is required');
    }

    try {
      const options: LaunchDarkly.LDOptions = {
        offline: ldConfig.offline || false,
        timeout: ldConfig.timeout || 5,
        logger: LaunchDarkly.basicLogger({
          level: 'info',
          destination: console.log,
        }),
      };

      this.client = LaunchDarkly.init(ldConfig.sdkKey, options);

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

      this.client.on('update', (settings) => {
        this.emitEvent({
          type: 'update',
          timestamp: Date.now(),
        });
      });

      // Wait for client to be ready
      await this.client.waitForInitialization();

    } catch (error) {
      throw new Error(`Failed to initialize LaunchDarkly client: ${error.message}`);
    }
  }

  async isEnabled(flagKey: string, userContext?: UserContext, defaultValue: boolean = false): Promise<boolean> {
    if (!this.client || !this.isInitialized) {
      await this.initialize();
    }

    try {
      const user = this.buildLaunchDarklyUser(userContext);
      const result = await this.client!.variation(flagKey, user, defaultValue);
      
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
    if (!this.client || !this.isInitialized) {
      await this.initialize();
    }

    try {
      const user = this.buildLaunchDarklyUser(userContext);
      const result = await this.client!.variation(flagKey, user, defaultValue);
      
      this.emitEvent({
        type: 'evaluation',
        flagKey,
        value: result,
        userContext,
        timestamp: Date.now(),
      });

      return typeof result === 'string' ? result : defaultValue;
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
    if (!this.client || !this.isInitialized) {
      await this.initialize();
    }

    try {
      const user = this.buildLaunchDarklyUser(userContext);
      const result = await this.client!.variation(flagKey, user, defaultValue);
      
      this.emitEvent({
        type: 'evaluation',
        flagKey,
        value: result,
        userContext,
        timestamp: Date.now(),
      });

      return typeof result === 'number' ? result : defaultValue;
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

  async getString(flagKey: string, userContext?: UserContext, defaultValue: string = ''): Promise<string> {
    return await this.getVariant(flagKey, userContext, defaultValue);
  }

  async getAllFlags(userContext?: UserContext): Promise<Record<string, any>> {
    if (!this.client || !this.isInitialized) {
      await this.initialize();
    }

    try {
      const user = this.buildLaunchDarklyUser(userContext);
      const allFlags = await this.client!.allFlagsState(user);
      
      return allFlags.allValues();
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
      await this.client.close();
      this.client = null;
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

  private buildLaunchDarklyUser(userContext?: UserContext): LaunchDarkly.LDUser {
    if (!userContext) {
      return {
        key: 'anonymous',
        anonymous: true,
      };
    }

    const user: LaunchDarkly.LDUser = {
      key: userContext.userId || 'anonymous',
      anonymous: !userContext.userId,
    };

    // Add standard attributes
    if (userContext.email) user.email = userContext.email;
    if (userContext.name) user.name = userContext.name;
    if (userContext.country) user.country = userContext.country;

    // Add custom attributes
    const customAttributes: Record<string, any> = {};
    if (userContext.region) customAttributes.region = userContext.region;
    if (userContext.organization) customAttributes.organization = userContext.organization;
    if (userContext.plan) customAttributes.plan = userContext.plan;
    if (userContext.role) customAttributes.role = userContext.role;
    if (userContext.beta !== undefined) customAttributes.beta = userContext.beta;
    
    // Add any additional custom attributes
    if (userContext.customAttributes) {
      Object.assign(customAttributes, userContext.customAttributes);
    }

    if (Object.keys(customAttributes).length > 0) {
      user.custom = customAttributes;
    }

    return user;
  }
}
