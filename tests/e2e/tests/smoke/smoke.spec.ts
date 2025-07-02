import { test, expect } from '@playwright/test';

/**
 * Smoke Tests
 * 
 * Critical path tests that verify the most important functionality
 * is working. These tests should run quickly and catch major issues.
 * They are designed to run on every deployment and pull request.
 */

test.describe('Smoke Tests', () => {
  test('application loads and basic navigation works @smoke', async ({ page }) => {
    // Test home page loads
    await page.goto('/');
    await expect(page).toHaveTitle(/Nexus/);
    
    // Test navigation to login
    await page.goto('/auth/login');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    
    // Test navigation to registration
    await page.goto('/auth/register');
    await expect(page.locator('[data-testid="register-form"]')).toBeVisible();
  });

  test('user can login and access dashboard @smoke', async ({ page }) => {
    const testEmail = process.env.E2E_TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!';
    
    // Login
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', testPassword);
    await page.click('[data-testid="login-submit"]');
    
    // Verify redirect to dashboard
    await expect(page).toHaveURL(/\/(dashboard|home)/);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('API health check passes @smoke', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  test('authentication API works @smoke', async ({ request }) => {
    const testEmail = process.env.E2E_TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!';
    
    const response = await request.post('/auth/login', {
      data: {
        email: testEmail,
        password: testPassword,
      },
    });

    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('tokens');
    expect(data).toHaveProperty('user');
  });

  test('user can logout @smoke', async ({ page }) => {
    // Use authenticated state
    await page.goto('/dashboard');
    
    // Verify we're logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    // Verify logout
    await expect(page).toHaveURL(/\/(auth\/login|home|\/)$/);
    await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible();
  });

  test('critical pages load without errors @smoke', async ({ page }) => {
    // Use authenticated state for protected pages
    const pages = [
      { url: '/', name: 'Home' },
      { url: '/auth/login', name: 'Login' },
      { url: '/auth/register', name: 'Register' },
      { url: '/dashboard', name: 'Dashboard', requiresAuth: true },
      { url: '/profile', name: 'Profile', requiresAuth: true },
      { url: '/settings', name: 'Settings', requiresAuth: true },
    ];

    for (const pageInfo of pages) {
      console.log(`Testing ${pageInfo.name} page...`);
      
      // Navigate to page
      await page.goto(pageInfo.url);
      
      // If auth is required and we're redirected to login, that's expected
      if (pageInfo.requiresAuth && page.url().includes('/auth/login')) {
        // Login first
        const testEmail = process.env.E2E_TEST_USER_EMAIL || 'test@example.com';
        const testPassword = process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!';
        
        await page.fill('[data-testid="email-input"]', testEmail);
        await page.fill('[data-testid="password-input"]', testPassword);
        await page.click('[data-testid="login-submit"]');
        
        // Navigate to the original page again
        await page.goto(pageInfo.url);
      }
      
      // Verify page loads without errors
      await expect(page.locator('body')).toBeVisible();
      
      // Check for error messages
      const errorElement = page.locator('[data-testid="error-message"]');
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        throw new Error(`Error on ${pageInfo.name} page: ${errorText}`);
      }
      
      // Check for 404 or other error pages
      const notFoundElement = page.locator('text=404');
      if (await notFoundElement.isVisible()) {
        throw new Error(`404 error on ${pageInfo.name} page`);
      }
    }
  });

  test('forms can be submitted without errors @smoke', async ({ page }) => {
    const testEmail = process.env.E2E_TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!';
    
    // Test login form
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', testPassword);
    await page.click('[data-testid="login-submit"]');
    
    // Should not show form errors
    const loginError = page.locator('[data-testid="login-error"]');
    if (await loginError.isVisible()) {
      const errorText = await loginError.textContent();
      throw new Error(`Login form error: ${errorText}`);
    }
    
    // Should redirect successfully
    await expect(page).toHaveURL(/\/(dashboard|home)/);
    
    // Test profile update form
    await page.goto('/profile');
    await expect(page.locator('[data-testid="profile-form"]')).toBeVisible();
    
    // Make a small change
    await page.fill('[data-testid="bio-input"]', 'Smoke test bio update');
    await page.click('[data-testid="save-profile"]');
    
    // Should show success or not show errors
    const profileError = page.locator('[data-testid="profile-error"]');
    if (await profileError.isVisible()) {
      const errorText = await profileError.textContent();
      throw new Error(`Profile form error: ${errorText}`);
    }
  });

  test('search functionality works @smoke', async ({ page }) => {
    // Login first
    const testEmail = process.env.E2E_TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!';
    
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', testPassword);
    await page.click('[data-testid="login-submit"]');
    
    await expect(page).toHaveURL(/\/(dashboard|home)/);
    
    // Test search if available
    const searchInput = page.locator('[data-testid="search-input"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.keyboard.press('Enter');
      
      // Should show search results or no results message
      const searchResults = page.locator('[data-testid="search-results"]');
      const noResults = page.locator('[data-testid="no-results"]');
      
      await expect(searchResults.or(noResults)).toBeVisible();
      
      // Should not show error
      const searchError = page.locator('[data-testid="search-error"]');
      if (await searchError.isVisible()) {
        const errorText = await searchError.textContent();
        throw new Error(`Search error: ${errorText}`);
      }
    }
  });

  test('mobile responsiveness works @smoke @mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Test mobile home page
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    
    // Test mobile login
    await page.goto('/auth/login');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    
    // Login on mobile
    const testEmail = process.env.E2E_TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!';
    
    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', testPassword);
    await page.click('[data-testid="login-submit"]');
    
    await expect(page).toHaveURL(/\/(dashboard|home)/);
    
    // Test mobile navigation
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    }
  });

  test('error handling works @smoke', async ({ page }) => {
    // Test 404 page
    await page.goto('/non-existent-page');
    
    // Should show 404 page or redirect to home
    const is404 = page.url().includes('404') || 
                  await page.locator('text=404').isVisible() ||
                  await page.locator('text=Not Found').isVisible();
    
    const isRedirected = page.url().includes('/') && !page.url().includes('non-existent-page');
    
    expect(is404 || isRedirected).toBeTruthy();
    
    // Test network error handling
    await page.route('**/api/health', route => {
      route.abort('failed');
    });
    
    await page.goto('/dashboard');
    
    // Should handle network errors gracefully
    // Either show error message or work offline
    const networkError = page.locator('[data-testid="network-error"]');
    const offlineMode = page.locator('[data-testid="offline-mode"]');
    const normalContent = page.locator('[data-testid="dashboard-content"]');
    
    // One of these should be visible
    await expect(networkError.or(offlineMode).or(normalContent)).toBeVisible();
  });

  test('performance is acceptable @smoke @performance', async ({ page }) => {
    // Measure page load time
    const startTime = Date.now();
    
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
    
    // Measure navigation time
    const navStartTime = Date.now();
    
    await page.click('[data-testid="nav-profile"]');
    await expect(page.locator('[data-testid="profile-form"]')).toBeVisible();
    
    const navTime = Date.now() - navStartTime;
    
    // Navigation should be fast
    expect(navTime).toBeLessThan(2000);
  });
});
