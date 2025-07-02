import { test, expect } from '@playwright/test';

/**
 * User Registration Tests
 * 
 * Tests for user registration functionality including form validation,
 * successful registration, and error handling.
 */

test.describe('User Registration', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the registration page for each test
    await page.goto('/auth/register');
  });

  test('should display registration form @smoke', async ({ page }) => {
    // Check that registration form is visible
    await expect(page.locator('[data-testid="register-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="first-name-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="last-name-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="confirm-password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="register-submit"]')).toBeVisible();
    
    // Check form labels
    await expect(page.locator('label[for="firstName"]')).toContainText('First Name');
    await expect(page.locator('label[for="lastName"]')).toContainText('Last Name');
    await expect(page.locator('label[for="email"]')).toContainText('Email');
    await expect(page.locator('label[for="password"]')).toContainText('Password');
    await expect(page.locator('label[for="confirmPassword"]')).toContainText('Confirm Password');
    
    // Check navigation links
    await expect(page.locator('[data-testid="login-link"]')).toBeVisible();
  });

  test('should register new user successfully @smoke', async ({ page }) => {
    const timestamp = Date.now();
    const testUser = {
      firstName: 'Test',
      lastName: 'User',
      email: `test.user.${timestamp}@example.com`,
      password: 'TestPassword123!',
    };
    
    // Fill registration form
    await page.fill('[data-testid="first-name-input"]', testUser.firstName);
    await page.fill('[data-testid="last-name-input"]', testUser.lastName);
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.fill('[data-testid="confirm-password-input"]', testUser.password);
    
    // Submit form
    await page.click('[data-testid="register-submit"]');
    
    // Should redirect to dashboard or show success message
    await expect(page).toHaveURL(/\/(dashboard|home|auth\/verify-email)/);
    
    // If redirected to email verification, check for verification message
    if (await page.locator('[data-testid="verification-message"]').isVisible()) {
      await expect(page.locator('[data-testid="verification-message"]')).toContainText(/verify|email|sent/i);
    } else {
      // If directly logged in, should show user menu
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    }
  });

  test('should validate required fields', async ({ page }) => {
    // Try to submit empty form
    await page.click('[data-testid="register-submit"]');
    
    // Should show validation errors for all required fields
    await expect(page.locator('[data-testid="first-name-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="last-name-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="confirm-password-error"]')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    // Enter invalid email format
    await page.fill('[data-testid="email-input"]', 'invalid-email');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.fill('[data-testid="confirm-password-input"]', 'TestPassword123!');
    
    // Try to submit
    await page.click('[data-testid="register-submit"]');
    
    // Should show email format error
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-error"]')).toContainText(/valid email|email format/i);
  });

  test('should validate password requirements', async ({ page }) => {
    const testCases = [
      { password: '123', error: /length|characters/i },
      { password: 'password', error: /uppercase|capital/i },
      { password: 'PASSWORD', error: /lowercase/i },
      { password: 'Password', error: /number|digit/i },
      { password: 'Password123', error: /special|symbol/i },
    ];
    
    for (const testCase of testCases) {
      // Clear and fill password field
      await page.fill('[data-testid="password-input"]', '');
      await page.fill('[data-testid="password-input"]', testCase.password);
      
      // Try to submit
      await page.click('[data-testid="register-submit"]');
      
      // Should show password requirement error
      await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="password-error"]')).toContainText(testCase.error);
    }
  });

  test('should validate password confirmation', async ({ page }) => {
    // Fill form with mismatched passwords
    await page.fill('[data-testid="first-name-input"]', 'Test');
    await page.fill('[data-testid="last-name-input"]', 'User');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.fill('[data-testid="confirm-password-input"]', 'DifferentPassword123!');
    
    // Try to submit
    await page.click('[data-testid="register-submit"]');
    
    // Should show password mismatch error
    await expect(page.locator('[data-testid="confirm-password-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="confirm-password-error"]')).toContainText(/match|same/i);
  });

  test('should show error for existing email', async ({ page }) => {
    const existingEmail = process.env.E2E_TEST_USER_EMAIL || 'test@example.com';
    
    // Fill form with existing email
    await page.fill('[data-testid="first-name-input"]', 'Test');
    await page.fill('[data-testid="last-name-input"]', 'User');
    await page.fill('[data-testid="email-input"]', existingEmail);
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.fill('[data-testid="confirm-password-input"]', 'TestPassword123!');
    
    // Submit form
    await page.click('[data-testid="register-submit"]');
    
    // Should show error message for existing email
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/already exists|already registered/i);
  });

  test('should navigate to login page', async ({ page }) => {
    // Click login link
    await page.click('[data-testid="login-link"]');
    
    // Should navigate to login page
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });

  test('should show loading state during registration', async ({ page }) => {
    const timestamp = Date.now();
    const testUser = {
      firstName: 'Test',
      lastName: 'User',
      email: `test.loading.${timestamp}@example.com`,
      password: 'TestPassword123!',
    };
    
    // Fill registration form
    await page.fill('[data-testid="first-name-input"]', testUser.firstName);
    await page.fill('[data-testid="last-name-input"]', testUser.lastName);
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.fill('[data-testid="confirm-password-input"]', testUser.password);
    
    // Submit form and immediately check for loading state
    await page.click('[data-testid="register-submit"]');
    
    // Should show loading indicator
    await expect(page.locator('[data-testid="register-loading"]')).toBeVisible();
    
    // Submit button should be disabled
    await expect(page.locator('[data-testid="register-submit"]')).toBeDisabled();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Intercept registration request and simulate network error
    await page.route('**/api/auth/register', route => {
      route.abort('failed');
    });
    
    const timestamp = Date.now();
    const testUser = {
      firstName: 'Test',
      lastName: 'User',
      email: `test.network.${timestamp}@example.com`,
      password: 'TestPassword123!',
    };
    
    // Fill and submit form
    await page.fill('[data-testid="first-name-input"]', testUser.firstName);
    await page.fill('[data-testid="last-name-input"]', testUser.lastName);
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.fill('[data-testid="confirm-password-input"]', testUser.password);
    await page.click('[data-testid="register-submit"]');
    
    // Should show network error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/network|connection|try again/i);
  });

  test('should accept terms and conditions', async ({ page }) => {
    // Check if terms checkbox exists
    const termsCheckbox = page.locator('[data-testid="terms-checkbox"]');
    
    if (await termsCheckbox.isVisible()) {
      const timestamp = Date.now();
      const testUser = {
        firstName: 'Test',
        lastName: 'User',
        email: `test.terms.${timestamp}@example.com`,
        password: 'TestPassword123!',
      };
      
      // Fill form without checking terms
      await page.fill('[data-testid="first-name-input"]', testUser.firstName);
      await page.fill('[data-testid="last-name-input"]', testUser.lastName);
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.fill('[data-testid="confirm-password-input"]', testUser.password);
      
      // Try to submit without accepting terms
      await page.click('[data-testid="register-submit"]');
      
      // Should show terms error
      await expect(page.locator('[data-testid="terms-error"]')).toBeVisible();
      
      // Check terms and try again
      await termsCheckbox.check();
      await page.click('[data-testid="register-submit"]');
      
      // Should proceed with registration
      await expect(page).toHaveURL(/\/(dashboard|home|auth\/verify-email)/);
    }
  });

  test('should show password strength indicator', async ({ page }) => {
    const passwordStrengthIndicator = page.locator('[data-testid="password-strength"]');
    
    if (await passwordStrengthIndicator.isVisible()) {
      const passwords = [
        { password: '123', strength: /weak/i },
        { password: 'password', strength: /weak/i },
        { password: 'Password123', strength: /medium|good/i },
        { password: 'Password123!@#', strength: /strong/i },
      ];
      
      for (const testCase of passwords) {
        await page.fill('[data-testid="password-input"]', testCase.password);
        
        // Wait for strength indicator to update
        await page.waitForTimeout(500);
        
        // Check strength indicator
        await expect(passwordStrengthIndicator).toContainText(testCase.strength);
      }
    }
  });
});
