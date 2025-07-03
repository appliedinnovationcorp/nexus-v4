import { FeatureFlagProvider, FeatureFlagConfig, UserContext, FeatureFlagEvent, FeatureFlagEventHandler } from '../types';

export class LocalProvider implements FeatureFlagProvider {
  private config: FeatureFlagConfig;
  private eventHandlers: FeatureFlagEventHandler[] = [];
  private flags: Record<string, any> = {};
  private isInitialized = false;

  constructor(config: FeatureFlagConfig) {
    this.config = config;
    this.flags = config.local?.flags || {};
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Load flags from configuration
    this.flags = this.config.local?.flags || {};
    this.isInitialized = true;

    this.emitEvent({
      type: 'ready',
      timestamp: Date.now(),
    });
  }

  async isEnabled(flagKey: string, userContext?: UserContext, defaultValue: boolean = false): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const value = this.flags[flagKey];
      let result: boolean;

      if (value === undefined || value === null) {
        result = defaultValue;
      } else if (typeof value === 'boolean') {
        result = value;
      } else if (typeof value === 'string') {
        result = value.toLowerCase() === 'true';
      } else if (typeof value === 'number') {
        result = value > 0;
      } else {
        result = defaultValue;
      }

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
      const value = this.flags[flagKey];
      const result = value !== undefined && value !== null ? String(value) : defaultValue;

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
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const value = this.flags[flagKey];
      let result: number;

      if (value === undefined || value === null) {
        result = defaultValue;
      } else if (typeof value === 'number') {
        result = value;
      } else if (typeof value === 'string') {
        const parsed = parseFloat(value);
        result = isNaN(parsed) ? defaultValue : parsed;
      } else if (typeof value === 'boolean') {
        result = value ? 1 : 0;
      } else {
        result = defaultValue;
      }

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

  async getString(flagKey: string, userContext?: UserContext, defaultValue: string = ''): Promise<string> {
    return await this.getVariant(flagKey, userContext, defaultValue);
  }

  async getAllFlags(userContext?: UserContext): Promise<Record<string, any>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return { ...this.flags };
  }

  async close(): Promise<void> {
    this.isInitialized = false;
  }

  onEvent(handler: FeatureFlagEventHandler): void {
    this.eventHandlers.push(handler);
  }

  // Local provider specific methods
  setFlag(flagKey: string, value: any): void {
    this.flags[flagKey] = value;
    this.emitEvent({
      type: 'update',
      flagKey,
      value,
      timestamp: Date.now(),
    });
  }

  removeFlag(flagKey: string): void {
    delete this.flags[flagKey];
    this.emitEvent({
      type: 'update',
      flagKey,
      timestamp: Date.now(),
    });
  }

  loadFlags(flags: Record<string, any>): void {
    this.flags = { ...flags };
    this.emitEvent({
      type: 'update',
      timestamp: Date.now(),
    });
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
}
