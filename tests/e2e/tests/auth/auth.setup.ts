import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

/**
 * Authentication setup for E2E tests
 * 
 * This setup test runs before other tests and creates an authenticated
 * user session that can be reused across test files.
 */
setup('authenticate', async ({ page }) => {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const testUserEmail = process.env.E2E_TEST_USER_EMAIL || 'test@example.com';
  const testUserPassword = process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!';
  
  console.log('🔐 Setting up authentication for E2E tests...');
  
  // Navigate to login page
  await page.goto(`${baseURL}/auth/login`);
  
  // Wait for the page to load
  await expect(page).toHaveTitle(/Login|Sign In/);
  
  // Fill in login credentials
  await page.fill('[data-testid="email-input"]', testUserEmail);
  await page.fill('[data-testid="password-input"]', testUserPassword);
  
  // Submit login form
  await page.click('[data-testid="login-submit"]');
  
  // Wait for successful login - should redirect to dashboard or home
  await page.waitForURL(/\/(dashboard|home)/, { timeout: 10000 });
  
  // Verify we're logged in by checking for user-specific elements
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  
  // Save signed-in state to reuse in other tests
  await page.context().storageState({ path: authFile });
  
  console.log('✅ Authentication setup completed');
});
