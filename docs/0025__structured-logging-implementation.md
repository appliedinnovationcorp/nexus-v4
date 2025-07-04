# 📊 Structured Logging Implementation

## ✅ Implementation Overview

A comprehensive structured logging system has been implemented using Pino in the NestJS backend to ensure all log output is in JSON format for better observability, log aggregation, and monitoring.

## 🏗️ Architecture Components

### **Core Logging Infrastructure**

#### **1. Logger Module (`src/common/logger/logger.module.ts`)**
- **Pino Integration**: Configured with nestjs-pino for high-performance logging
- **Environment-Aware**: Different configurations for development vs production
- **Structured Output**: All logs in JSON format with consistent schema
- **Request Context**: Automatic request ID and correlation ID injection

#### **2. Logger Service (`src/common/logger/logger.service.ts`)**
- **Structured Interface**: Consistent logging methods with context support
- **Log Levels**: Debug, Info, Warn, Error, Fatal with appropriate usage
- **Specialized Methods**: Authentication, business events, security, performance
- **Context Propagation**: Request ID, user ID, correlation ID tracking

#### **3. Middleware Components**
- **Request Logger Middleware**: Automatic request/response logging
- **Correlation ID Middleware**: Distributed tracing support
- **Logging Interceptor**: Controller method execution logging
- **Exception Filter**: Structured error logging with security event detection

## 📋 Key Features Implemented

### **🔍 Structured Log Format**
```json
{
  "level": "info",
  "timestamp": "2024-07-02T09:00:00.000Z",
  "message": "User login attempt",
  "service": "nexus-backend",
  "version": "1.0.0",
  "environment": "production",
  "pid": 12345,
  "hostname": "api-server-01",
  "requestId": "req_abc123def456",
  "correlationId": "corr_xyz789uvw012",
  "userId": "user_123456789",
  "operation": "auth.login",
  "resource": "POST /api/auth/login",
  "metadata": {
    "email": "user@example.com",
    "ip": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "duration": 245
  }
}
```

### **🔐 Security & Privacy**
- **Sensitive Data Redaction**: Automatic redaction of passwords, tokens, secrets
- **Security Event Logging**: Specialized logging for security-related events
- **Attack Detection**: Automatic detection and logging of potential attacks
- **Audit Trail**: Complete audit trail for authentication and authorization

### **📊 Performance Monitoring**
- **Request Timing**: Automatic request duration tracking
- **Slow Query Detection**: Identification and logging of slow operations
- **Resource Usage**: Memory and CPU usage tracking
- **Database Performance**: Query execution time monitoring

### **🔄 Distributed Tracing**
- **Request ID**: Unique identifier for each request
- **Correlation ID**: Cross-service request tracking
- **Context Propagation**: Automatic context passing through call stack
- **Trace Aggregation**: Support for distributed tracing systems

## 🛠️ Implementation Details

### **Logger Configuration**

#### **Development Environment**
```typescript
{
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      singleLine: false,
      hideObject: false,
    },
  }
}
```

#### **Production Environment**
```typescript
{
  level: 'info',
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  base: {
    pid: process.pid,
    hostname: process.env.HOSTNAME,
    service: 'nexus-backend',
    version: '1.0.0',
    environment: 'production',
  }
}
```

### **Middleware Integration**

#### **Request Logger Middleware**
```typescript
// Automatic request logging
req.logger.info('Incoming request', {
  method: req.method,
  url: req.url,
  userAgent: req.headers['user-agent'],
  ip: req.ip,
  contentType: req.headers['content-type'],
});

// Response logging
req.logger.logApiRequest(req.method, req.path, statusCode, duration, {
  requestId,
  metadata: {
    responseSize: JSON.stringify(body).length,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  },
});
```

#### **Correlation ID Middleware**
```typescript
// Generate or extract correlation ID
const correlationId = 
  req.headers['x-correlation-id'] ||
  req.headers['x-trace-id'] ||
  uuidv4();

// Add to request and response headers
req.correlationId = correlationId;
res.setHeader('x-correlation-id', correlationId);
```

### **Service Integration**

#### **Authentication Service Example**
```typescript
// Login attempt logging
this.logger.info('User login attempt', {
  requestId: context?.requestId,
  operation: 'auth.login',
  metadata: { 
    email,
    ip: context?.ip,
    userAgent: context?.userAgent,
  },
});

// Security event logging
this.logger.logSecurity('login_failed_invalid_credentials', 'medium', {
  email,
  ip: context?.ip,
  userAgent: context?.userAgent,
}, {
  requestId: context?.requestId,
  operation: 'auth.login',
});

// Business event logging
this.logger.logBusinessEvent('user_registration_completed', {
  userId: user.id,
  email: user.email,
  username: user.username,
}, {
  requestId: context?.requestId,
  userId: user.id,
});
```

## 📊 Log Categories & Levels

### **Log Levels**
- **Fatal**: System crashes, critical errors requiring immediate attention
- **Error**: Application errors, exceptions, failed operations
- **Warn**: Warning conditions, deprecated usage, recoverable errors
- **Info**: General information, business events, successful operations
- **Debug**: Detailed debugging information, development diagnostics

### **Event Categories**

#### **1. Application Events**
```typescript
// Application lifecycle
logger.logStartup('Nexus Backend API started', { port, environment });
logger.logShutdown('Graceful shutdown initiated', { signal: 'SIGTERM' });
```

#### **2. Authentication Events**
```typescript
// User authentication
logger.logAuth('user_logged_in', userId, { email, role });
logger.logAuth('user_logged_out', userId, {});
logger.logAuth('token_refreshed', userId, { email });
```

#### **3. Security Events**
```typescript
// Security monitoring
logger.logSecurity('unauthorized_access_attempt', 'high', {
  path: '/admin',
  ip: '192.168.1.100',
  userAgent: 'curl/7.68.0'
});

logger.logSecurity('potential_attack_detected', 'critical', {
  attackType: 'sql_injection',
  payload: 'SELECT * FROM users',
  ip: '10.0.0.1'
});
```

#### **4. Business Events**
```typescript
// Business logic events
logger.logBusinessEvent('user_registration_completed', {
  userId: 'user_123',
  email: 'user@example.com',
  registrationSource: 'web'
});

logger.logBusinessEvent('payment_processed', {
  userId: 'user_123',
  amount: 99.99,
  currency: 'USD',
  paymentMethod: 'credit_card'
});
```

#### **5. Performance Events**
```typescript
// Performance monitoring
logger.logPerformance('database_query', 1250, {
  query: 'SELECT * FROM users WHERE email = ?',
  table: 'users',
  rows: 1
});

logger.logDatabase('SELECT', 'users', 245, { requestId });
```

## 🔧 Configuration Options

### **Environment Variables**
```bash
# Logging configuration
LOG_LEVEL=info
NODE_ENV=production

# Request logging
LOG_REQUESTS=true
LOG_RESPONSES=true
LOG_REQUEST_BODY=false
LOG_RESPONSE_BODY=false

# Security logging
LOG_SECURITY_EVENTS=true
LOG_FAILED_LOGINS=true
LOG_SUSPICIOUS_ACTIVITY=true
```

### **Logger Configuration**
```typescript
// Custom logger configuration
const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'password',
      'token',
      'secret',
      'apiKey',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    req: customRequestSerializer,
    res: customResponseSerializer,
    err: customErrorSerializer,
  },
};
```

## 📈 Monitoring & Observability

### **Log Aggregation**
```json
// Structured logs for easy aggregation
{
  "level": "error",
  "timestamp": "2024-07-02T09:00:00.000Z",
  "message": "Database connection failed",
  "service": "nexus-backend",
  "environment": "production",
  "error": {
    "name": "ConnectionError",
    "message": "Connection timeout",
    "stack": "Error: Connection timeout\n    at ...",
    "code": "ETIMEDOUT"
  },
  "operation": "database.connect",
  "duration": 5000,
  "retryAttempt": 3
}
```

### **Metrics Extraction**
```bash
# Extract performance metrics
cat logs.json | jq 'select(.event == "performance_metric") | .duration'

# Count error types
cat logs.json | jq 'select(.level == "error") | .error.name' | sort | uniq -c

# Monitor authentication events
cat logs.json | jq 'select(.event == "authentication") | .authEvent'
```

### **Alerting Queries**
```bash
# High error rate detection
cat logs.json | jq 'select(.level == "error" and .timestamp > "2024-07-02T08:00:00.000Z")'

# Security event monitoring
cat logs.json | jq 'select(.event == "security_event" and .severity == "critical")'

# Performance degradation
cat logs.json | jq 'select(.event == "performance_metric" and .duration > 1000)'
```

## 🔍 Log Analysis Examples

### **Request Tracing**
```bash
# Follow a specific request through the system
REQUEST_ID="req_abc123def456"
cat logs.json | jq "select(.requestId == \"$REQUEST_ID\")" | jq -s 'sort_by(.timestamp)'
```

### **User Activity Tracking**
```bash
# Track all activities for a specific user
USER_ID="user_123456789"
cat logs.json | jq "select(.userId == \"$USER_ID\")" | jq -s 'sort_by(.timestamp)'
```

### **Error Analysis**
```bash
# Analyze error patterns
cat logs.json | jq 'select(.level == "error") | {timestamp, operation, error: .error.name, message}' | jq -s 'group_by(.error) | map({error: .[0].error, count: length})'
```

### **Performance Analysis**
```bash
# Identify slow operations
cat logs.json | jq 'select(.duration and .duration > 1000) | {operation, duration, timestamp}' | jq -s 'sort_by(.duration) | reverse'
```

## 🚀 Integration with Monitoring Tools

### **ELK Stack Integration**
```yaml
# Logstash configuration
input {
  file {
    path => "/var/log/nexus-backend/*.log"
    codec => "json"
  }
}

filter {
  if [service] == "nexus-backend" {
    mutate {
      add_field => { "[@metadata][index]" => "nexus-backend-%{+YYYY.MM.dd}" }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "%{[@metadata][index]}"
  }
}
```

### **Prometheus Metrics**
```typescript
// Custom metrics from logs
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
});

// Extract metrics from structured logs
logger.logApiRequest(method, path, statusCode, duration, context);
httpRequestDuration.labels(method, path, statusCode).observe(duration / 1000);
```

### **Grafana Dashboards**
```json
{
  "dashboard": {
    "title": "Nexus Backend Logs",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(log_entries{level=\"error\"}[5m])",
            "legendFormat": "Error Rate"
          }
        ]
      }
    ]
  }
}
```

## 🔐 Security Considerations

### **Data Privacy**
- **PII Redaction**: Automatic redaction of personally identifiable information
- **Sensitive Field Filtering**: Configurable list of sensitive fields to redact
- **Log Retention**: Configurable log retention policies
- **Access Control**: Restricted access to log files and aggregation systems

### **Security Monitoring**
- **Failed Login Attempts**: Automatic detection and alerting
- **Suspicious Activity**: Pattern-based detection of potential attacks
- **Rate Limiting**: Integration with rate limiting for abuse detection
- **Audit Compliance**: Complete audit trail for compliance requirements

## 🎯 Best Practices Implemented

### **1. Consistent Structure**
- Standardized log format across all services
- Consistent field names and data types
- Hierarchical context organization
- Predictable log schema

### **2. Performance Optimization**
- Asynchronous logging to prevent blocking
- Efficient JSON serialization
- Log level filtering
- Minimal overhead in production

### **3. Operational Excellence**
- Graceful degradation when logging fails
- Health checks for logging infrastructure
- Log rotation and archival
- Monitoring of logging system itself

### **4. Developer Experience**
- Type-safe logging interfaces
- IDE autocomplete support
- Clear documentation and examples
- Easy local development setup

## 🔮 Future Enhancements

### **Planned Improvements**
- **OpenTelemetry Integration**: Full distributed tracing support
- **Log Sampling**: Intelligent log sampling for high-volume scenarios
- **Machine Learning**: Anomaly detection in log patterns
- **Real-time Alerting**: Advanced alerting based on log patterns

### **Advanced Features**
- **Log Enrichment**: Automatic enrichment with additional context
- **Custom Serializers**: Domain-specific log serialization
- **Log Forwarding**: Multi-destination log forwarding
- **Compliance Reporting**: Automated compliance report generation

---

The structured logging implementation provides a solid foundation for observability, monitoring, and debugging in the Nexus Workspace backend. All logs are now in JSON format with consistent structure, making them ideal for log aggregation systems, monitoring tools, and automated analysis.
