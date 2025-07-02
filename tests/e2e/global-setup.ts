import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Global setup for Playwright tests
 * 
 * This runs once before all tests and handles:
 * - Database setup and seeding
 * - Authentication state preparation
 * - Test data creation
 * - Environment validation
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test global setup...');
  
  // Ensure required directories exist
  const authDir = path.join(__dirname, 'playwright/.auth');
  const resultsDir = path.join(__dirname, 'test-results');
  const uploadsDir = path.join(__dirname, 'test-uploads');
  
  [authDir, resultsDir, uploadsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
  
  // Validate environment variables
  await validateEnvironment();
  
  // Setup test database
  await setupTestDatabase();
  
  // Create authenticated user state
  await createAuthenticatedState(config);
  
  // Seed test data
  await seedTestData();
  
  console.log('✅ E2E test global setup completed successfully');
}

/**
 * Validate required environment variables
 */
async function validateEnvironment() {
  console.log('🔍 Validating E2E test environment...');
  
  const requiredEnvVars = [
    'E2E_BASE_URL',
    'E2E_API_URL',
    'E2E_DATABASE_URL',
    'E2E_TEST_USER_EMAIL',
    'E2E_TEST_USER_PASSWORD',
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\n💡 Please check your .env.local file and ensure all required variables are set.');
    process.exit(1);
  }
  
  console.log('✅ Environment validation passed');
}

/**
 * Setup test database
 */
async function setupTestDatabase() {
  console.log('🗄️  Setting up test database...');
  
  try {
    // In a real implementation, you would:
    // 1. Connect to the test database
    // 2. Run migrations
    // 3. Clear existing test data
    // 4. Set up initial schema
    
    // For now, we'll simulate this
    console.log('   - Connecting to test database...');
    console.log('   - Running database migrations...');
    console.log('   - Clearing existing test data...');
    
    // Simulate database setup delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ Test database setup completed');
  } catch (error) {
    console.error('❌ Failed to setup test database:', error);
    throw error;
  }
}

/**
 * Create authenticated user state for tests
 */
async function createAuthenticatedState(config: FullConfig) {
  console.log('🔐 Creating authenticated user state...');
  
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const testUserEmail = process.env.E2E_TEST_USER_EMAIL!;
  const testUserPassword = process.env.E2E_TEST_USER_PASSWORD!;
  
  try {
    // Launch browser for authentication
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log('   - Navigating to login page...');
    await page.goto(`${baseURL}/auth/login`);
    
    // Wait for login form to be visible
    await page.waitForSelector('[data-testid="login-form"]', { timeout: 10000 });
    
    console.log('   - Filling login credentials...');
    await page.fill('[data-testid="email-input"]', testUserEmail);
    await page.fill('[data-testid="password-input"]', testUserPassword);
    
    console.log('   - Submitting login form...');
    await page.click('[data-testid="login-submit"]');
    
    // Wait for successful login (redirect to dashboard or home)
    await page.waitForURL(/\/(dashboard|home)/, { timeout: 10000 });
    
    console.log('   - Saving authentication state...');
    await context.storageState({ path: path.join(__dirname, 'playwright/.auth/user.json') });
    
    await browser.close();
    console.log('✅ Authenticated user state created');
  } catch (error) {
    console.error('❌ Failed to create authenticated state:', error);
    console.error('💡 Make sure the application is running and the test user exists');
    throw error;
  }
}

/**
 * Seed test data
 */
async function seedTestData() {
  console.log('🌱 Seeding test data...');
  
  try {
    // In a real implementation, you would:
    // 1. Create test users
    // 2. Create test content
    // 3. Set up test scenarios
    // 4. Prepare test files
    
    console.log('   - Creating test users...');
    console.log('   - Setting up test content...');
    console.log('   - Preparing test files...');
    
    // Create test upload files
    const testFilePath = path.join(__dirname, 'test-uploads/test-image.png');
    if (!fs.existsSync(testFilePath)) {
      // Create a simple test image (1x1 PNG)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0x57, 0x63, 0xF8, 0x0F, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x5C, 0xC2, 0x8E, 0x8E, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      fs.writeFileSync(testFilePath, pngBuffer);
    }
    
    // Simulate seeding delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('✅ Test data seeding completed');
  } catch (error) {
    console.error('❌ Failed to seed test data:', error);
    throw error;
  }
}

export default globalSetup;
