import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests
 * 
 * Tests that capture screenshots and compare them against baseline images
 * to detect visual changes in the application. These tests help catch
 * unintended UI changes and ensure visual consistency.
 */

test.describe('Visual Regression Tests', () => {
  // Use authenticated state for visual tests
  test.use({ storageState: 'playwright/.auth/user.json' });

  test.describe('Authentication Pages', () => {
    test('login page visual test @visual', async ({ page }) => {
      await page.goto('/auth/login');
      
      // Wait for page to fully load
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
      
      // Take screenshot of login page
      await expect(page).toHaveScreenshot('login-page.png');
    });

    test('registration page visual test @visual', async ({ page }) => {
      await page.goto('/auth/register');
      
      // Wait for page to fully load
      await expect(page.locator('[data-testid="register-form"]')).toBeVisible();
      
      // Take screenshot of registration page
      await expect(page).toHaveScreenshot('registration-page.png');
    });

    test('forgot password page visual test @visual', async ({ page }) => {
      await page.goto('/auth/forgot-password');
      
      // Wait for page to fully load
      await expect(page.locator('[data-testid="forgot-password-form"]')).toBeVisible();
      
      // Take screenshot of forgot password page
      await expect(page).toHaveScreenshot('forgot-password-page.png');
    });
  });

  test.describe('Dashboard and Main Pages', () => {
    test('dashboard visual test @visual @smoke', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Wait for dashboard to fully load
      await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
      
      // Hide dynamic elements that change frequently
      await page.addStyleTag({
        content: `
          [data-testid="current-time"],
          [data-testid="last-updated"],
          [data-testid="dynamic-chart"] {
            visibility: hidden !important;
          }
        `
      });
      
      // Take screenshot of dashboard
      await expect(page).toHaveScreenshot('dashboard-page.png');
    });

    test('profile page visual test @visual', async ({ page }) => {
      await page.goto('/profile');
      
      // Wait for profile page to load
      await expect(page.locator('[data-testid="profile-form"]')).toBeVisible();
      
      // Hide user-specific data that might change
      await page.addStyleTag({
        content: `
          [data-testid="user-avatar"],
          [data-testid="last-login"],
          [data-testid="member-since"] {
            visibility: hidden !important;
          }
        `
      });
      
      // Take screenshot of profile page
      await expect(page).toHaveScreenshot('profile-page.png');
    });

    test('settings page visual test @visual', async ({ page }) => {
      await page.goto('/settings');
      
      // Wait for settings page to load
      await expect(page.locator('[data-testid="settings-content"]')).toBeVisible();
      
      // Take screenshot of settings page
      await expect(page).toHaveScreenshot('settings-page.png');
    });
  });

  test.describe('Component Visual Tests', () => {
    test('navigation component visual test @visual', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Focus on navigation component
      const navigation = page.locator('[data-testid="main-navigation"]');
      await expect(navigation).toBeVisible();
      
      // Take screenshot of navigation component
      await expect(navigation).toHaveScreenshot('navigation-component.png');
    });

    test('user menu component visual test @visual', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Open user menu
      await page.click('[data-testid="user-menu"]');
      await expect(page.locator('[data-testid="user-dropdown"]')).toBeVisible();
      
      // Take screenshot of user menu dropdown
      await expect(page.locator('[data-testid="user-dropdown"]')).toHaveScreenshot('user-menu-dropdown.png');
    });

    test('form components visual test @visual', async ({ page }) => {
      await page.goto('/profile');
      
      // Focus on form elements
      const form = page.locator('[data-testid="profile-form"]');
      await expect(form).toBeVisible();
      
      // Take screenshot of form
      await expect(form).toHaveScreenshot('profile-form.png');
      
      // Test form validation states
      await page.fill('[data-testid="email-input"]', 'invalid-email');
      await page.click('[data-testid="save-profile"]');
      
      // Wait for validation error to appear
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
      
      // Take screenshot of form with validation errors
      await expect(form).toHaveScreenshot('profile-form-with-errors.png');
    });

    test('modal component visual test @visual', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Open modal if available
      const openModalButton = page.locator('[data-testid="open-modal"]');
      if (await openModalButton.isVisible()) {
        await openModalButton.click();
        
        // Wait for modal to appear
        await expect(page.locator('[data-testid="modal"]')).toBeVisible();
        
        // Take screenshot of modal
        await expect(page.locator('[data-testid="modal"]')).toHaveScreenshot('modal-component.png');
      }
    });

    test('data table component visual test @visual', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Focus on data table if available
      const dataTable = page.locator('[data-testid="data-table"]');
      if (await dataTable.isVisible()) {
        // Take screenshot of data table
        await expect(dataTable).toHaveScreenshot('data-table-component.png');
        
        // Test sorting state
        const sortButton = page.locator('[data-testid="sort-name"]');
        if (await sortButton.isVisible()) {
          await sortButton.click();
          await page.waitForTimeout(500); // Wait for sort animation
          
          // Take screenshot of sorted table
          await expect(dataTable).toHaveScreenshot('data-table-sorted.png');
        }
      }
    });
  });

  test.describe('Responsive Visual Tests', () => {
    test('mobile dashboard visual test @visual @mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/dashboard');
      await expect(page.locator('[data-testid="mobile-dashboard"]')).toBeVisible();
      
      // Take screenshot of mobile dashboard
      await expect(page).toHaveScreenshot('mobile-dashboard.png');
    });

    test('tablet dashboard visual test @visual @tablet', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      await page.goto('/dashboard');
      await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
      
      // Take screenshot of tablet dashboard
      await expect(page).toHaveScreenshot('tablet-dashboard.png');
    });

    test('mobile navigation visual test @visual @mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/dashboard');
      
      // Open mobile menu
      await page.click('[data-testid="mobile-menu-button"]');
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      
      // Take screenshot of mobile navigation
      await expect(page.locator('[data-testid="mobile-menu"]')).toHaveScreenshot('mobile-navigation.png');
    });
  });

  test.describe('Theme Visual Tests', () => {
    test('dark theme visual test @visual', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Switch to dark theme if available
      const themeToggle = page.locator('[data-testid="theme-toggle"]');
      if (await themeToggle.isVisible()) {
        await themeToggle.click();
        
        // Wait for theme transition
        await page.waitForTimeout(1000);
        
        // Verify dark theme is active
        await expect(page.locator('body')).toHaveClass(/dark/);
        
        // Take screenshot of dark theme dashboard
        await expect(page).toHaveScreenshot('dashboard-dark-theme.png');
        
        // Test profile page in dark theme
        await page.goto('/profile');
        await expect(page.locator('[data-testid="profile-form"]')).toBeVisible();
        await expect(page).toHaveScreenshot('profile-dark-theme.png');
      }
    });

    test('high contrast theme visual test @visual', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Enable high contrast mode if available
      const contrastToggle = page.locator('[data-testid="high-contrast-toggle"]');
      if (await contrastToggle.isVisible()) {
        await contrastToggle.click();
        
        // Wait for theme transition
        await page.waitForTimeout(1000);
        
        // Take screenshot of high contrast theme
        await expect(page).toHaveScreenshot('dashboard-high-contrast.png');
      }
    });
  });

  test.describe('State-based Visual Tests', () => {
    test('loading states visual test @visual', async ({ page }) => {
      // Intercept API calls to simulate loading states
      await page.route('**/api/**', route => {
        // Delay response to capture loading state
        setTimeout(() => route.continue(), 2000);
      });
      
      await page.goto('/dashboard');
      
      // Capture loading state
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
      await expect(page.locator('[data-testid="loading-spinner"]')).toHaveScreenshot('loading-state.png');
    });

    test('empty states visual test @visual', async ({ page }) => {
      // Mock empty data response
      await page.route('**/api/items**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], pagination: { total: 0 } }),
        });
      });
      
      await page.goto('/dashboard');
      
      // Wait for empty state to appear
      await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
      
      // Take screenshot of empty state
      await expect(page.locator('[data-testid="empty-state"]')).toHaveScreenshot('empty-state.png');
    });

    test('error states visual test @visual', async ({ page }) => {
      // Mock error response
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });
      
      await page.goto('/dashboard');
      
      // Wait for error state to appear
      await expect(page.locator('[data-testid="error-state"]')).toBeVisible();
      
      // Take screenshot of error state
      await expect(page.locator('[data-testid="error-state"]')).toHaveScreenshot('error-state.png');
    });
  });

  test.describe('Animation Visual Tests', () => {
    test('hover states visual test @visual', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Test button hover states
      const button = page.locator('[data-testid="primary-button"]').first();
      if (await button.isVisible()) {
        await button.hover();
        
        // Take screenshot of hover state
        await expect(button).toHaveScreenshot('button-hover-state.png');
      }
      
      // Test card hover states
      const card = page.locator('[data-testid="card"]').first();
      if (await card.isVisible()) {
        await card.hover();
        
        // Take screenshot of card hover state
        await expect(card).toHaveScreenshot('card-hover-state.png');
      }
    });

    test('focus states visual test @visual', async ({ page }) => {
      await page.goto('/profile');
      
      // Test input focus states
      const emailInput = page.locator('[data-testid="email-input"]');
      await emailInput.focus();
      
      // Take screenshot of focused input
      await expect(emailInput).toHaveScreenshot('input-focus-state.png');
      
      // Test button focus states
      const saveButton = page.locator('[data-testid="save-profile"]');
      await saveButton.focus();
      
      // Take screenshot of focused button
      await expect(saveButton).toHaveScreenshot('button-focus-state.png');
    });
  });

  test.describe('Cross-browser Visual Tests', () => {
    ['chromium', 'firefox', 'webkit'].forEach(browserName => {
      test(`dashboard visual consistency in ${browserName} @visual @cross-browser`, async ({ page, browserName: currentBrowser }) => {
        // Skip if not the target browser
        if (currentBrowser !== browserName) {
          test.skip();
        }
        
        await page.goto('/dashboard');
        await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
        
        // Take browser-specific screenshot
        await expect(page).toHaveScreenshot(`dashboard-${browserName}.png`);
      });
    });
  });
});
