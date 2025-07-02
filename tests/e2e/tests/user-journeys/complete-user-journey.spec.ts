import { test, expect } from '@playwright/test';

/**
 * Complete User Journey Tests
 * 
 * End-to-end tests that simulate complete user workflows from registration
 * to performing various actions in the application. These tests represent
 * real user scenarios and critical business flows.
 */

test.describe('Complete User Journeys', () => {
  test('new user registration to first action @smoke @regression', async ({ page }) => {
    const timestamp = Date.now();
    const newUser = {
      firstName: 'Journey',
      lastName: 'User',
      email: `journey.user.${timestamp}@example.com`,
      password: 'JourneyPassword123!',
    };

    console.log(`🚀 Starting complete user journey for: ${newUser.email}`);

    // Step 1: Navigate to registration page
    await page.goto('/auth/register');
    await expect(page.locator('[data-testid="register-form"]')).toBeVisible();

    // Step 2: Complete registration
    await page.fill('[data-testid="first-name-input"]', newUser.firstName);
    await page.fill('[data-testid="last-name-input"]', newUser.lastName);
    await page.fill('[data-testid="email-input"]', newUser.email);
    await page.fill('[data-testid="password-input"]', newUser.password);
    await page.fill('[data-testid="confirm-password-input"]', newUser.password);

    // Accept terms if required
    const termsCheckbox = page.locator('[data-testid="terms-checkbox"]');
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check();
    }

    await page.click('[data-testid="register-submit"]');

    // Step 3: Handle post-registration flow
    // Could redirect to email verification, dashboard, or onboarding
    await page.waitForURL(/\/(dashboard|home|auth\/verify-email|onboarding)/, { timeout: 10000 });

    // If email verification is required
    if (page.url().includes('verify-email')) {
      await expect(page.locator('[data-testid="verification-message"]')).toBeVisible();
      // In a real test, you might check email and click verification link
      // For now, we'll simulate email verification by navigating directly
      await page.goto('/dashboard');
    }

    // If onboarding flow exists
    if (page.url().includes('onboarding')) {
      await expect(page.locator('[data-testid="onboarding-welcome"]')).toBeVisible();
      
      // Complete onboarding steps
      const nextButton = page.locator('[data-testid="onboarding-next"]');
      while (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(1000); // Wait for transitions
      }
      
      // Finish onboarding
      const finishButton = page.locator('[data-testid="onboarding-finish"]');
      if (await finishButton.isVisible()) {
        await finishButton.click();
      }
    }

    // Step 4: Verify successful login and dashboard access
    await expect(page).toHaveURL(/\/(dashboard|home)/);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-name"]')).toContainText(newUser.firstName);

    // Step 5: Complete profile setup
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="profile-link"]');
    
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.locator('[data-testid="profile-form"]')).toBeVisible();

    // Update profile information
    const bioText = 'This is my test bio for the E2E journey test.';
    await page.fill('[data-testid="bio-input"]', bioText);
    
    // Upload profile picture if supported
    const fileInput = page.locator('[data-testid="avatar-upload"]');
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles('./test-uploads/test-image.png');
      await expect(page.locator('[data-testid="avatar-preview"]')).toBeVisible();
    }

    // Save profile changes
    await page.click('[data-testid="save-profile"]');
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();

    // Step 6: Perform a key application action
    // This could be creating content, making a purchase, etc.
    await page.goto('/dashboard');
    
    // Example: Create a new item/post/project
    const createButton = page.locator('[data-testid="create-new"]');
    if (await createButton.isVisible()) {
      await createButton.click();
      
      // Fill out creation form
      await page.fill('[data-testid="title-input"]', 'My First Test Item');
      await page.fill('[data-testid="description-input"]', 'This is a test item created during E2E testing.');
      
      // Submit creation
      await page.click('[data-testid="create-submit"]');
      
      // Verify creation success
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="item-list"]')).toContainText('My First Test Item');
    }

    // Step 7: Test navigation and core features
    // Navigate through main sections
    const mainNavItems = [
      { selector: '[data-testid="nav-dashboard"]', url: /\/dashboard/ },
      { selector: '[data-testid="nav-profile"]', url: /\/profile/ },
      { selector: '[data-testid="nav-settings"]', url: /\/settings/ },
    ];

    for (const navItem of mainNavItems) {
      const navElement = page.locator(navItem.selector);
      if (await navElement.isVisible()) {
        await navElement.click();
        await expect(page).toHaveURL(navItem.url);
        
        // Verify page loads correctly
        await expect(page.locator('[data-testid="page-content"]')).toBeVisible();
      }
    }

    // Step 8: Test search functionality if available
    const searchInput = page.locator('[data-testid="search-input"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.keyboard.press('Enter');
      
      // Wait for search results
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    }

    // Step 9: Test settings and preferences
    await page.goto('/settings');
    
    // Update notification preferences
    const notificationToggle = page.locator('[data-testid="email-notifications"]');
    if (await notificationToggle.isVisible()) {
      await notificationToggle.click();
      await page.click('[data-testid="save-settings"]');
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    }

    // Step 10: Verify data persistence
    // Refresh page and verify user data is still there
    await page.reload();
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-name"]')).toContainText(newUser.firstName);

    // Go back to profile and verify bio is saved
    await page.goto('/profile');
    await expect(page.locator('[data-testid="bio-input"]')).toHaveValue(bioText);

    console.log(`✅ Complete user journey completed successfully for: ${newUser.email}`);
  });

  test('returning user login to advanced action @regression', async ({ page }) => {
    const testEmail = process.env.E2E_TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!';

    console.log(`🔄 Starting returning user journey for: ${testEmail}`);

    // Step 1: Login as existing user
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', testPassword);
    await page.click('[data-testid="login-submit"]');

    await expect(page).toHaveURL(/\/(dashboard|home)/);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

    // Step 2: Perform advanced actions
    // Example: Bulk operations, advanced search, data export, etc.
    
    // Advanced search with filters
    const advancedSearchButton = page.locator('[data-testid="advanced-search"]');
    if (await advancedSearchButton.isVisible()) {
      await advancedSearchButton.click();
      
      // Apply multiple filters
      await page.selectOption('[data-testid="category-filter"]', 'test-category');
      await page.fill('[data-testid="date-from"]', '2024-01-01');
      await page.fill('[data-testid="date-to"]', '2024-12-31');
      
      await page.click('[data-testid="apply-filters"]');
      await expect(page.locator('[data-testid="filtered-results"]')).toBeVisible();
    }

    // Bulk operations if available
    const selectAllCheckbox = page.locator('[data-testid="select-all"]');
    if (await selectAllCheckbox.isVisible()) {
      await selectAllCheckbox.check();
      
      const bulkActionButton = page.locator('[data-testid="bulk-actions"]');
      if (await bulkActionButton.isVisible()) {
        await bulkActionButton.click();
        
        // Perform bulk action (e.g., export, delete, update)
        const exportButton = page.locator('[data-testid="bulk-export"]');
        if (await exportButton.isVisible()) {
          await exportButton.click();
          
          // Wait for download or success message
          await expect(page.locator('[data-testid="export-success"]')).toBeVisible();
        }
      }
    }

    // Step 3: Test collaborative features
    const shareButton = page.locator('[data-testid="share-button"]');
    if (await shareButton.isVisible()) {
      await shareButton.click();
      
      // Share with specific user or generate share link
      await page.fill('[data-testid="share-email"]', 'colleague@example.com');
      await page.selectOption('[data-testid="permission-level"]', 'view');
      await page.click('[data-testid="send-invitation"]');
      
      await expect(page.locator('[data-testid="share-success"]')).toBeVisible();
    }

    // Step 4: Test data management
    // Import/export functionality
    const importButton = page.locator('[data-testid="import-data"]');
    if (await importButton.isVisible()) {
      await importButton.click();
      
      // Upload test data file
      await page.setInputFiles('[data-testid="file-upload"]', './test-uploads/test-data.csv');
      await page.click('[data-testid="process-import"]');
      
      // Wait for import to complete
      await expect(page.locator('[data-testid="import-complete"]')).toBeVisible();
    }

    // Step 5: Test integration features
    // API key management
    const apiKeysSection = page.locator('[data-testid="api-keys"]');
    if (await apiKeysSection.isVisible()) {
      await page.goto('/settings/api');
      
      // Generate new API key
      await page.click('[data-testid="generate-api-key"]');
      await page.fill('[data-testid="api-key-name"]', 'E2E Test Key');
      await page.click('[data-testid="create-api-key"]');
      
      // Verify API key is created
      await expect(page.locator('[data-testid="api-key-list"]')).toContainText('E2E Test Key');
      
      // Test API key functionality
      const apiKey = await page.locator('[data-testid="api-key-value"]').textContent();
      expect(apiKey).toBeTruthy();
    }

    console.log(`✅ Returning user advanced journey completed successfully`);
  });

  test('mobile user journey @mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    const testEmail = process.env.E2E_TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!';

    console.log(`📱 Starting mobile user journey`);

    // Step 1: Mobile login
    await page.goto('/auth/login');
    
    // Check mobile-specific elements
    await expect(page.locator('[data-testid="mobile-login-form"]')).toBeVisible();
    
    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', testPassword);
    await page.click('[data-testid="login-submit"]');

    await expect(page).toHaveURL(/\/(dashboard|home)/);

    // Step 2: Test mobile navigation
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
    await expect(mobileMenuButton).toBeVisible();
    
    await mobileMenuButton.click();
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

    // Navigate through mobile menu
    await page.click('[data-testid="mobile-nav-profile"]');
    await expect(page).toHaveURL(/\/profile/);

    // Step 3: Test mobile-specific features
    // Touch gestures, swipe actions, etc.
    const swipeableElement = page.locator('[data-testid="swipeable-list"]');
    if (await swipeableElement.isVisible()) {
      // Simulate swipe gesture
      await swipeableElement.hover();
      await page.mouse.down();
      await page.mouse.move(100, 0);
      await page.mouse.up();
      
      // Verify swipe action result
      await expect(page.locator('[data-testid="swipe-action"]')).toBeVisible();
    }

    // Step 4: Test mobile form interactions
    await page.goto('/profile');
    
    // Test mobile keyboard behavior
    await page.click('[data-testid="bio-input"]');
    await page.keyboard.type('Mobile test bio');
    
    // Test mobile file upload
    const mobileFileUpload = page.locator('[data-testid="mobile-file-upload"]');
    if (await mobileFileUpload.isVisible()) {
      await mobileFileUpload.setInputFiles('./test-uploads/test-image.png');
    }

    // Step 5: Test responsive behavior
    // Rotate to landscape
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(1000);
    
    // Verify layout adapts
    await expect(page.locator('[data-testid="landscape-layout"]')).toBeVisible();
    
    // Rotate back to portrait
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    console.log(`✅ Mobile user journey completed successfully`);
  });

  test('error recovery journey @regression', async ({ page }) => {
    const testEmail = process.env.E2E_TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!';

    console.log(`🔧 Starting error recovery journey`);

    // Step 1: Login
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', testPassword);
    await page.click('[data-testid="login-submit"]');
    await expect(page).toHaveURL(/\/(dashboard|home)/);

    // Step 2: Simulate network errors and recovery
    // Intercept API calls and simulate failures
    await page.route('**/api/**', route => {
      if (Math.random() < 0.3) { // 30% chance of failure
        route.abort('failed');
      } else {
        route.continue();
      }
    });

    // Step 3: Perform actions that might fail
    const actionsToTest = [
      { action: () => page.click('[data-testid="refresh-data"]'), name: 'refresh data' },
      { action: () => page.click('[data-testid="save-changes"]'), name: 'save changes' },
      { action: () => page.click('[data-testid="load-more"]'), name: 'load more' },
    ];

    for (const { action, name } of actionsToTest) {
      try {
        await action();
        
        // Check for error handling
        const errorMessage = page.locator('[data-testid="error-message"]');
        const retryButton = page.locator('[data-testid="retry-button"]');
        
        if (await errorMessage.isVisible()) {
          console.log(`Error occurred during ${name}, testing recovery...`);
          
          // Verify error message is user-friendly
          await expect(errorMessage).toContainText(/error|failed|try again/i);
          
          // Test retry functionality
          if (await retryButton.isVisible()) {
            await retryButton.click();
            
            // Should either succeed or show error again
            await page.waitForTimeout(2000);
          }
        }
      } catch (error) {
        console.log(`Expected error during ${name}: ${error.message}`);
      }
    }

    // Step 4: Test offline behavior
    await page.context().setOffline(true);
    
    // Try to perform actions while offline
    await page.click('[data-testid="create-new"]');
    
    // Should show offline message
    const offlineMessage = page.locator('[data-testid="offline-message"]');
    if (await offlineMessage.isVisible()) {
      await expect(offlineMessage).toContainText(/offline|connection/i);
    }

    // Go back online
    await page.context().setOffline(false);
    
    // Should recover automatically or show reconnection message
    await page.waitForTimeout(2000);
    const onlineMessage = page.locator('[data-testid="online-message"]');
    if (await onlineMessage.isVisible()) {
      await expect(onlineMessage).toContainText(/online|connected/i);
    }

    console.log(`✅ Error recovery journey completed successfully`);
  });
});
