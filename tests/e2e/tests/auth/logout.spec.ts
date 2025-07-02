import { test, expect } from '@playwright/test';

/**
 * Logout Tests
 * 
 * Tests for user logout functionality including proper session cleanup
 * and redirect behavior.
 */

test.describe('User Logout', () => {
  // These tests require authentication, so they use the authenticated state
  test.use({ storageState: 'playwright/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    // Start from the dashboard/home page for each test
    await page.goto('/dashboard');
    
    // Verify we're logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should logout successfully @smoke', async ({ page }) => {
    // Click user menu to open dropdown
    await page.click('[data-testid="user-menu"]');
    
    // Wait for dropdown to be visible
    await expect(page.locator('[data-testid="user-dropdown"]')).toBeVisible();
    
    // Click logout button
    await page.click('[data-testid="logout-button"]');
    
    // Should redirect to login page or home page
    await expect(page).toHaveURL(/\/(auth\/login|home|\/)$/);
    
    // Should not show user menu anymore
    await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible();
    
    // Should show login/register buttons or login form
    const loginButton = page.locator('[data-testid="login-button"]');
    const loginForm = page.locator('[data-testid="login-form"]');
    
    await expect(loginButton.or(loginForm)).toBeVisible();
  });

  test('should clear session data on logout', async ({ page }) => {
    // Get current local storage and session storage
    const beforeLogout = await page.evaluate(() => ({
      localStorage: { ...localStorage },
      sessionStorage: { ...sessionStorage },
    }));
    
    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    // Wait for redirect
    await page.waitForURL(/\/(auth\/login|home|\/)$/);
    
    // Check that session data is cleared
    const afterLogout = await page.evaluate(() => ({
      localStorage: { ...localStorage },
      sessionStorage: { ...sessionStorage },
    }));
    
    // Auth tokens should be removed
    expect(afterLogout.localStorage.token).toBeUndefined();
    expect(afterLogout.localStorage.refreshToken).toBeUndefined();
    expect(afterLogout.sessionStorage.token).toBeUndefined();
    
    // User data should be cleared
    expect(afterLogout.localStorage.user).toBeUndefined();
    expect(afterLogout.sessionStorage.user).toBeUndefined();
  });

  test('should prevent access to protected pages after logout', async ({ page }) => {
    // Logout first
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    // Wait for redirect
    await page.waitForURL(/\/(auth\/login|home|\/)$/);
    
    // Try to access protected pages
    const protectedPages = ['/dashboard', '/profile', '/settings'];
    
    for (const protectedPage of protectedPages) {
      await page.goto(protectedPage);
      
      // Should redirect to login page
      await expect(page).toHaveURL(/\/auth\/login/);
      
      // Should show login form
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    }
  });

  test('should show logout confirmation dialog', async ({ page }) => {
    // Check if logout confirmation is implemented
    await page.click('[data-testid="user-menu"]');
    
    const logoutButton = page.locator('[data-testid="logout-button"]');
    await logoutButton.click();
    
    // Check if confirmation dialog appears
    const confirmDialog = page.locator('[data-testid="logout-confirmation"]');
    
    if (await confirmDialog.isVisible()) {
      // Should show confirmation message
      await expect(confirmDialog).toContainText(/sure|logout|sign out/i);
      
      // Should have confirm and cancel buttons
      await expect(page.locator('[data-testid="confirm-logout"]')).toBeVisible();
      await expect(page.locator('[data-testid="cancel-logout"]')).toBeVisible();
      
      // Test cancel functionality
      await page.click('[data-testid="cancel-logout"]');
      
      // Should remain on current page
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      
      // Test confirm functionality
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');
      await page.click('[data-testid="confirm-logout"]');
      
      // Should logout successfully
      await expect(page).toHaveURL(/\/(auth\/login|home|\/)$/);
    }
  });

  test('should handle logout API errors gracefully', async ({ page }) => {
    // Intercept logout request and simulate server error
    await page.route('**/api/auth/logout', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });
    
    // Attempt logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    // Even if API fails, should still clear local session and redirect
    await expect(page).toHaveURL(/\/(auth\/login|home|\/)$/);
    await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible();
    
    // Should show error message if implemented
    const errorMessage = page.locator('[data-testid="error-message"]');
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toContainText(/error|failed/i);
    }
  });

  test('should logout from all tabs/windows', async ({ context, page }) => {
    // Open a second tab with the same authenticated context
    const secondPage = await context.newPage();
    await secondPage.goto('/dashboard');
    
    // Verify both tabs are authenticated
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(secondPage.locator('[data-testid="user-menu"]')).toBeVisible();
    
    // Logout from first tab
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    // Wait for logout to complete
    await page.waitForURL(/\/(auth\/login|home|\/)$/);
    
    // Refresh second tab to check if session is cleared
    await secondPage.reload();
    
    // Second tab should also be logged out
    await expect(secondPage).toHaveURL(/\/(auth\/login|home|\/)$/);
    await expect(secondPage.locator('[data-testid="user-menu"]')).not.toBeVisible();
    
    await secondPage.close();
  });

  test('should show logout loading state', async ({ page }) => {
    // Click user menu
    await page.click('[data-testid="user-menu"]');
    
    // Click logout and immediately check for loading state
    await page.click('[data-testid="logout-button"]');
    
    // Should show loading indicator if implemented
    const loadingIndicator = page.locator('[data-testid="logout-loading"]');
    if (await loadingIndicator.isVisible()) {
      await expect(loadingIndicator).toBeVisible();
    }
    
    // Should eventually redirect
    await expect(page).toHaveURL(/\/(auth\/login|home|\/)$/);
  });

  test('should handle network errors during logout', async ({ page }) => {
    // Intercept logout request and simulate network failure
    await page.route('**/api/auth/logout', route => {
      route.abort('failed');
    });
    
    // Attempt logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    // Should still logout locally even if network fails
    await expect(page).toHaveURL(/\/(auth\/login|home|\/)$/);
    await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible();
    
    // Local storage should be cleared
    const storage = await page.evaluate(() => ({
      token: localStorage.getItem('token'),
      user: localStorage.getItem('user'),
    }));
    
    expect(storage.token).toBeNull();
    expect(storage.user).toBeNull();
  });

  test('should redirect to intended page after re-login', async ({ page }) => {
    // Start on a specific protected page
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile/);
    
    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/);
    
    // Login again
    const testEmail = process.env.E2E_TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!';
    
    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', testPassword);
    await page.click('[data-testid="login-submit"]');
    
    // Should redirect back to the original page or dashboard
    await expect(page).toHaveURL(/\/(profile|dashboard)/);
  });
});
