# 🔧 Environment Variable Validation Guide

## ✅ Implementation Overview

A comprehensive environment variable validation system has been implemented using Zod to ensure applications refuse to start if required variables are missing or invalid. This provides type safety, clear error messages, and prevents runtime configuration issues.

## 🏗️ Architecture Components

### **Backend Validation (NestJS)**

#### **Zod Schema Definition**
```typescript
const envSchema = z.object({
  // Required variables with validation
  DATABASE_URL: z.string({
    required_error: 'DATABASE_URL is required. Please provide a valid PostgreSQL connection string.',
  }).url('DATABASE_URL must be a valid URL'),
  
  JWT_SECRET: z.string({
    required_error: 'JWT_SECRET is required. Please provide a secure JWT secret key.',
  }).min(32, 'JWT_SECRET must be at least 32 characters long'),
  
  // Optional variables with defaults and validation
  PORT: stringToNumber.default('3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});
```

#### **Validation Features**
- **Type Transformation**: Automatic string-to-number and string-to-boolean conversion
- **Cross-field Validation**: Dependencies between related configuration options
- **Environment-specific Rules**: Different validation rules for development vs production
- **Helpful Error Messages**: Clear, actionable error messages with examples

### **Frontend Validation (Next.js)**

#### **Client vs Server Environment Variables**
```typescript
// Client-side (exposed to browser)
const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url({
    required_error: 'NEXT_PUBLIC_API_URL is required. Please provide the backend API URL.',
  }),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

// Server-side (build-time only)
const serverEnvSchema = z.object({
  SENTRY_AUTH_TOKEN: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),
});
```

## 🚨 Validation Process

### **Application Startup Validation**

#### **Backend Startup**
```typescript
async function bootstrap(): Promise<void> {
  // Validate environment variables before creating the app
  console.log('🔍 Validating environment variables...');
  const env = validateEnvironmentVariables();
  console.log('✅ Environment variables validated successfully');

  // Continue with app creation...
  const app = await NestFactory.create(AppModule);
}
```

#### **Frontend Build-time Validation**
```typescript
// In next.config.js
try {
  console.log('🔍 Validating environment variables...');
  validateAllEnvironmentVariables();
  console.log('✅ Environment variables validated successfully');
} catch (error) {
  console.error('❌ Environment validation failed during build');
  process.exit(1);
}
```

### **Validation Error Handling**

#### **User-Friendly Error Messages**
```bash
❌ Environment variable validation failed:

  🔸 DATABASE_URL:
    - DATABASE_URL is required. Please provide a valid PostgreSQL connection string.

  🔸 JWT_SECRET:
    - JWT_SECRET is required. Please provide a secure JWT secret key.
    - JWT_SECRET must be at least 32 characters long

💡 Please check your environment variables and try again.

Helpful hints:
💡 DATABASE_URL example: postgresql://username:password@localhost:5432/database_name
💡 Generate secure JWT secrets: openssl rand -base64 64
```

## 🔧 Configuration Categories

### **Required Variables**

#### **Backend Required**
```typescript
// Database connection (required)
DATABASE_URL: z.string().url()

// JWT secrets (required)
JWT_SECRET: z.string().min(32)
JWT_REFRESH_SECRET: z.string().min(32)
```

#### **Frontend Required**
```typescript
// API endpoint (required)
NEXT_PUBLIC_API_URL: z.string().url()
```

### **Optional Variables with Defaults**

#### **Application Configuration**
```typescript
NODE_ENV: Environment.default('development')
PORT: stringToNumber.default('3000')
API_PREFIX: z.string().default('api')
LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info')
```

#### **Feature Flags**
```typescript
ENABLE_SWAGGER: stringToBoolean.default('true')
ENABLE_METRICS: stringToBoolean.default('true')
ENABLE_ERROR_TRACKING: stringToBoolean.default('true')
```

### **Conditional Variables**

#### **Cross-field Dependencies**
```typescript
// SMTP configuration validation
if (env.SMTP_HOST && (!env.SMTP_USER || !env.SMTP_PASS)) {
  errors.push('SMTP_USER and SMTP_PASS are required when SMTP_HOST is provided');
}

// AWS configuration validation
if (env.AWS_S3_BUCKET && (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY)) {
  errors.push('AWS credentials are required when S3 bucket is configured');
}
```

## 🛡️ Security Validations

### **Production Environment Checks**
```typescript
if (env.NODE_ENV === 'production') {
  if (env.JWT_SECRET.length < 64) {
    errors.push('JWT_SECRET should be at least 64 characters long in production');
  }
  
  if (!env.SENTRY_DSN && env.ENABLE_ERROR_TRACKING) {
    errors.push('SENTRY_DSN is recommended for production when error tracking is enabled');
  }
}
```

### **Format Validations**
```typescript
// JWT expiry format validation
JWT_ACCESS_EXPIRY: z.string().refine(
  (val) => /^\d+[smhd]$/.test(val),
  'JWT_ACCESS_EXPIRY must be in format like "15m", "1h", "7d"'
)

// Port range validation
SMTP_PORT: optionalStringToNumber.refine(
  (val) => !val || (val > 0 && val <= 65535),
  'SMTP_PORT must be between 1 and 65535'
)
```

## 📋 Environment File Examples

### **Backend Environment (.env)**
```bash
# Required Variables
DATABASE_URL=postgresql://username:password@localhost:5432/nexus_db
JWT_SECRET=your-super-secure-jwt-secret-key-at-least-32-characters-long
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key-at-least-32-characters-long

# Optional with Defaults
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Feature Flags
ENABLE_SWAGGER=true
ENABLE_ERROR_TRACKING=true

# Optional Services
SENTRY_DSN=https://your-dsn@sentry.io/project-id
REDIS_URL=redis://localhost:6379
```

### **Frontend Environment (.env.local)**
```bash
# Required Variables
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Optional Configuration
NEXT_PUBLIC_APP_NAME=Nexus Workspace
NEXT_PUBLIC_SENTRY_DSN=https://your-frontend-dsn@sentry.io/project-id

# Feature Flags
NEXT_PUBLIC_ENABLE_ERROR_TRACKING=true
NEXT_PUBLIC_ENABLE_ANALYTICS=false

# Server-side Only
NEXTAUTH_SECRET=your-nextauth-secret-at-least-64-characters-long
SENTRY_AUTH_TOKEN=your-auth-token
```

## 🔍 Validation Examples

### **Successful Validation**
```bash
🔍 Validating environment variables...
✅ Environment variables validated successfully
🚀 Application is starting...
```

### **Validation Failure**
```bash
🔍 Validating environment variables...
❌ Environment variable validation failed:

  🔸 DATABASE_URL:
    - DATABASE_URL is required. Please provide a valid PostgreSQL connection string.

  🔸 JWT_SECRET:
    - JWT_SECRET must be at least 32 characters long

💡 Please check your environment variables and try again.

Helpful hints:
💡 DATABASE_URL example: postgresql://username:password@localhost:5432/database_name
💡 Generate secure JWT secrets: openssl rand -base64 64

Process exited with code 1
```

## 🛠️ Development Workflow

### **Setting Up Environment**

#### **1. Copy Example Files**
```bash
# Backend
cp services/backend/.env.example services/backend/.env

# Frontend
cp apps/frontend/.env.example apps/frontend/.env.local
```

#### **2. Fill Required Variables**
```bash
# Generate JWT secrets
openssl rand -base64 64

# Set database URL
DATABASE_URL=postgresql://user:pass@localhost:5432/nexus_db

# Set API URL
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

#### **3. Start Applications**
```bash
# Backend - will validate on startup
cd services/backend
pnpm dev

# Frontend - will validate during build
cd apps/frontend
pnpm dev
```

### **Common Validation Errors**

#### **Missing Required Variables**
```bash
Error: DATABASE_URL is required
Solution: Add DATABASE_URL to your .env file
```

#### **Invalid Format**
```bash
Error: JWT_ACCESS_EXPIRY must be in format like "15m", "1h", "7d"
Solution: Change JWT_ACCESS_EXPIRY=invalid to JWT_ACCESS_EXPIRY=15m
```

#### **Cross-field Dependencies**
```bash
Error: SMTP_USER and SMTP_PASS are required when SMTP_HOST is provided
Solution: Either remove SMTP_HOST or add SMTP_USER and SMTP_PASS
```

## 🚀 Production Deployment

### **Environment Variable Checklist**

#### **Backend Production**
- ✅ `DATABASE_URL` - Production database connection
- ✅ `JWT_SECRET` - 64+ character secure secret
- ✅ `JWT_REFRESH_SECRET` - 64+ character secure secret
- ✅ `SENTRY_DSN` - Error tracking configuration
- ✅ `NODE_ENV=production` - Production environment flag

#### **Frontend Production**
- ✅ `NEXT_PUBLIC_API_URL` - Production API endpoint
- ✅ `NEXT_PUBLIC_SENTRY_DSN` - Frontend error tracking
- ✅ `NEXTAUTH_SECRET` - 64+ character secure secret
- ✅ `NODE_ENV=production` - Production environment flag

### **Docker Environment Variables**
```dockerfile
# Backend Dockerfile
ENV NODE_ENV=production
ENV DATABASE_URL=${DATABASE_URL}
ENV JWT_SECRET=${JWT_SECRET}
ENV JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# Frontend Dockerfile
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
```

### **Kubernetes ConfigMap/Secrets**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: nexus-backend-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:pass@db:5432/nexus"
  JWT_SECRET: "your-64-character-jwt-secret"
  JWT_REFRESH_SECRET: "your-64-character-refresh-secret"
  SENTRY_DSN: "https://your-dsn@sentry.io/project-id"
```

## 🔧 Advanced Features

### **Custom Transformers**
```typescript
// String to number with validation
const stringToNumber = z.string().transform((val) => {
  const num = parseInt(val, 10);
  if (isNaN(num)) {
    throw new Error(`Invalid number: ${val}`);
  }
  return num;
});

// String to boolean with multiple formats
const stringToBoolean = z.string().transform((val) => {
  const lower = val.toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') return true;
  if (lower === 'false' || lower === '0' || lower === 'no') return false;
  throw new Error(`Invalid boolean: ${val}`);
});
```

### **Environment-specific Validation**
```typescript
// Different rules for different environments
if (env.NODE_ENV === 'production') {
  // Stricter validation for production
  if (env.JWT_SECRET.length < 64) {
    errors.push('JWT_SECRET should be at least 64 characters in production');
  }
} else if (env.NODE_ENV === 'development') {
  // More lenient validation for development
  if (!env.DATABASE_URL.includes('localhost')) {
    console.warn('⚠️ Using non-localhost database in development');
  }
}
```

### **Runtime Environment Access**
```typescript
// Type-safe environment access
import { getEnv } from './config/env.config';

const env = getEnv();
// env is fully typed with IntelliSense support
const port = env.PORT; // number
const isDevelopment = env.NODE_ENV === 'development'; // boolean
const apiUrl = env.NEXT_PUBLIC_API_URL; // string
```

## 🎯 Benefits

### **Development Experience**
- **Early Error Detection**: Catch configuration issues before runtime
- **Type Safety**: Full TypeScript support with IntelliSense
- **Clear Error Messages**: Actionable error messages with examples
- **Documentation**: Self-documenting configuration through schemas

### **Production Reliability**
- **Fail Fast**: Applications refuse to start with invalid configuration
- **Security Validation**: Enforce security best practices
- **Dependency Checking**: Validate related configuration options
- **Environment Consistency**: Ensure consistent configuration across environments

### **Operational Excellence**
- **Reduced Debugging**: Eliminate runtime configuration errors
- **Deployment Safety**: Prevent deployments with invalid configuration
- **Monitoring Integration**: Validate monitoring and error tracking setup
- **Compliance**: Enforce security and compliance requirements

---

The environment variable validation system provides a robust foundation for configuration management, ensuring applications start reliably with valid configuration while providing clear feedback when issues are detected.
