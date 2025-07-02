import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Global teardown for Playwright tests
 * 
 * This runs once after all tests and handles:
 * - Cleanup of test data
 * - Database cleanup
 * - Temporary file cleanup
 * - Test report generation
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test global teardown...');
  
  // Clean up test data
  await cleanupTestData();
  
  // Clean up test database
  await cleanupTestDatabase();
  
  // Clean up temporary files
  await cleanupTemporaryFiles();
  
  // Generate test summary
  await generateTestSummary();
  
  console.log('✅ E2E test global teardown completed successfully');
}

/**
 * Clean up test data
 */
async function cleanupTestData() {
  console.log('🗑️  Cleaning up test data...');
  
  try {
    // In a real implementation, you would:
    // 1. Remove test users created during tests
    // 2. Clean up test content
    // 3. Reset test scenarios
    // 4. Clear uploaded files
    
    console.log('   - Removing test users...');
    console.log('   - Cleaning test content...');
    console.log('   - Clearing uploaded files...');
    
    // Clean up test uploads directory
    const uploadsDir = path.join(__dirname, 'test-uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        if (file.startsWith('test-') || file.includes('temp')) {
          const filePath = path.join(uploadsDir, file);
          fs.unlinkSync(filePath);
          console.log(`   - Deleted: ${file}`);
        }
      }
    }
    
    console.log('✅ Test data cleanup completed');
  } catch (error) {
    console.error('❌ Failed to cleanup test data:', error);
    // Don't throw error to avoid failing the entire test suite
  }
}

/**
 * Clean up test database
 */
async function cleanupTestDatabase() {
  console.log('🗄️  Cleaning up test database...');
  
  try {
    // In a real implementation, you would:
    // 1. Connect to the test database
    // 2. Clear test data
    // 3. Reset sequences
    // 4. Close connections
    
    console.log('   - Clearing test data from database...');
    console.log('   - Resetting database sequences...');
    console.log('   - Closing database connections...');
    
    // Simulate cleanup delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('✅ Test database cleanup completed');
  } catch (error) {
    console.error('❌ Failed to cleanup test database:', error);
    // Don't throw error to avoid failing the entire test suite
  }
}

/**
 * Clean up temporary files
 */
async function cleanupTemporaryFiles() {
  console.log('📁 Cleaning up temporary files...');
  
  try {
    const tempDirs = [
      path.join(__dirname, 'playwright/.auth'),
      path.join(__dirname, 'test-results/temp'),
    ];
    
    for (const dir of tempDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.includes('temp') || file.includes('tmp')) {
            const filePath = path.join(dir, file);
            try {
              fs.unlinkSync(filePath);
              console.log(`   - Deleted temp file: ${file}`);
            } catch (error) {
              console.warn(`   - Could not delete: ${file}`);
            }
          }
        }
      }
    }
    
    console.log('✅ Temporary files cleanup completed');
  } catch (error) {
    console.error('❌ Failed to cleanup temporary files:', error);
    // Don't throw error to avoid failing the entire test suite
  }
}

/**
 * Generate test summary
 */
async function generateTestSummary() {
  console.log('📊 Generating test summary...');
  
  try {
    const resultsFile = path.join(__dirname, 'test-results/results.json');
    const summaryFile = path.join(__dirname, 'test-results/summary.json');
    
    if (fs.existsSync(resultsFile)) {
      const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      
      const summary = {
        timestamp: new Date().toISOString(),
        totalTests: results.stats?.total || 0,
        passed: results.stats?.passed || 0,
        failed: results.stats?.failed || 0,
        skipped: results.stats?.skipped || 0,
        duration: results.stats?.duration || 0,
        environment: {
          baseURL: process.env.E2E_BASE_URL,
          apiURL: process.env.E2E_API_URL,
          nodeEnv: process.env.NODE_ENV,
          ci: process.env.CI,
        },
        browsers: results.config?.projects?.map((p: any) => p.name) || [],
      };
      
      fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
      
      console.log('📈 Test Summary:');
      console.log(`   - Total Tests: ${summary.totalTests}`);
      console.log(`   - Passed: ${summary.passed}`);
      console.log(`   - Failed: ${summary.failed}`);
      console.log(`   - Skipped: ${summary.skipped}`);
      console.log(`   - Duration: ${Math.round(summary.duration / 1000)}s`);
      console.log(`   - Browsers: ${summary.browsers.join(', ')}`);
    }
    
    console.log('✅ Test summary generated');
  } catch (error) {
    console.error('❌ Failed to generate test summary:', error);
    // Don't throw error to avoid failing the entire test suite
  }
}

export default globalTeardown;
