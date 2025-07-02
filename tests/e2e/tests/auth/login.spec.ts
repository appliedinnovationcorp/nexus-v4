import { test, expect } from '@playwright/test';

/**
 * Authentication Tests
 * 
 * Tests for login, logout, registration, and password reset functionality.
 * These tests cover the core authentication user journeys.
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the login page for each test
    await page.goto('/auth/login');
  });

  test('should display login form @smoke', async ({ page }) => {
    // Check that login form is visible
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-submit"]')).toBeVisible();
    
    // Check form labels and placeholders
    await expect(page.locator('label[for="email"]')).toContainText('Email');
    await expect(page.locator('label[for="password"]')).toContainText('Password');
    
    // Check navigation links
    await expect(page.locator('[data-testid="register-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="forgot-password-link"]')).toBeVisible();
  });

  test('should login with valid credentials @smoke', async ({ page }) => {
    const testEmail = process.env.E2E_TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!';
    
    // Fill login form
    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', testPassword);
    
    // Submit form
    await page.click('[data-testid="login-submit"]');
    
    // Should redirect to dashboard/home
    await expect(page).toHaveURL(/\/(dashboard|home)/);
    
    // Should show user menu
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    // Should show welcome message or user name
    await expect(page.locator('[data-testid="user-name"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill login form with invalid credentials
    await page.fill('[data-testid="email-input"]', 'invalid@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    
    // Submit form
    await page.click('[data-testid="login-submit"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/invalid|incorrect|wrong/i);
    
    // Should remain on login page
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('should validate required fields', async ({ page }) => {
    // Try to submit empty form
    await page.click('[data-testid="login-submit"]');
    
    // Should show validation errors
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
    
    // Fill only email
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.click('[data-testid="login-submit"]');
    
    // Should still show password error
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
    
    // Email error should be gone
    await expect(page.locator('[data-testid="email-error"]')).not.toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    // Enter invalid email format
    await page.fill('[data-testid="email-input"]', 'invalid-email');
    await page.fill('[data-testid="password-input"]', 'password123');
    
    // Try to submit
    await page.click('[data-testid="login-submit"]');
    
    // Should show email format error
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-error"]')).toContainText(/valid email|email format/i);
  });

  test('should navigate to registration page', async ({ page }) => {
    // Click register link
    await page.click('[data-testid="register-link"]');
    
    // Should navigate to registration page
    await expect(page).toHaveURL(/\/auth\/register/);
    await expect(page.locator('[data-testid="register-form"]')).toBeVisible();
  });

  test('should navigate to forgot password page', async ({ page }) => {
    // Click forgot password link
    await page.click('[data-testid="forgot-password-link"]');
    
    // Should navigate to forgot password page
    await expect(page).toHaveURL(/\/auth\/forgot-password/);
    await expect(page.locator('[data-testid="forgot-password-form"]')).toBeVisible();
  });

  test('should show loading state during login', async ({ page }) => {
    const testEmail = process.env.E2E_TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!';
    
    // Fill login form
    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', testPassword);
    
    // Submit form and immediately check for loading state
    await page.click('[data-testid="login-submit"]');
    
    // Should show loading indicator
    await expect(page.locator('[data-testid="login-loading"]')).toBeVisible();
    
    // Submit button should be disabled
    await expect(page.locator('[data-testid="login-submit"]')).toBeDisabled();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Intercept login request and simulate network error
    await page.route('**/api/auth/login', route => {
      route.abort('failed');
    });
    
    const testEmail = process.env.E2E_TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!';
    
    // Fill and submit form
    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', testPassword);
    await page.click('[data-testid="login-submit"]');
    
    // Should show network error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/network|connection|try again/i);
  });

  test('should remember me functionality', async ({ page }) => {
    // Check if remember me checkbox exists
    const rememberMeCheckbox = page.locator('[data-testid="remember-me"]');
    
    if (await rememberMeCheckbox.isVisible()) {
      // Check remember me
      await rememberMeCheckbox.check();
      await expect(rememberMeCheckbox).toBeChecked();
      
      const testEmail = process.env.E2E_TEST_USER_EMAIL || 'test@example.com';
      const testPassword = process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!';
      
      // Login with remember me checked
      await page.fill('[data-testid="email-input"]', testEmail);
      await page.fill('[data-testid="password-input"]', testPassword);
      await page.click('[data-testid="login-submit"]');
      
      // Should redirect successfully
      await expect(page).toHaveURL(/\/(dashboard|home)/);
      
      // Check that session is persistent (this would need backend support)
      // For now, just verify login was successful
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    }
  });
});
