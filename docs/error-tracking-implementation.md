# 🚨 Error Tracking Implementation with Sentry

## ✅ Implementation Overview

A comprehensive error tracking system has been implemented using Sentry for both frontend (Next.js) and backend (NestJS) applications, providing real-time error monitoring, performance tracking, and user feedback collection.

## 🏗️ Architecture Components

### **Backend Integration (NestJS)**

#### **1. Sentry Service (`src/common/sentry/sentry.service.ts`)**
- **Comprehensive Error Capture**: Exception handling with context and user information
- **Performance Monitoring**: Transaction tracking and performance profiling
- **Breadcrumb Management**: User action tracking and debugging trails
- **Data Sanitization**: Automatic removal of sensitive information
- **Context Management**: Request, user, and application context tracking

#### **2. Sentry Interceptor (`src/common/sentry/sentry.interceptor.ts`)**
- **Automatic Request Tracking**: HTTP request/response monitoring
- **Performance Transactions**: Automatic transaction creation for API calls
- **Error Context**: Rich error context with request details
- **Slow Request Detection**: Automatic detection and reporting of slow operations

#### **3. Sentry Exception Filter (`src/common/sentry/sentry.filter.ts`)**
- **Global Error Handling**: Catches all unhandled exceptions
- **Security Event Detection**: Identifies and reports potential attacks
- **Error Classification**: Intelligent error categorization and reporting
- **Integration with Structured Logging**: Seamless integration with existing logging

### **Frontend Integration (Next.js)**

#### **1. Sentry Configuration**
- **Client-side Config** (`sentry.client.config.ts`): Browser error tracking
- **Server-side Config** (`sentry.server.config.ts`): SSR error tracking  
- **Edge Runtime Config** (`sentry.edge.config.ts`): Edge function error tracking

#### **2. React Integration**
- **Error Boundaries**: Component-level error catching and reporting
- **Custom Hooks**: React hooks for easy Sentry integration
- **User Feedback**: Built-in feedback collection system
- **Performance Monitoring**: Core Web Vitals and custom metrics

#### **3. Next.js Integration**
- **Automatic Instrumentation**: Built-in Next.js route and API monitoring
- **Source Map Upload**: Automatic source map upload for better debugging
- **Release Management**: Automatic release creation and deployment tracking

## 📊 Key Features Implemented

### **🔍 Error Monitoring**

#### **Comprehensive Error Capture**
```typescript
// Backend error capture with context
sentryService.captureException(error, {
  requestId: 'req_123',
  operation: 'auth.login',
  userId: 'user_456',
  metadata: {
    email: 'user@example.com',
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0...'
  }
});

// Frontend error capture with React context
const { captureException } = useSentry(user);
captureException(error, {
  component: 'LoginForm',
  action: 'form_submission'
});
```

#### **Automatic Error Detection**
- **Unhandled Exceptions**: Automatic capture of uncaught errors
- **Promise Rejections**: Unhandled promise rejection tracking
- **HTTP Errors**: API error monitoring with status codes
- **Component Errors**: React component error boundaries

### **📈 Performance Monitoring**

#### **Backend Performance Tracking**
```typescript
// Automatic transaction creation
const transaction = sentryService.startTransaction(
  'UserController.login',
  'http.server',
  'POST /api/auth/login'
);

// Performance timing capture
sentryService.capturePerformance(
  'database_query',
  1250, // duration in ms
  { query: 'SELECT * FROM users', table: 'users' }
);
```

#### **Frontend Performance Monitoring**
- **Core Web Vitals**: LCP, FID, CLS automatic tracking
- **Custom Metrics**: Page load times, API response times
- **User Interactions**: Click, form submission, navigation timing
- **Resource Loading**: Asset loading performance

### **🔐 Security & Privacy**

#### **Data Sanitization**
```typescript
// Automatic sensitive data redaction
const sensitiveFields = [
  'password', 'token', 'secret', 'apiKey',
  'authorization', 'cookie', 'session'
];

// Applied to all error reports and breadcrumbs
event.request.data = sanitizeData(event.request.data);
```

#### **Privacy Controls**
- **PII Filtering**: Automatic removal of personally identifiable information
- **Configurable Redaction**: Customizable sensitive field lists
- **Environment-based Filtering**: Different rules for dev/staging/production
- **User Consent**: Optional user consent for error reporting

### **🍞 Breadcrumb Tracking**

#### **User Journey Tracking**
```typescript
// Backend breadcrumbs
sentryService.addBreadcrumb(
  'User login attempt',
  'auth',
  'info',
  { email: 'user@example.com', ip: '192.168.1.1' }
);

// Frontend breadcrumbs
addBreadcrumb(
  'Form validation failed',
  'ui',
  'warning',
  { formName: 'loginForm', errors: ['email', 'password'] }
);
```

#### **Automatic Breadcrumb Categories**
- **HTTP Requests**: API calls and responses
- **User Interactions**: Clicks, form submissions, navigation
- **Authentication**: Login, logout, token refresh events
- **Database Operations**: Query execution and performance
- **Security Events**: Failed logins, suspicious activity

## 🛠️ Configuration & Setup

### **Environment Variables**

#### **Backend Configuration**
```bash
# Sentry Configuration
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_RELEASE=1.0.0
SENTRY_ORG=your-org
SENTRY_PROJECT=nexus-backend
SENTRY_AUTH_TOKEN=your-auth-token
SENTRY_DEBUG=false

# Error Tracking
ENABLE_ERROR_TRACKING=true
LOG_LEVEL=info
```

#### **Frontend Configuration**
```bash
# Public Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
NEXT_PUBLIC_SENTRY_RELEASE=1.0.0
NEXT_PUBLIC_SENTRY_DEBUG=false

# Build-time Configuration
SENTRY_ORG=your-org
SENTRY_PROJECT=nexus-frontend
SENTRY_AUTH_TOKEN=your-auth-token
```

### **Sentry Project Setup**

#### **1. Create Sentry Projects**
```bash
# Create backend project
sentry-cli projects create nexus-backend

# Create frontend project  
sentry-cli projects create nexus-frontend
```

#### **2. Configure Source Maps**
```bash
# Backend source maps (automatic via webpack plugin)
# Frontend source maps (automatic via Next.js plugin)

# Manual source map upload
sentry-cli releases files VERSION upload-sourcemaps ./dist
```

#### **3. Set up Alerts**
```yaml
# Alert rules configuration
- name: "High Error Rate"
  conditions:
    - "event.count > 10 in 5m"
  actions:
    - "email: team@company.com"
    - "slack: #alerts"

- name: "Performance Degradation"  
  conditions:
    - "transaction.duration > 5s"
  actions:
    - "email: devops@company.com"
```

## 📱 Frontend Integration Examples

### **React Component Integration**
```tsx
import { useSentry } from '@/lib/hooks/use-sentry';
import { ErrorBoundary } from '@/components/error-boundary';

function LoginForm() {
  const { captureException, captureUserInteraction } = useSentry();

  const handleSubmit = async (data) => {
    try {
      captureUserInteraction('form_submit', 'LoginForm');
      await loginUser(data);
    } catch (error) {
      captureException(error, {
        component: 'LoginForm',
        action: 'login_attempt'
      });
    }
  };

  return (
    <ErrorBoundary>
      <form onSubmit={handleSubmit}>
        {/* Form content */}
      </form>
    </ErrorBoundary>
  );
}
```

### **API Integration**
```tsx
import { SentryClient } from '@/lib/sentry';

async function apiCall(url: string, options: RequestInit) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;
    
    SentryClient.captureApiCall(
      options.method || 'GET',
      url,
      response.status,
      duration
    );
    
    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    SentryClient.captureApiCall(
      options.method || 'GET',
      url,
      undefined,
      duration,
      error
    );
    
    throw error;
  }
}
```

## 🔧 Backend Integration Examples

### **Service Integration**
```typescript
import { SentryService } from '@/common/sentry/sentry.service';

@Injectable()
export class UserService {
  constructor(private readonly sentryService: SentryService) {}

  async createUser(userData: CreateUserDto) {
    try {
      // Add breadcrumb for user creation
      this.sentryService.addBreadcrumb(
        'Creating new user',
        'user',
        'info',
        { email: userData.email }
      );

      const user = await this.userRepository.create(userData);
      
      // Capture business event
      this.sentryService.captureMessage(
        'User created successfully',
        'info',
        { operation: 'user.create' },
        { id: user.id, email: user.email },
        { feature: 'user_management' }
      );

      return user;
    } catch (error) {
      // Capture error with context
      this.sentryService.captureException(
        error,
        { operation: 'user.create' },
        { email: userData.email },
        { feature: 'user_management', errorType: 'creation_failed' }
      );
      
      throw error;
    }
  }
}
```

### **Controller Integration**
```typescript
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly sentryService: SentryService
  ) {}

  @Post()
  async createUser(@Body() userData: CreateUserDto, @Req() req: any) {
    // Set user context for this request
    this.sentryService.setUser({
      ip_address: req.ip,
    });

    // Add request context
    this.sentryService.setContext('request', {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
    });

    return this.userService.createUser(userData);
  }
}
```

## 📊 Monitoring & Alerting

### **Real-time Alerts**

#### **Error Rate Alerts**
```yaml
# High error rate (>5% in 5 minutes)
- condition: "rate(errors) > 0.05"
  threshold: "5 minutes"
  notification: "immediate"
  channels: ["email", "slack", "pagerduty"]
```

#### **Performance Alerts**
```yaml
# Slow response time (>2s average in 10 minutes)
- condition: "avg(response_time) > 2000ms"
  threshold: "10 minutes"
  notification: "warning"
  channels: ["email", "slack"]
```

#### **Security Alerts**
```yaml
# Multiple failed login attempts
- condition: "count(failed_login) > 10"
  threshold: "1 minute"
  notification: "critical"
  channels: ["email", "slack", "pagerduty"]
```

### **Dashboard Metrics**

#### **Error Tracking Metrics**
- **Error Rate**: Percentage of requests resulting in errors
- **Error Volume**: Total number of errors over time
- **Error Types**: Distribution of error types and categories
- **Affected Users**: Number of users experiencing errors

#### **Performance Metrics**
- **Response Time**: API response time percentiles (p50, p95, p99)
- **Throughput**: Requests per second and minute
- **Apdex Score**: Application performance index
- **Core Web Vitals**: LCP, FID, CLS for frontend

#### **User Experience Metrics**
- **Session Duration**: Average user session length
- **Page Views**: Most visited pages and user flows
- **User Feedback**: Feedback reports and satisfaction scores
- **Feature Usage**: Most used features and user interactions

## 🔍 Debugging & Analysis

### **Error Analysis**

#### **Error Grouping**
```typescript
// Errors are automatically grouped by:
// - Error type and message
// - Stack trace fingerprint
// - Request URL and method
// - User agent and browser

// Custom fingerprinting
Sentry.configureScope(scope => {
  scope.setFingerprint(['custom-error', error.code, user.id]);
});
```

#### **Release Tracking**
```typescript
// Automatic release association
Sentry.init({
  release: process.env.SENTRY_RELEASE || '1.0.0',
  environment: process.env.NODE_ENV,
});

// Deploy tracking
sentry-cli releases deploys VERSION new -e production
```

### **Performance Analysis**

#### **Transaction Tracking**
```typescript
// Backend transaction
const transaction = Sentry.startTransaction({
  name: 'UserController.getProfile',
  op: 'http.server',
});

// Frontend transaction
const transaction = Sentry.startTransaction({
  name: 'ProfilePage',
  op: 'navigation',
});
```

#### **Custom Metrics**
```typescript
// Custom performance metrics
Sentry.metrics.increment('user.login.attempt');
Sentry.metrics.timing('database.query.duration', duration);
Sentry.metrics.gauge('active.users', activeUserCount);
```

## 🚀 Advanced Features

### **User Feedback Collection**

#### **Automatic Feedback Prompts**
```typescript
// Show feedback dialog on errors
Sentry.showReportDialog({
  title: 'Something went wrong',
  subtitle: 'Help us improve by reporting what happened',
  user: {
    name: user.name,
    email: user.email,
  },
});
```

#### **Custom Feedback Integration**
```typescript
// Custom feedback collection
const feedbackWidget = new Sentry.Feedback({
  colorScheme: 'system',
  showBranding: false,
  formTitle: 'Report a Problem',
  submitButtonLabel: 'Send Feedback',
});
```

### **Session Replay**

#### **Frontend Session Recording**
```typescript
// Automatic session replay on errors
Sentry.init({
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of error sessions
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
```

### **Performance Profiling**

#### **Backend Profiling**
```typescript
// Automatic profiling
Sentry.init({
  profilesSampleRate: 0.1, // 10% of transactions
  integrations: [
    nodeProfilingIntegration(),
  ],
});
```

#### **Frontend Profiling**
```typescript
// React component profiling
import { withProfiler } from '@sentry/react';

export default withProfiler(MyComponent);
```

## 🎯 Best Practices

### **Error Handling**
1. **Contextual Information**: Always include relevant context with errors
2. **User Impact**: Classify errors by user impact severity
3. **Actionable Alerts**: Only alert on errors that require action
4. **Error Budgets**: Set error rate budgets and SLOs

### **Performance Monitoring**
1. **Sampling Strategy**: Use appropriate sampling rates for different environments
2. **Custom Metrics**: Track business-specific performance metrics
3. **Baseline Establishment**: Establish performance baselines and thresholds
4. **Continuous Monitoring**: Monitor performance trends over time

### **Privacy & Security**
1. **Data Minimization**: Only collect necessary error information
2. **Sensitive Data**: Always sanitize sensitive information
3. **User Consent**: Respect user privacy preferences
4. **Compliance**: Ensure GDPR/CCPA compliance for error data

### **Team Workflow**
1. **Error Ownership**: Assign error ownership to specific teams
2. **Response Times**: Define SLAs for error response and resolution
3. **Escalation Procedures**: Clear escalation paths for critical errors
4. **Post-mortem Process**: Conduct post-mortems for significant incidents

## 🔮 Future Enhancements

### **Planned Improvements**
- **AI-Powered Error Analysis**: Machine learning for error pattern detection
- **Predictive Alerting**: Proactive alerts based on error trends
- **Custom Dashboards**: Team-specific error and performance dashboards
- **Integration Expansion**: Additional third-party service integrations

### **Advanced Monitoring**
- **Distributed Tracing**: Full request tracing across microservices
- **Real User Monitoring**: Enhanced RUM with custom metrics
- **Synthetic Monitoring**: Proactive uptime and performance monitoring
- **Chaos Engineering**: Automated resilience testing with error tracking

---

The error tracking implementation provides comprehensive visibility into application health, performance, and user experience across both frontend and backend systems. With real-time alerts, detailed error context, and powerful debugging tools, teams can quickly identify, diagnose, and resolve issues before they impact users.
