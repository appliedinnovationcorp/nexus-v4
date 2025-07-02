#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * 
 * This script validates environment variables for both frontend and backend
 * applications. It can be used in CI/CD pipelines or for local development.
 * 
 * Usage:
 *   node scripts/validate-env.js [--backend] [--frontend] [--all]
 *   pnpm validate:env [--backend] [--frontend] [--all]
 */

const path = require('path');
const fs = require('fs');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(message, color = 'reset') {
  console.log(colorize(message, color));
}

function logError(message) {
  console.error(colorize(`❌ ${message}`, 'red'));
}

function logSuccess(message) {
  console.log(colorize(`✅ ${message}`, 'green'));
}

function logWarning(message) {
  console.warn(colorize(`⚠️  ${message}`, 'yellow'));
}

function logInfo(message) {
  console.log(colorize(`ℹ️  ${message}`, 'blue'));
}

async function validateBackendEnvironment() {
  log('\n🔍 Validating Backend Environment Variables...', 'cyan');
  
  const backendPath = path.join(__dirname, '..', 'services', 'backend');
  const envConfigPath = path.join(backendPath, 'src', 'config', 'env.config.ts');
  
  // Check if env config file exists
  if (!fs.existsSync(envConfigPath)) {
    logError('Backend environment configuration file not found');
    return false;
  }
  
  try {
    // Change to backend directory
    process.chdir(backendPath);
    
    // Load environment variables from .env file if it exists
    const envPath = path.join(backendPath, '.env');
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      logInfo('Loaded environment variables from .env file');
    } else {
      logWarning('No .env file found, using system environment variables');
    }
    
    // Import and run validation
    const { validateEnvironmentVariables } = require('./src/config/env.config.ts');
    const env = validateEnvironmentVariables();
    
    logSuccess('Backend environment variables validated successfully');
    
    // Log configuration summary
    log('\n📋 Backend Configuration Summary:', 'bright');
    log(`   Environment: ${env.NODE_ENV}`);
    log(`   Port: ${env.PORT}`);
    log(`   Database: ${env.DATABASE_URL ? '✓ Configured' : '✗ Not configured'}`);
    log(`   JWT: ${env.JWT_SECRET ? '✓ Configured' : '✗ Not configured'}`);
    log(`   Sentry: ${env.SENTRY_DSN ? '✓ Configured' : '✗ Not configured'}`);
    log(`   Redis: ${env.REDIS_URL ? '✓ Configured' : '✗ Not configured'}`);
    log(`   SMTP: ${env.SMTP_HOST ? '✓ Configured' : '✗ Not configured'}`);
    
    return true;
  } catch (error) {
    logError('Backend environment validation failed');
    console.error(error.message);
    return false;
  }
}

async function validateFrontendEnvironment() {
  log('\n🔍 Validating Frontend Environment Variables...', 'cyan');
  
  const frontendPath = path.join(__dirname, '..', 'apps', 'frontend');
  const envConfigPath = path.join(frontendPath, 'lib', 'env.ts');
  
  // Check if env config file exists
  if (!fs.existsSync(envConfigPath)) {
    logError('Frontend environment configuration file not found');
    return false;
  }
  
  try {
    // Change to frontend directory
    process.chdir(frontendPath);
    
    // Load environment variables from .env.local file if it exists
    const envPath = path.join(frontendPath, '.env.local');
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      logInfo('Loaded environment variables from .env.local file');
    } else {
      logWarning('No .env.local file found, using system environment variables');
    }
    
    // Import and run validation
    const { validateAllEnvironmentVariables } = require('./lib/env.ts');
    const env = validateAllEnvironmentVariables();
    
    logSuccess('Frontend environment variables validated successfully');
    
    // Log configuration summary
    log('\n📋 Frontend Configuration Summary:', 'bright');
    log(`   Environment: ${env.NODE_ENV}`);
    log(`   API URL: ${env.NEXT_PUBLIC_API_URL}`);
    log(`   App Name: ${env.NEXT_PUBLIC_APP_NAME}`);
    log(`   Sentry: ${env.NEXT_PUBLIC_SENTRY_DSN ? '✓ Configured' : '✗ Not configured'}`);
    log(`   Analytics: ${env.NEXT_PUBLIC_ENABLE_ANALYTICS ? '✓ Enabled' : '✗ Disabled'}`);
    log(`   Error Tracking: ${env.NEXT_PUBLIC_ENABLE_ERROR_TRACKING ? '✓ Enabled' : '✗ Disabled'}`);
    
    return true;
  } catch (error) {
    logError('Frontend environment validation failed');
    console.error(error.message);
    return false;
  }
}

async function checkEnvironmentFiles() {
  log('\n📁 Checking Environment Files...', 'cyan');
  
  const files = [
    { path: 'services/backend/.env', name: 'Backend .env', required: false },
    { path: 'services/backend/.env.example', name: 'Backend .env.example', required: true },
    { path: 'apps/frontend/.env.local', name: 'Frontend .env.local', required: false },
    { path: 'apps/frontend/.env.example', name: 'Frontend .env.example', required: true },
  ];
  
  let allGood = true;
  
  for (const file of files) {
    const fullPath = path.join(__dirname, '..', file.path);
    const exists = fs.existsSync(fullPath);
    
    if (exists) {
      logSuccess(`${file.name}: Found`);
    } else if (file.required) {
      logError(`${file.name}: Missing (required)`);
      allGood = false;
    } else {
      logWarning(`${file.name}: Missing (optional)`);
    }
  }
  
  return allGood;
}

async function generateEnvironmentTemplate() {
  log('\n📝 Generating Environment Template...', 'cyan');
  
  const backendEnvExample = path.join(__dirname, '..', 'services', 'backend', '.env.example');
  const frontendEnvExample = path.join(__dirname, '..', 'apps', 'frontend', '.env.example');
  
  if (fs.existsSync(backendEnvExample)) {
    logInfo('Backend .env.example already exists');
  } else {
    logWarning('Backend .env.example not found - should be created');
  }
  
  if (fs.existsSync(frontendEnvExample)) {
    logInfo('Frontend .env.example already exists');
  } else {
    logWarning('Frontend .env.example not found - should be created');
  }
  
  log('\n💡 To set up your environment:', 'bright');
  log('   1. Copy .env.example files to .env (backend) and .env.local (frontend)');
  log('   2. Fill in the required values');
  log('   3. Run this validation script again');
}

async function main() {
  const args = process.argv.slice(2);
  const shouldValidateBackend = args.includes('--backend') || args.includes('--all') || args.length === 0;
  const shouldValidateFrontend = args.includes('--frontend') || args.includes('--all') || args.length === 0;
  const shouldCheckFiles = args.includes('--check-files') || args.includes('--all');
  const shouldGenerateTemplate = args.includes('--template');
  
  log(colorize('🔧 Environment Variable Validation', 'bright'));
  log('='.repeat(50));
  
  let success = true;
  
  // Check environment files
  if (shouldCheckFiles) {
    const filesOk = await checkEnvironmentFiles();
    success = success && filesOk;
  }
  
  // Generate template if requested
  if (shouldGenerateTemplate) {
    await generateEnvironmentTemplate();
    return;
  }
  
  // Validate backend environment
  if (shouldValidateBackend) {
    const backendOk = await validateBackendEnvironment();
    success = success && backendOk;
  }
  
  // Validate frontend environment
  if (shouldValidateFrontend) {
    const frontendOk = await validateFrontendEnvironment();
    success = success && frontendOk;
  }
  
  // Final result
  log('\n' + '='.repeat(50));
  if (success) {
    logSuccess('All environment validations passed! 🎉');
    process.exit(0);
  } else {
    logError('Environment validation failed! Please fix the issues above.');
    log('\n💡 Need help? Check the documentation:', 'bright');
    log('   - docs/environment-validation-guide.md');
    log('   - services/backend/.env.example');
    log('   - apps/frontend/.env.example');
    process.exit(1);
  }
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  logError('Unexpected error occurred:');
  console.error(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled promise rejection:');
  console.error(reason);
  process.exit(1);
});

// Run the main function
main().catch((error) => {
  logError('Script execution failed:');
  console.error(error);
  process.exit(1);
});
