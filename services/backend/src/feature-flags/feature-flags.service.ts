import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FeatureFlagClient, createFeatureFlagClient, defaultConfigs, UserContext, FeatureFlags } from '@nexus/feature-flags';

@Injectable()
export class FeatureFlagsService implements OnModuleInit, OnModuleDestroy {
  private client: FeatureFlagClient;

  constructor(private configService: ConfigService) {
    this.initializeClient();
  }

  private initializeClient(): void {
    const provider = this.configService.get('FEATURE_FLAG_PROVIDER', 'local');
    
    switch (provider) {
      case 'unleash':
        this.client = createFeatureFlagClient(defaultConfigs.unleash(
          this.configService.get('UNLEASH_URL', 'http://unleash:4242/api'),
          this.configService.get('UNLEASH_APP_NAME', 'nexus-workspace'),
          this.configService.get('UNLEASH_CLIENT_KEY')
        ));
        break;
        
      case 'launchdarkly':
        this.client = createFeatureFlagClient(defaultConfigs.launchdarkly(
          this.configService.get('LAUNCHDARKLY_SDK_KEY', '')
        ));
        break;
        
      default:
        // Local provider with default flags
        this.client = createFeatureFlagClient(defaultConfigs.local({
          [FeatureFlags.NEW_DASHBOARD]: false,
          [FeatureFlags.DARK_MODE]: true,
          [FeatureFlags.ADVANCED_SEARCH]: false,
          [FeatureFlags.BETA_FEATURES]: false,
          [FeatureFlags.PREMIUM_FEATURES]: false,
          [FeatureFlags.ANALYTICS_DASHBOARD]: true,
          [FeatureFlags.EXPORT_FUNCTIONALITY]: false,
          [FeatureFlags.COLLABORATION_TOOLS]: false,
          [FeatureFlags.NEW_API_VERSION]: false,
          [FeatureFlags.ENHANCED_SECURITY]: true,
          [FeatureFlags.PERFORMANCE_OPTIMIZATIONS]: true,
          [FeatureFlags.EXPERIMENTAL_FEATURES]: false,
          [FeatureFlags.CHECKOUT_FLOW_V2]: false,
          [FeatureFlags.ONBOARDING_FLOW_V2]: false,
          [FeatureFlags.PRICING_PAGE_V2]: false,
          [FeatureFlags.MAINTENANCE_MODE]: false,
          [FeatureFlags.READ_ONLY_MODE]: false,
          [FeatureFlags.RATE_LIMITING]: true,
          [FeatureFlags.DEBUG_MODE]: this.configService.get('NODE_ENV') === 'development',
        }));
    }

    // Set up event logging
    this.client.onEvent((event) => {
      if (event.type === 'error') {
        console.error('Feature flag error:', event.error?.message, {
          flagKey: event.flagKey,
          timestamp: new Date(event.timestamp).toISOString(),
        });
      } else if (event.type === 'evaluation') {
        console.log('Feature flag evaluated:', {
          flagKey: event.flagKey,
          value: event.value,
          userId: event.userContext?.userId,
          timestamp: new Date(event.timestamp).toISOString(),
        });
      }
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.initialize();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  // Core feature flag methods
  async isEnabled(flagKey: string | FeatureFlags, userContext?: UserContext, defaultValue: boolean = false): Promise<boolean> {
    return await this.client.isEnabled(flagKey, userContext, defaultValue);
  }

  async getVariant(flagKey: string | FeatureFlags, userContext?: UserContext, defaultValue: string = 'control'): Promise<string> {
    return await this.client.getVariant(flagKey, userContext, defaultValue);
  }

  async getNumber(flagKey: string | FeatureFlags, userContext?: UserContext, defaultValue: number = 0): Promise<number> {
    return await this.client.getNumber(flagKey, userContext, defaultValue);
  }

  async getString(flagKey: string | FeatureFlags, userContext?: UserContext, defaultValue: string = ''): Promise<string> {
    return await this.client.getString(flagKey, userContext, defaultValue);
  }

  async getAllFlags(userContext?: UserContext): Promise<Record<string, any>> {
    return await this.client.getAllFlags(userContext);
  }

  // Convenience methods for common use cases
  async when<T>(flagKey: string | FeatureFlags, userContext?: UserContext) {
    return await this.client.when<T>(flagKey, userContext);
  }

  async evaluateFlags(flagKeys: (string | FeatureFlags)[], userContext?: UserContext): Promise<Record<string, any>> {
    return await this.client.evaluateFlags(flagKeys, userContext);
  }

  // Business-specific feature flag methods
  async canAccessPremiumFeatures(userContext?: UserContext): Promise<boolean> {
    return await this.isEnabled(FeatureFlags.PREMIUM_FEATURES, userContext);
  }

  async canAccessBetaFeatures(userContext?: UserContext): Promise<boolean> {
    return await this.isEnabled(FeatureFlags.BETA_FEATURES, userContext);
  }

  async isMaintenanceMode(): Promise<boolean> {
    return await this.isEnabled(FeatureFlags.MAINTENANCE_MODE);
  }

  async isReadOnlyMode(): Promise<boolean> {
    return await this.isEnabled(FeatureFlags.READ_ONLY_MODE);
  }

  async shouldUseNewDashboard(userContext?: UserContext): Promise<boolean> {
    return await this.isEnabled(FeatureFlags.NEW_DASHBOARD, userContext);
  }

  async getCheckoutFlowVariant(userContext?: UserContext): Promise<string> {
    return await this.getVariant(FeatureFlags.CHECKOUT_FLOW_V2, userContext);
  }

  async getOnboardingFlowVariant(userContext?: UserContext): Promise<string> {
    return await this.getVariant(FeatureFlags.ONBOARDING_FLOW_V2, userContext);
  }

  // User context helpers
  buildUserContext(user: any): UserContext {
    return {
      userId: user.id?.toString(),
      email: user.email,
      name: user.name,
      country: user.country,
      region: user.region,
      organization: user.organization?.name,
      plan: user.subscription?.plan,
      role: user.role,
      beta: user.betaUser || false,
      customAttributes: {
        signupDate: user.createdAt?.toISOString(),
        lastLoginDate: user.lastLoginAt?.toISOString(),
        totalLogins: user.loginCount,
        isVerified: user.emailVerified,
        ...user.customAttributes,
      },
    };
  }

  // Metrics and monitoring
  getMetrics() {
    return this.client.getMetrics();
  }

  clearMetrics(): void {
    this.client.clearMetrics();
  }

  async clearCache(): Promise<void> {
    await this.client.clearCache();
  }

  async invalidateFlag(flagKey: string | FeatureFlags, userContext?: UserContext): Promise<void> {
    await this.client.invalidateFlag(flagKey, userContext);
  }
}
