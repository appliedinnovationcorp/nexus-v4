import { z } from 'zod';

// Environment enum for validation
const Environment = z.enum(['development', 'production', 'test', 'staging']);

// Custom transformers for common types
const stringToNumber = z.string().transform((val) => {
  const num = parseInt(val, 10);
  if (isNaN(num)) {
    throw new Error(`Invalid number: ${val}`);
  }
  return num;
});

const stringToBoolean = z.string().transform((val) => {
  const lower = val.toLowerCase();
  if (lower === 'true' || lower === '1') return true;
  if (lower === 'false' || lower === '0') return false;
  throw new Error(`Invalid boolean: ${val}`);
});

const optionalStringToNumber = z.string().optional().transform((val) => {
  if (!val) return undefined;
  const num = parseInt(val, 10);
  if (isNaN(num)) {
    throw new Error(`Invalid number: ${val}`);
  }
  return num;
});

const optionalStringToBoolean = z.string().optional().transform((val) => {
  if (!val) return undefined;
  const lower = val.toLowerCase();
  if (lower === 'true' || lower === '1') return true;
  if (lower === 'false' || lower === '0') return false;
  throw new Error(`Invalid boolean: ${val}`);
});

// Environment variable schema
const envSchema = z.object({
  // Application Configuration
  NODE_ENV: Environment.default('development'),
  PORT: stringToNumber.default('3000'),
  API_PREFIX: z.string().default('api'),
  
  // CORS Configuration
  CORS_ORIGIN: z.string().default('*'),
  
  // Database Configuration (Required)
  DATABASE_URL: z.string({
    required_error: 'DATABASE_URL is required. Please provide a valid PostgreSQL connection string.',
  }).url('DATABASE_URL must be a valid URL'),
  
  // JWT Configuration (Required)
  JWT_SECRET: z.string({
    required_error: 'JWT_SECRET is required. Please provide a secure JWT secret key.',
  }).min(32, 'JWT_SECRET must be at least 32 characters long'),
  
  JWT_REFRESH_SECRET: z.string({
    required_error: 'JWT_REFRESH_SECRET is required. Please provide a secure JWT refresh secret key.',
  }).min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long'),
  
  JWT_ACCESS_EXPIRY: z.string().default('15m').refine(
    (val) => /^\d+[smhd]$/.test(val),
    'JWT_ACCESS_EXPIRY must be in format like "15m", "1h", "7d"'
  ),
  
  JWT_REFRESH_EXPIRY: z.string().default('7d').refine(
    (val) => /^\d+[smhd]$/.test(val),
    'JWT_REFRESH_EXPIRY must be in format like "15m", "1h", "7d"'
  ),
  
  JWT_ISSUER: z.string().default('nexus-backend'),
  JWT_AUDIENCE: z.string().default('nexus-app'),
  
  // Bcrypt Configuration
  BCRYPT_SALT_ROUNDS: stringToNumber.default('12').refine(
    (val) => val >= 10 && val <= 15,
    'BCRYPT_SALT_ROUNDS must be between 10 and 15'
  ),
  
  // Email Configuration (Optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: optionalStringToNumber.refine(
    (val) => !val || (val > 0 && val <= 65535),
    'SMTP_PORT must be between 1 and 65535'
  ),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: optionalStringToBoolean,
  SMTP_FROM: z.string().email().optional(),
  
  // Redis Configuration (Optional)
  REDIS_URL: z.string().url().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: optionalStringToNumber.refine(
    (val) => !val || (val > 0 && val <= 65535),
    'REDIS_PORT must be between 1 and 65535'
  ),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: optionalStringToNumber.refine(
    (val) => !val || (val >= 0 && val <= 15),
    'REDIS_DB must be between 0 and 15'
  ),
  
  // File Upload Configuration
  MAX_FILE_SIZE: stringToNumber.default('10485760').refine(
    (val) => val > 0,
    'MAX_FILE_SIZE must be greater than 0'
  ),
  UPLOAD_DEST: z.string().default('./uploads'),
  
  // Rate Limiting Configuration
  RATE_LIMIT_TTL: stringToNumber.default('60000').refine(
    (val) => val > 0,
    'RATE_LIMIT_TTL must be greater than 0'
  ),
  RATE_LIMIT_MAX: stringToNumber.default('100').refine(
    (val) => val > 0,
    'RATE_LIMIT_MAX must be greater than 0'
  ),
  
  // Logging Configuration
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  
  // Sentry Configuration (Optional)
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_DEBUG: optionalStringToBoolean,
  
  // Application Metadata
  APP_NAME: z.string().default('Nexus Backend'),
  APP_VERSION: z.string().default('1.0.0'),
  APP_URL: z.string().url().optional(),
  
  // External Service URLs
  FRONTEND_URL: z.string().url().optional(),
  
  // Feature Flags
  ENABLE_SWAGGER: stringToBoolean.default('true'),
  ENABLE_METRICS: stringToBoolean.default('true'),
  ENABLE_HEALTH_CHECKS: stringToBoolean.default('true'),
  ENABLE_ERROR_TRACKING: stringToBoolean.default('true'),
  ENABLE_REQUEST_LOGGING: stringToBoolean.default('true'),
  
  // Security Configuration
  ENCRYPTION_KEY: z.string().min(32).optional(),
  WEBHOOK_SECRET: z.string().optional(),
  
  // Third-party API Keys (Optional)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional(),
  
  // AWS Configuration (Optional)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  
  // Monitoring Configuration
  PROMETHEUS_METRICS_PATH: z.string().default('/metrics'),
  
  // Development Configuration
  ENABLE_DEBUG: stringToBoolean.default('false'),
  ENABLE_PROFILING: stringToBoolean.default('false'),
  
  // Health Check Configuration
  HEALTH_CHECK_TIMEOUT: stringToNumber.default('5000').refine(
    (val) => val > 0,
    'HEALTH_CHECK_TIMEOUT must be greater than 0'
  ),
  
  // Session Configuration
  SESSION_SECRET: z.string().min(32).optional(),
  SESSION_MAX_AGE: stringToNumber.default('86400000'), // 24 hours
  
  // OAuth Configuration (Optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  
  // Webhook Configuration
  WEBHOOK_TIMEOUT: stringToNumber.default('30000').refine(
    (val) => val > 0,
    'WEBHOOK_TIMEOUT must be greater than 0'
  ),
  
  // Cache Configuration
  CACHE_TTL: stringToNumber.default('300').refine(
    (val) => val > 0,
    'CACHE_TTL must be greater than 0'
  ),
  
  // Queue Configuration (Optional)
  QUEUE_REDIS_URL: z.string().url().optional(),
  QUEUE_CONCURRENCY: optionalStringToNumber.refine(
    (val) => !val || val > 0,
    'QUEUE_CONCURRENCY must be greater than 0'
  ),
});

// Infer the type from the schema
export type EnvironmentVariables = z.infer<typeof envSchema>;

// Validation function
export function validateEnvironmentVariables(): EnvironmentVariables {
  try {
    // Parse and validate environment variables
    const validatedEnv = envSchema.parse(process.env);
    
    // Additional cross-field validations
    validateCrossFieldDependencies(validatedEnv);
    
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment variable validation failed:');
      console.error('');
      
      // Group errors by field for better readability
      const errorsByField = error.errors.reduce((acc, err) => {
        const field = err.path.join('.');
        if (!acc[field]) acc[field] = [];
        acc[field].push(err.message);
        return acc;
      }, {} as Record<string, string[]>);
      
      // Display errors in a user-friendly format
      Object.entries(errorsByField).forEach(([field, messages]) => {
        console.error(`  🔸 ${field}:`);
        messages.forEach(message => {
          console.error(`    - ${message}`);
        });
        console.error('');
      });
      
      console.error('💡 Please check your environment variables and try again.');
      console.error('');
      
      // Provide helpful hints for common issues
      provideHelpfulHints(errorsByField);
      
      process.exit(1);
    }
    
    console.error('❌ Unexpected error during environment validation:', error);
    process.exit(1);
  }
}

// Cross-field validation logic
function validateCrossFieldDependencies(env: EnvironmentVariables): void {
  const errors: string[] = [];
  
  // SMTP configuration validation
  if (env.SMTP_HOST && (!env.SMTP_USER || !env.SMTP_PASS)) {
    errors.push('SMTP_USER and SMTP_PASS are required when SMTP_HOST is provided');
  }
  
  // Redis configuration validation
  if (env.REDIS_HOST && !env.REDIS_PORT) {
    errors.push('REDIS_PORT is required when REDIS_HOST is provided');
  }
  
  // AWS configuration validation
  if (env.AWS_S3_BUCKET && (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_REGION)) {
    errors.push('AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION are required when AWS_S3_BUCKET is provided');
  }
  
  // Stripe configuration validation
  if (env.STRIPE_SECRET_KEY && !env.STRIPE_PUBLISHABLE_KEY) {
    errors.push('STRIPE_PUBLISHABLE_KEY is required when STRIPE_SECRET_KEY is provided');
  }
  
  // OAuth configuration validation
  if (env.GOOGLE_CLIENT_ID && !env.GOOGLE_CLIENT_SECRET) {
    errors.push('GOOGLE_CLIENT_SECRET is required when GOOGLE_CLIENT_ID is provided');
  }
  
  if (env.GITHUB_CLIENT_ID && !env.GITHUB_CLIENT_SECRET) {
    errors.push('GITHUB_CLIENT_SECRET is required when GITHUB_CLIENT_ID is provided');
  }
  
  // Sentry configuration validation
  if (env.SENTRY_AUTH_TOKEN && (!env.SENTRY_ORG || !env.SENTRY_PROJECT)) {
    errors.push('SENTRY_ORG and SENTRY_PROJECT are required when SENTRY_AUTH_TOKEN is provided');
  }
  
  // Production environment validations
  if (env.NODE_ENV === 'production') {
    if (!env.SENTRY_DSN && env.ENABLE_ERROR_TRACKING) {
      errors.push('SENTRY_DSN is recommended for production when error tracking is enabled');
    }
    
    if (env.JWT_SECRET.length < 64) {
      errors.push('JWT_SECRET should be at least 64 characters long in production');
    }
    
    if (env.JWT_REFRESH_SECRET.length < 64) {
      errors.push('JWT_REFRESH_SECRET should be at least 64 characters long in production');
    }
  }
  
  if (errors.length > 0) {
    console.error('❌ Cross-field validation errors:');
    console.error('');
    errors.forEach(error => {
      console.error(`  - ${error}`);
    });
    console.error('');
    process.exit(1);
  }
}

// Provide helpful hints for common configuration issues
function provideHelpfulHints(errorsByField: Record<string, string[]>): void {
  const hints: string[] = [];
  
  if (errorsByField.DATABASE_URL) {
    hints.push('💡 DATABASE_URL example: postgresql://username:password@localhost:5432/database_name');
  }
  
  if (errorsByField.JWT_SECRET || errorsByField.JWT_REFRESH_SECRET) {
    hints.push('💡 Generate secure JWT secrets: openssl rand -base64 64');
  }
  
  if (errorsByField.SENTRY_DSN) {
    hints.push('💡 Get your Sentry DSN from: https://sentry.io/settings/[org]/projects/[project]/keys/');
  }
  
  if (errorsByField.REDIS_URL) {
    hints.push('💡 REDIS_URL example: redis://username:password@localhost:6379');
  }
  
  if (errorsByField.SMTP_HOST) {
    hints.push('💡 SMTP configuration example: SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_SECURE=true');
  }
  
  if (hints.length > 0) {
    console.error('Helpful hints:');
    hints.forEach(hint => console.error(hint));
    console.error('');
  }
}

// Export the validation function as default
export const validate = validateEnvironmentVariables;
