#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Environment validation script for Nexus Workspace
 */

const REQUIRED_VARS = {
  development: [
    'NODE_ENV',
    'DATABASE_URL',
    'MONGODB_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'SESSION_SECRET'
  ],
  staging: [
    'NODE_ENV',
    'DATABASE_URL',
    'MONGODB_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'SESSION_SECRET',
    'FRONTEND_URL',
    'BACKEND_URL'
  ],
  production: [
    'NODE_ENV',
    'DATABASE_URL',
    'MONGODB_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'SESSION_SECRET',
    'FRONTEND_URL',
    'BACKEND_URL',
    'SENTRY_DSN'
  ],
  test: [
    'NODE_ENV',
    'DATABASE_URL',
    'MONGODB_URL',
    'REDIS_URL',
    'JWT_SECRET'
  ]
};

const SENSITIVE_VARS = [
  'JWT_SECRET',
  'SESSION_SECRET',
  'COOKIE_SECRET',
  'DATABASE_URL',
  'MONGODB_URL',
  'REDIS_URL',
  'AWS_SECRET_ACCESS_KEY',
  'STRIPE_SECRET_KEY',
  'SENDGRID_API_KEY',
  'OPENAI_API_KEY'
];

function loadEnvFile(envFile) {
  try {
    const content = fs.readFileSync(envFile, 'utf8');
    const vars = {};
    
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          vars[key] = valueParts.join('=');
        }
      }
    });
    
    return vars;
  } catch (error) {
    return null;
  }
}

function validateEnvironment(env, vars) {
  const required = REQUIRED_VARS[env] || [];
  const missing = [];
  const weak = [];
  
  required.forEach(varName => {
    if (!vars[varName] || vars[varName].trim() === '') {
      missing.push(varName);
    }
  });
  
  // Check for weak secrets in non-test environments
  if (env !== 'test') {
    SENSITIVE_VARS.forEach(varName => {
      if (vars[varName]) {
        const value = vars[varName];
        if (value.includes('change-this') || 
            value.includes('your-') || 
            value.includes('dev-') ||
            value.length < 16) {
          weak.push(varName);
        }
      }
    });
  }
  
  return { missing, weak };
}

function generateTemplate(env) {
  const templatePath = path.join(__dirname, '..', `.env.${env}`);
  const outputPath = path.join(__dirname, '..', '.env');
  
  if (fs.existsSync(templatePath)) {
    fs.copyFileSync(templatePath, outputPath);
    console.log(`✅ Generated .env from .env.${env} template`);
    console.log('⚠️  Please update the placeholder values with your actual configuration');
  } else {
    console.error(`❌ Template file .env.${env} not found`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === '--template') {
    const env = args[1] || 'development';
    generateTemplate(env);
    return;
  }
  
  const environments = command === '--all' ? 
    ['development', 'staging', 'production', 'test'] : 
    [command || process.env.NODE_ENV || 'development'];
  
  let hasErrors = false;
  
  environments.forEach(env => {
    console.log(`\n🔍 Validating ${env} environment...`);
    
    const envFile = path.join(__dirname, '..', `.env.${env}`);
    const vars = loadEnvFile(envFile);
    
    if (!vars) {
      console.log(`⚠️  Environment file .env.${env} not found`);
      return;
    }
    
    const { missing, weak } = validateEnvironment(env, vars);
    
    if (missing.length > 0) {
      console.log(`❌ Missing required variables:`);
      missing.forEach(varName => {
        console.log(`   - ${varName}`);
      });
      hasErrors = true;
    }
    
    if (weak.length > 0) {
      console.log(`⚠️  Weak or placeholder values detected:`);
      weak.forEach(varName => {
        console.log(`   - ${varName}`);
      });
      hasErrors = true;
    }
    
    if (missing.length === 0 && weak.length === 0) {
      console.log(`✅ ${env} environment validation passed`);
    }
  });
  
  if (hasErrors) {
    console.log('\n❌ Environment validation failed');
    console.log('💡 Run with --template [env] to generate a template file');
    process.exit(1);
  } else {
    console.log('\n✅ All environment validations passed');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateEnvironment,
  loadEnvFile,
  generateTemplate
};
