/**
 * @fileoverview E2E API tests
 */

import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    // Get auth token
    const response = await request.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'password123'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    authToken = data.token;
  });

  test.describe('Authentication API', () => {
    test('should login with valid credentials', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'test@example.com',
          password: 'password123'
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.token).toBeDefined();
      expect(data.user).toBeDefined();
    });

    test('should reject invalid credentials', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'invalid@example.com',
          password: 'wrongpassword'
        }
      });
      
      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    test('should validate required fields', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {}
      });
      
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.errors).toBeDefined();
    });
  });

  test.describe('Users API', () => {
    test('should get user profile', async ({ request }) => {
      const response = await request.get('/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.email).toBeDefined();
    });

    test('should update user profile', async ({ request }) => {
      const response = await request.put('/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: {
          name: 'Updated Name',
          bio: 'Updated bio'
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.name).toBe('Updated Name');
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.get('/api/users/profile');
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Analytics API', () => {
    test('should get dashboard metrics', async ({ request }) => {
      const response = await request.get('/api/analytics/dashboard', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.totalUsers).toBeDefined();
      expect(data.activeSessions).toBeDefined();
      expect(data.revenue).toBeDefined();
    });

    test('should filter metrics by date range', async ({ request }) => {
      const response = await request.get('/api/analytics/dashboard?from=2023-01-01&to=2023-12-31', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.dateRange).toBeDefined();
    });

    test('should track events', async ({ request }) => {
      const response = await request.post('/api/analytics/events', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: {
          event: 'button_click',
          properties: {
            button_id: 'test-button',
            page: '/dashboard'
          }
        }
      });
      
      expect(response.ok()).toBeTruthy();
    });
  });

  test.describe('Feature Flags API', () => {
    test('should get feature flags', async ({ request }) => {
      const response = await request.get('/api/feature-flags', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(Array.isArray(data.flags)).toBeTruthy();
    });

    test('should evaluate feature flag', async ({ request }) => {
      const response = await request.post('/api/feature-flags/evaluate', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: {
          flagKey: 'new-dashboard',
          context: {
            userId: 'user123',
            plan: 'pro'
          }
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(typeof data.enabled).toBe('boolean');
    });
  });

  test.describe('Health Check API', () => {
    test('should return health status', async ({ request }) => {
      const response = await request.get('/api/health');
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.checks).toBeDefined();
    });

    test('should return detailed health info', async ({ request }) => {
      const response = await request.get('/api/health/detailed');
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.database).toBeDefined();
      expect(data.redis).toBeDefined();
      expect(data.memory).toBeDefined();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle 404 errors', async ({ request }) => {
      const response = await request.get('/api/nonexistent');
      expect(response.status()).toBe(404);
    });

    test('should handle rate limiting', async ({ request }) => {
      // Make multiple rapid requests
      const promises = Array.from({ length: 100 }, () =>
        request.get('/api/users/profile', {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        })
      );
      
      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status() === 429);
      
      // Should have some rate limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});
