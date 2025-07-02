import { z } from 'zod';

// Client-side environment variables (exposed to browser)
const clientEnvSchema = z.object({
  // Next.js Configuration
  NEXT_PUBLIC_APP_NAME: z.string().default('Nexus Workspace'),
  NEXT_PUBLIC_APP_VERSION: z.string().default('1.0.0'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  
  // API Configuration
  NEXT_PUBLIC_API_URL: z.string().url({
    required_error: 'NEXT_PUBLIC_API_URL is required. Please provide the backend API URL.',
  }),
  
  // Sentry Configuration
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_RELEASE: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DEBUG: z.string().optional().transform((val) => {
    if (!val) return false;
    const lower = val.toLowerCase();
    return lower === 'true' || lower === '1';
  }),
  
  // Feature Flags
  NEXT_PUBLIC_ENABLE_ANALYTICS: z.string().optional().transform((val) => {
    if (!val) return false;
    const lower = val.toLowerCase();
    return lower === 'true' || lower === '1';
  }),
  
  NEXT_PUBLIC_ENABLE_ERROR_TRACKING: z.string().optional().transform((val) => {
    if (!val) return true; // Default to true
    const lower = val.toLowerCase();
    return lower === 'true' || lower === '1';
  }),
  
  // External Services
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
  
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Server-side environment variables (not exposed to browser)
const serverEnvSchema = z.object({
  // Build Configuration
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
  
  // Database (if needed for server-side operations)
  DATABASE_URL: z.string().url().optional(),
  
  // External API Keys (server-side only)
  STRIPE_SECRET_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  
  // OAuth Secrets
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  
  // Webhook Secrets
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  
  // Internal Configuration
  INTERNAL_API_SECRET: z.string().optional(),
  
  // Monitoring
  ENABLE_MONITORING: z.string().optional().transform((val) => {
    if (!val) return true;
    const lower = val.toLowerCase();
    return lower === 'true' || lower === '1';
  }),
});

// Combined schema for validation
const envSchema = clientEnvSchema.merge(serverEnvSchema);

// Infer types
export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type Env = z.infer<typeof envSchema>;

// Validation functions
export function validateClientEnvironmentVariables(): ClientEnv {
  try {
    // Filter environment variables to only include client-side ones
    const clientEnv = Object.keys(process.env)
      .filter(key => key.startsWith('NEXT_PUBLIC_') || key === 'NODE_ENV')
      .reduce((acc, key) => {
        acc[key] = process.env[key];
        return acc;
      }, {} as Record<string, string | undefined>);

    const validatedEnv = clientEnvSchema.parse(clientEnv);
    
    // Additional client-side validations
    validateClientDependencies(validatedEnv);
    
    return validatedEnv;
  } catch (error) {
    handleValidationError(error, 'Client');
  }
}

export function validateServerEnvironmentVariables(): ServerEnv {
  try {
    const validatedEnv = serverEnvSchema.parse(process.env);
    
    // Additional server-side validations
    validateServerDependencies(validatedEnv);
    
    return validatedEnv;
  } catch (error) {
    handleValidationError(error, 'Server');
  }
}

export function validateAllEnvironmentVariables(): Env {
  try {
    const validatedEnv = envSchema.parse(process.env);
    
    // Cross-validation between client and server
    validateCrossDependencies(validatedEnv);
    
    return validatedEnv;
  } catch (error) {
    handleValidationError(error, 'Full');
  }
}

// Client-side dependency validation
function validateClientDependencies(env: ClientEnv): void {
  const errors: string[] = [];
  
  // Stripe configuration
  if (env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && !env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith('pk_')) {
    errors.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with "pk_"');
  }
  
  // Analytics configuration
  if (env.NEXT_PUBLIC_ENABLE_ANALYTICS && !env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID) {
    errors.push('NEXT_PUBLIC_GOOGLE_ANALYTICS_ID is required when analytics is enabled');
  }
  
  // Sentry configuration
  if (env.NEXT_PUBLIC_SENTRY_DSN && !env.NEXT_PUBLIC_SENTRY_RELEASE && env.NODE_ENV === 'production') {
    errors.push('NEXT_PUBLIC_SENTRY_RELEASE is recommended for production');
  }
  
  if (errors.length > 0) {
    console.error('❌ Client-side validation errors:');
    console.error('');
    errors.forEach(error => {
      console.error(`  - ${error}`);
    });
    console.error('');
    process.exit(1);
  }
}

// Server-side dependency validation
function validateServerDependencies(env: ServerEnv): void {
  const errors: string[] = [];
  
  // NextAuth configuration
  if (env.NEXTAUTH_URL && !env.NEXTAUTH_SECRET) {
    errors.push('NEXTAUTH_SECRET is required when NEXTAUTH_URL is provided');
  }
  
  // OAuth configuration
  if (env.GOOGLE_CLIENT_SECRET && !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
    errors.push('NEXT_PUBLIC_GOOGLE_CLIENT_ID is required when GOOGLE_CLIENT_SECRET is provided');
  }
  
  if (env.GITHUB_CLIENT_SECRET && !process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID) {
    errors.push('NEXT_PUBLIC_GITHUB_CLIENT_ID is required when GITHUB_CLIENT_SECRET is provided');
  }
  
  // Stripe configuration
  if (env.STRIPE_SECRET_KEY && !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    errors.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required when STRIPE_SECRET_KEY is provided');
  }
  
  // Sentry configuration
  if (env.SENTRY_AUTH_TOKEN && (!env.SENTRY_ORG || !env.SENTRY_PROJECT)) {
    errors.push('SENTRY_ORG and SENTRY_PROJECT are required when SENTRY_AUTH_TOKEN is provided');
  }
  
  if (errors.length > 0) {
    console.error('❌ Server-side validation errors:');
    console.error('');
    errors.forEach(error => {
      console.error(`  - ${error}`);
    });
    console.error('');
    process.exit(1);
  }
}

// Cross-dependency validation
function validateCrossDependencies(env: Env): void {
  const errors: string[] = [];
  
  // Ensure API URL is accessible
  if (env.NEXT_PUBLIC_API_URL && typeof window === 'undefined') {
    // Server-side validation - could add network check here
    try {
      new URL(env.NEXT_PUBLIC_API_URL);
    } catch {
      errors.push('NEXT_PUBLIC_API_URL must be a valid URL');
    }
  }
  
  // Production-specific validations
  if (env.NODE_ENV === 'production') {
    if (!env.NEXT_PUBLIC_SENTRY_DSN && env.NEXT_PUBLIC_ENABLE_ERROR_TRACKING) {
      errors.push('NEXT_PUBLIC_SENTRY_DSN is recommended for production when error tracking is enabled');
    }
    
    if (env.NEXTAUTH_SECRET && env.NEXTAUTH_SECRET.length < 64) {
      errors.push('NEXTAUTH_SECRET should be at least 64 characters long in production');
    }
  }
  
  if (errors.length > 0) {
    console.error('❌ Cross-dependency validation errors:');
    console.error('');
    errors.forEach(error => {
      console.error(`  - ${error}`);
    });
    console.error('');
    process.exit(1);
  }
}

// Error handling
function handleValidationError(error: unknown, context: string): never {
  if (error instanceof z.ZodError) {
    console.error(`❌ ${context} environment variable validation failed:`);
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
    
    // Provide helpful hints
    provideHelpfulHints(errorsByField);
    
    process.exit(1);
  }
  
  console.error(`❌ Unexpected error during ${context.toLowerCase()} environment validation:`, error);
  process.exit(1);
}

// Helpful hints for common issues
function provideHelpfulHints(errorsByField: Record<string, string[]>): void {
  const hints: string[] = [];
  
  if (errorsByField.NEXT_PUBLIC_API_URL) {
    hints.push('💡 NEXT_PUBLIC_API_URL example: https://api.example.com or http://localhost:3001');
  }
  
  if (errorsByField.NEXT_PUBLIC_SENTRY_DSN) {
    hints.push('💡 Get your Sentry DSN from: https://sentry.io/settings/[org]/projects/[project]/keys/');
  }
  
  if (errorsByField.NEXTAUTH_SECRET) {
    hints.push('💡 Generate NextAuth secret: openssl rand -base64 64');
  }
  
  if (errorsByField.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    hints.push('💡 Stripe publishable key should start with "pk_test_" or "pk_live_"');
  }
  
  if (hints.length > 0) {
    console.error('Helpful hints:');
    hints.forEach(hint => console.error(hint));
    console.error('');
  }
}

// Utility function to get typed environment variables
export function getClientEnv(): ClientEnv {
  return validateClientEnvironmentVariables();
}

export function getServerEnv(): ServerEnv {
  return validateServerEnvironmentVariables();
}

export function getEnv(): Env {
  return validateAllEnvironmentVariables();
}

// Runtime environment validation for client-side
export function validateRuntimeEnv(): void {
  if (typeof window !== 'undefined') {
    // Client-side validation
    validateClientEnvironmentVariables();
  }
}
