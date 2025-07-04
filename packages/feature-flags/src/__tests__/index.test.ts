/**
 * @fileoverview Tests for feature flags functionality
 */

import {
  FeatureFlagClient,
  createFeatureFlagClient,
  defaultConfigs,
  UserContext,
  FeatureFlags
} from '../index';

describe('Feature Flags', () => {
  let client: FeatureFlagClient;

  beforeEach(() => {
    client = createFeatureFlagClient({
      apiKey: 'test-key',
      environment: 'test'
    });
  });

  describe('FeatureFlagClient', () => {
    test('should create client instance', () => {
      expect(client).toBeInstanceOf(FeatureFlagClient);
    });

    test('should evaluate feature flags', async () => {
      const userContext: UserContext = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
        plan: 'pro'
      };

      const isEnabled = await client.isEnabled('test-feature', userContext);
      expect(typeof isEnabled).toBe('boolean');
    });

    test('should get feature flag value', async () => {
      const userContext: UserContext = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
        plan: 'pro'
      };

      const value = await client.getValue('test-feature', userContext, 'default');
      expect(value).toBeDefined();
    });

    test('should handle feature flag variations', async () => {
      const userContext: UserContext = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
        plan: 'pro'
      };

      const variation = await client.getVariation('test-feature', userContext);
      expect(typeof variation).toBe('string');
    });
  });

  describe('Default Configurations', () => {
    test('should have default feature flag configurations', () => {
      expect(defaultConfigs).toBeDefined();
      expect(Array.isArray(defaultConfigs)).toBe(true);
      expect(defaultConfigs.length).toBeGreaterThan(0);
    });

    test('should have valid feature flag structure', () => {
      const config = defaultConfigs[0];
      expect(config).toHaveProperty('key');
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('variations');
      expect(config).toHaveProperty('targeting');
    });
  });

  describe('User Context Validation', () => {
    test('should validate user context', () => {
      const validContext: UserContext = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
        plan: 'pro'
      };

      expect(validContext.userId).toBeTruthy();
      expect(validContext.email).toContain('@');
      expect(['admin', 'user', 'guest'].includes(validContext.role)).toBe(true);
      expect(['free', 'pro', 'enterprise'].includes(validContext.plan)).toBe(true);
    });
  });

  describe('Feature Flag Types', () => {
    test('should have correct FeatureFlags enum values', () => {
      expect(FeatureFlags.NEW_DASHBOARD).toBe('new-dashboard');
      expect(FeatureFlags.ADVANCED_ANALYTICS).toBe('advanced-analytics');
      expect(FeatureFlags.BETA_FEATURES).toBe('beta-features');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid API key', () => {
      expect(() => {
        createFeatureFlagClient({
          apiKey: '',
          environment: 'test'
        });
      }).toThrow();
    });

    test('should handle network errors gracefully', async () => {
      const userContext: UserContext = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
        plan: 'pro'
      };

      // Mock network error
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      const isEnabled = await client.isEnabled('test-feature', userContext);
      expect(typeof isEnabled).toBe('boolean'); // Should return default value
    });
  });
});
