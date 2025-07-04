/**
 * @fileoverview Global teardown for E2E tests
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  
  // Launch browser for cleanup
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('Starting global teardown...');
    
    // Clean up test data
    await cleanupTestData(page, baseURL!);
    
    // Clean up test users
    await cleanupTestUsers(page, baseURL!);
    
    console.log('Global teardown completed successfully');
  } catch (error) {
    console.error('Global teardown failed:', error);
    // Don't throw error to avoid failing the test run
  } finally {
    await browser.close();
  }
}

async function cleanupTestData(page: any, baseURL: string) {
  try {
    await page.goto(`${baseURL}/api/test/cleanup-data`);
    await page.evaluate(() => {
      return fetch('/api/test/cleanup-data', {
        method: 'DELETE',
      });
    });
    console.log('Test data cleanup completed');
  } catch (error) {
    console.warn('Failed to cleanup test data:', error);
  }
}

async function cleanupTestUsers(page: any, baseURL: string) {
  try {
    await page.goto(`${baseURL}/api/test/cleanup-users`);
    await page.evaluate(() => {
      return fetch('/api/test/cleanup-users', {
        method: 'DELETE',
      });
    });
    console.log('Test users cleanup completed');
  } catch (error) {
    console.warn('Failed to cleanup test users:', error);
  }
}

export default globalTeardown;
