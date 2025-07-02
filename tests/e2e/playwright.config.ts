import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

/**
 * Playwright Configuration for Nexus Workspace E2E Tests
 * 
 * This configuration supports multiple environments, browsers, and test types.
 * It includes setup for local development, CI/CD, and Docker environments.
 */
export default defineConfig({
  // Test directory
  testDir: './tests',
  
  // Global test timeout
  timeout: 30 * 1000, // 30 seconds
  
  // Expect timeout for assertions
  expect: {
    timeout: 10 * 1000, // 10 seconds
  },
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration
  reporter: [
    // Default list reporter for local development
    ['list'],
    // HTML reporter for detailed results
    ['html', { 
      outputFolder: 'playwright-report',
      open: process.env.CI ? 'never' : 'on-failure'
    }],
    // JUnit reporter for CI integration
    ['junit', { outputFile: 'test-results/junit.xml' }],
    // JSON reporter for programmatic access
    ['json', { outputFile: 'test-results/results.json' }],
    // GitHub Actions reporter when running in CI
    ...(process.env.CI ? [['github']] : []),
  ],
  
  // Global setup and teardown
  globalSetup: require.resolve('./global-setup.ts'),
  globalTeardown: require.resolve('./global-teardown.ts'),
  
  // Shared settings for all tests
  use: {
    // Base URL for the application
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    
    // API base URL for API tests
    extraHTTPHeaders: {
      'X-Test-Environment': process.env.NODE_ENV || 'test',
    },
    
    // Browser context options
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    
    // Screenshots and videos
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    
    // Timeouts
    actionTimeout: 10 * 1000, // 10 seconds
    navigationTimeout: 30 * 1000, // 30 seconds
  },
  
  // Test output directory
  outputDir: 'test-results/',
  
  // Projects for different browsers and scenarios
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'cleanup',
    },
    
    // Cleanup project
    {
      name: 'cleanup',
      testMatch: /.*\.teardown\.ts/,
    },
    
    // Desktop Chrome
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use authenticated state from setup
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    
    // Desktop Firefox
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    
    // Desktop Safari
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    
    // Mobile Chrome
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    
    // Mobile Safari
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    
    // API testing project
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
      use: {
        baseURL: process.env.E2E_API_URL || 'http://localhost:3001/api',
      },
    },
    
    // Smoke tests (critical path)
    {
      name: 'smoke',
      testMatch: /.*\.smoke\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    
    // Visual regression tests
    {
      name: 'visual',
      testMatch: /.*\.visual\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  
  // Web server configuration for local development
  webServer: process.env.CI ? undefined : [
    {
      command: 'cd ../../apps/frontend && pnpm dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000, // 2 minutes
      env: {
        NODE_ENV: 'test',
        NEXT_PUBLIC_API_URL: 'http://localhost:3001/api',
      },
    },
    {
      command: 'cd ../../services/backend && pnpm dev',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000, // 2 minutes
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: process.env.E2E_DATABASE_URL || 'postgresql://test:test@localhost:5432/nexus_test',
        JWT_SECRET: 'test-jwt-secret-for-e2e-testing-only-not-for-production-use',
        JWT_REFRESH_SECRET: 'test-refresh-secret-for-e2e-testing-only-not-for-production-use',
      },
    },
  ],
});
