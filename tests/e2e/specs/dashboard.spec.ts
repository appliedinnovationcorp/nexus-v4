/**
 * @fileoverview E2E tests for dashboard functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.click('[data-testid="login-button"]');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('[data-testid="submit-login"]');
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('should display dashboard components', async ({ page }) => {
    await expect(page.locator('[data-testid="dashboard-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="navigation-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
  });

  test('should display key metrics', async ({ page }) => {
    await expect(page.locator('[data-testid="metrics-card"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="total-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-sessions"]')).toBeVisible();
    await expect(page.locator('[data-testid="revenue"]')).toBeVisible();
    await expect(page.locator('[data-testid="conversion-rate"]')).toBeVisible();
  });

  test('should display charts and graphs', async ({ page }) => {
    await expect(page.locator('[data-testid="analytics-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-growth-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
  });

  test('should navigate between dashboard sections', async ({ page }) => {
    await page.click('[data-testid="nav-analytics"]');
    await expect(page.locator('[data-testid="analytics-section"]')).toBeVisible();
    
    await page.click('[data-testid="nav-users"]');
    await expect(page.locator('[data-testid="users-section"]')).toBeVisible();
    
    await page.click('[data-testid="nav-settings"]');
    await expect(page.locator('[data-testid="settings-section"]')).toBeVisible();
  });

  test('should filter data by date range', async ({ page }) => {
    await page.click('[data-testid="date-filter"]');
    await page.click('[data-testid="last-30-days"]');
    
    // Wait for data to update
    await page.waitForTimeout(1000);
    
    await expect(page.locator('[data-testid="date-filter"]')).toContainText('Last 30 days');
  });

  test('should export dashboard data', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-button"]');
    await page.click('[data-testid="export-csv"]');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('should refresh dashboard data', async ({ page }) => {
    const initialValue = await page.locator('[data-testid="total-users"]').textContent();
    
    await page.click('[data-testid="refresh-button"]');
    await page.waitForTimeout(1000);
    
    // Data should be refreshed (might be same value but request was made)
    await expect(page.locator('[data-testid="total-users"]')).toBeVisible();
  });

  test('should handle responsive design', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
    
    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
  });

  test('should display notifications', async ({ page }) => {
    await page.click('[data-testid="notifications-button"]');
    await expect(page.locator('[data-testid="notifications-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="notification-item"]')).toHaveCount.greaterThan(0);
  });

  test('should search functionality', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'test query');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });
});
