import { test, expect } from '@playwright/test';

/**
 * API Tests
 * 
 * Tests for backend API endpoints including authentication, CRUD operations,
 * error handling, and performance. These tests validate the API contract
 * and ensure proper integration between frontend and backend.
 */

test.describe('API Tests', () => {
  let authToken: string;
  let userId: string;

  test.beforeAll(async ({ request }) => {
    // Authenticate and get token for API tests
    const testEmail = process.env.E2E_TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!';
    
    const loginResponse = await request.post('/auth/login', {
      data: {
        email: testEmail,
        password: testPassword,
      },
    });
    
    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    
    authToken = loginData.tokens.accessToken;
    userId = loginData.user.id;
    
    expect(authToken).toBeTruthy();
    expect(userId).toBeTruthy();
  });

  test.describe('Authentication API', () => {
    test('should login with valid credentials @smoke', async ({ request }) => {
      const response = await request.post('/auth/login', {
        data: {
          email: process.env.E2E_TEST_USER_EMAIL || 'test@example.com',
          password: process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!',
        },
      });

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('tokens');
      expect(data.tokens).toHaveProperty('accessToken');
      expect(data.tokens).toHaveProperty('refreshToken');
      expect(data.user).toHaveProperty('email');
      expect(data.user).toHaveProperty('id');
    });

    test('should reject invalid credentials', async ({ request }) => {
      const response = await request.post('/auth/login', {
        data: {
          email: 'invalid@example.com',
          password: 'wrongpassword',
        },
      });

      expect(response.status()).toBe(401);
      
      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('Invalid credentials');
    });

    test('should register new user', async ({ request }) => {
      const timestamp = Date.now();
      const newUser = {
        firstName: 'API',
        lastName: 'Test',
        email: `api.test.${timestamp}@example.com`,
        password: 'ApiTestPassword123!',
      };

      const response = await request.post('/auth/register', {
        data: newUser,
      });

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('tokens');
      expect(data.user.email).toBe(newUser.email);
      expect(data.user.firstName).toBe(newUser.firstName);
      expect(data.user.lastName).toBe(newUser.lastName);
    });

    test('should refresh access token', async ({ request }) => {
      // First login to get refresh token
      const loginResponse = await request.post('/auth/login', {
        data: {
          email: process.env.E2E_TEST_USER_EMAIL || 'test@example.com',
          password: process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!',
        },
      });

      const loginData = await loginResponse.json();
      const refreshToken = loginData.tokens.refreshToken;

      // Use refresh token to get new access token
      const refreshResponse = await request.post('/auth/refresh', {
        data: {
          refreshToken,
        },
      });

      expect(refreshResponse.ok()).toBeTruthy();
      
      const refreshData = await refreshResponse.json();
      expect(refreshData).toHaveProperty('accessToken');
      expect(refreshData).toHaveProperty('refreshToken');
      expect(refreshData.accessToken).not.toBe(loginData.tokens.accessToken);
    });

    test('should logout successfully', async ({ request }) => {
      const response = await request.post('/auth/logout', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.ok()).toBeTruthy();
    });
  });

  test.describe('User API', () => {
    test('should get current user profile @smoke', async ({ request }) => {
      const response = await request.get('/users/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('email');
      expect(data).toHaveProperty('firstName');
      expect(data).toHaveProperty('lastName');
      expect(data.id).toBe(userId);
    });

    test('should update user profile', async ({ request }) => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        bio: 'Updated bio from API test',
      };

      const response = await request.patch('/users/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: updateData,
      });

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.firstName).toBe(updateData.firstName);
      expect(data.lastName).toBe(updateData.lastName);
      expect(data.bio).toBe(updateData.bio);
    });

    test('should change password', async ({ request }) => {
      const changePasswordData = {
        currentPassword: process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!',
        newPassword: 'NewTestPassword123!',
      };

      const response = await request.post('/users/change-password', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: changePasswordData,
      });

      expect(response.ok()).toBeTruthy();

      // Change password back
      const revertResponse = await request.post('/users/change-password', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          currentPassword: 'NewTestPassword123!',
          newPassword: process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!',
        },
      });

      expect(revertResponse.ok()).toBeTruthy();
    });

    test('should require authentication for protected endpoints', async ({ request }) => {
      const response = await request.get('/users/me');

      expect(response.status()).toBe(401);
      
      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('Unauthorized');
    });
  });

  test.describe('CRUD Operations', () => {
    let createdItemId: string;

    test('should create new item', async ({ request }) => {
      const itemData = {
        title: 'API Test Item',
        description: 'Created via API test',
        category: 'test',
      };

      const response = await request.post('/items', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: itemData,
      });

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data.title).toBe(itemData.title);
      expect(data.description).toBe(itemData.description);
      expect(data.category).toBe(itemData.category);
      
      createdItemId = data.id;
    });

    test('should get item by id', async ({ request }) => {
      if (!createdItemId) {
        test.skip('No item created in previous test');
      }

      const response = await request.get(`/items/${createdItemId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.id).toBe(createdItemId);
      expect(data.title).toBe('API Test Item');
    });

    test('should update item', async ({ request }) => {
      if (!createdItemId) {
        test.skip('No item created in previous test');
      }

      const updateData = {
        title: 'Updated API Test Item',
        description: 'Updated via API test',
      };

      const response = await request.patch(`/items/${createdItemId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: updateData,
      });

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.title).toBe(updateData.title);
      expect(data.description).toBe(updateData.description);
    });

    test('should list items with pagination', async ({ request }) => {
      const response = await request.get('/items?page=1&limit=10', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('pagination');
      expect(Array.isArray(data.items)).toBeTruthy();
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('total');
    });

    test('should delete item', async ({ request }) => {
      if (!createdItemId) {
        test.skip('No item created in previous test');
      }

      const response = await request.delete(`/items/${createdItemId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.ok()).toBeTruthy();

      // Verify item is deleted
      const getResponse = await request.get(`/items/${createdItemId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(getResponse.status()).toBe(404);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle validation errors', async ({ request }) => {
      const invalidData = {
        title: '', // Empty title should fail validation
        description: 'x'.repeat(1001), // Too long description
      };

      const response = await request.post('/items', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: invalidData,
      });

      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('errors');
      expect(Array.isArray(data.errors)).toBeTruthy();
    });

    test('should handle not found errors', async ({ request }) => {
      const response = await request.get('/items/non-existent-id', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status()).toBe(404);
      
      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('not found');
    });

    test('should handle rate limiting', async ({ request }) => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array.from({ length: 20 }, () =>
        request.get('/users/me', {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        })
      );

      const responses = await Promise.all(requests);
      
      // At least one should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status() === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      if (rateLimitedResponses.length > 0) {
        const data = await rateLimitedResponses[0].json();
        expect(data).toHaveProperty('message');
        expect(data.message).toContain('rate limit');
      }
    });
  });

  test.describe('Performance Tests', () => {
    test('should respond within acceptable time limits @performance', async ({ request }) => {
      const startTime = Date.now();
      
      const response = await request.get('/users/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.ok()).toBeTruthy();
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    test('should handle concurrent requests', async ({ request }) => {
      const concurrentRequests = 10;
      const requests = Array.from({ length: concurrentRequests }, () =>
        request.get('/users/me', {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.ok()).toBeTruthy();
      });

      // Total time should be reasonable for concurrent requests
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  test.describe('Health and Status', () => {
    test('should return health status @smoke', async ({ request }) => {
      const response = await request.get('/health');

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data.status).toBe('ok');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
    });

    test('should return API version info', async ({ request }) => {
      const response = await request.get('/version');

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('name');
      expect(data.name).toBe('Nexus Backend');
    });
  });
});
