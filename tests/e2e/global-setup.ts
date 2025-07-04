/**
 * @fileoverview Global setup for E2E tests
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  
  // Launch browser for setup
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Wait for services to be ready
    console.log('Waiting for services to be ready...');
    await page.goto(baseURL!);
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Setup test data
    console.log('Setting up test data...');
    await setupTestData(page);
    
    // Create test users
    console.log('Creating test users...');
    await createTestUsers(page);
    
    console.log('Global setup completed successfully');
  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function setupTestData(page: any) {
  // Setup test database with initial data
  await page.evaluate(() => {
    // This would typically make API calls to setup test data
    console.log('Test data setup completed');
  });
}

async function createTestUsers(page: any) {
  // Create test users for authentication tests
  const testUsers = [
    {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      role: 'user'
    },
    {
      email: 'admin@example.com',
      password: 'admin123',
      name: 'Admin User',
      role: 'admin'
    }
  ];

  for (const user of testUsers) {
    try {
      await page.goto(`${page.url()}/api/test/create-user`);
      await page.evaluate((userData) => {
        return fetch('/api/test/create-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(userData),
        });
      }, user);
    } catch (error) {
      console.warn(`Failed to create test user ${user.email}:`, error);
    }
  }
}

export default globalSetup;
