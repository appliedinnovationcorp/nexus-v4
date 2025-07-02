# 🚨 Sentry Setup Guide

## 📋 Prerequisites

Before setting up Sentry for the Nexus Workspace project, ensure you have:

1. **Sentry Account**: Sign up at [sentry.io](https://sentry.io)
2. **Sentry CLI**: Install the Sentry CLI tool
3. **Project Access**: Admin access to your Sentry organization
4. **Environment Variables**: Access to configure environment variables

## 🏗️ Sentry Account Setup

### **1. Create Sentry Organization**
```bash
# If you don't have an organization yet
1. Go to https://sentry.io
2. Sign up or log in
3. Create a new organization: "nexus-workspace"
4. Choose your plan (Developer plan is free for small teams)
```

### **2. Create Projects**
```bash
# Create backend project
1. Go to Settings > Projects
2. Click "Create Project"
3. Choose "Node.js" platform
4. Name: "nexus-backend"
5. Team: Default or create "Backend Team"

# Create frontend project
1. Click "Create Project" again
2. Choose "Next.js" platform  
3. Name: "nexus-frontend"
4. Team: Default or create "Frontend Team"
```

### **3. Get DSN URLs**
```bash
# Backend DSN
1. Go to nexus-backend project
2. Settings > Client Keys (DSN)
3. Copy the DSN URL
4. Format: https://[key]@[org].ingest.sentry.io/[project-id]

# Frontend DSN  
1. Go to nexus-frontend project
2. Settings > Client Keys (DSN)
3. Copy the DSN URL
```

## 🔧 Sentry CLI Installation

### **Install Sentry CLI**
```bash
# macOS (Homebrew)
brew install getsentry/tools/sentry-cli

# Linux/Windows (npm)
npm install -g @sentry/cli

# Or download binary from:
# https://github.com/getsentry/sentry-cli/releases
```

### **Configure Sentry CLI**
```bash
# Login to Sentry
sentry-cli login

# Or configure with auth token
sentry-cli --auth-token YOUR_AUTH_TOKEN

# Verify configuration
sentry-cli info
```

### **Create Auth Token**
```bash
1. Go to Sentry.io > Settings > Account > API > Auth Tokens
2. Click "Create New Token"
3. Scopes needed:
   - project:read
   - project:write
   - project:releases
   - org:read
4. Copy the token for environment variables
```

## 🌍 Environment Configuration

### **Backend Environment Variables**
Create or update `services/backend/.env`:

```bash
# Sentry Configuration
SENTRY_DSN=https://your-backend-dsn@sentry.io/project-id
SENTRY_RELEASE=1.0.0
SENTRY_ORG=nexus-workspace
SENTRY_PROJECT=nexus-backend
SENTRY_AUTH_TOKEN=your-auth-token-here
SENTRY_DEBUG=false

# Error Tracking
ENABLE_ERROR_TRACKING=true
LOG_LEVEL=info

# Environment
NODE_ENV=production
```

### **Frontend Environment Variables**
Create or update `apps/frontend/.env.local`:

```bash
# Public Sentry Configuration (exposed to browser)
NEXT_PUBLIC_SENTRY_DSN=https://your-frontend-dsn@sentry.io/project-id
NEXT_PUBLIC_SENTRY_RELEASE=1.0.0
NEXT_PUBLIC_SENTRY_DEBUG=false

# Build-time Configuration (server-side only)
SENTRY_DSN=https://your-frontend-dsn@sentry.io/project-id
SENTRY_ORG=nexus-workspace
SENTRY_PROJECT=nexus-frontend
SENTRY_AUTH_TOKEN=your-auth-token-here
SENTRY_RELEASE=1.0.0
```

### **Production Environment Variables**
For production deployment, set these in your hosting platform:

#### **Backend (Docker/Kubernetes)**
```yaml
# In your deployment configuration
env:
  - name: SENTRY_DSN
    value: "https://your-backend-dsn@sentry.io/project-id"
  - name: SENTRY_RELEASE
    value: "1.0.0"
  - name: SENTRY_ORG
    value: "nexus-workspace"
  - name: SENTRY_PROJECT
    value: "nexus-backend"
  - name: SENTRY_AUTH_TOKEN
    valueFrom:
      secretKeyRef:
        name: sentry-secrets
        key: auth-token
```

#### **Frontend (Vercel)**
```bash
# In Vercel dashboard or CLI
vercel env add NEXT_PUBLIC_SENTRY_DSN
vercel env add SENTRY_ORG
vercel env add SENTRY_PROJECT
vercel env add SENTRY_AUTH_TOKEN
```

## 🚀 Testing the Setup

### **1. Test Backend Integration**
```bash
# Start the backend
cd services/backend
pnpm dev

# Trigger a test error
curl -X POST http://localhost:3000/api/test-error

# Check Sentry dashboard for the error
```

### **2. Test Frontend Integration**
```bash
# Start the frontend
cd apps/frontend
pnpm dev

# Open browser to http://localhost:3000
# Open browser console and run:
throw new Error("Test Sentry integration");

# Check Sentry dashboard for the error
```

### **3. Verify Source Maps**
```bash
# Backend source maps (automatic)
# Check that stack traces show original TypeScript code

# Frontend source maps (automatic with Next.js)
# Check that React component names are visible in stack traces
```

## 📊 Dashboard Configuration

### **1. Set Up Alerts**
```bash
# Go to Alerts > Alert Rules
# Create new alert rule:

Name: High Error Rate - Backend
Conditions: 
  - event.count > 10 in 5 minutes
  - project: nexus-backend
Actions:
  - Email: team@company.com
  - Slack: #alerts

Name: Performance Degradation - Frontend  
Conditions:
  - avg(transaction.duration) > 2000ms in 10 minutes
  - project: nexus-frontend
Actions:
  - Email: frontend-team@company.com
```

### **2. Create Custom Dashboards**
```bash
# Go to Dashboards > Create Dashboard
# Add widgets:

1. Error Rate Over Time
   - Type: Line Chart
   - Query: rate(event.count) by project
   
2. Top Errors by Volume
   - Type: Table
   - Query: count() by error.type
   
3. Performance by Endpoint
   - Type: Bar Chart  
   - Query: avg(transaction.duration) by transaction
   
4. User Impact
   - Type: Number
   - Query: count_unique(user.id) where event.level=error
```

### **3. Configure Integrations**

#### **Slack Integration**
```bash
1. Go to Settings > Integrations
2. Find Slack and click "Install"
3. Authorize Sentry to access your Slack workspace
4. Configure channels:
   - #alerts: Critical errors and performance issues
   - #deployments: Release notifications
   - #general: Weekly summaries
```

#### **GitHub Integration**
```bash
1. Go to Settings > Integrations  
2. Find GitHub and click "Install"
3. Authorize Sentry to access your repositories
4. Configure:
   - Repository: nexus-workspace/nexus-v4
   - Auto-resolve issues on deploy: Enabled
   - Create GitHub issues for Sentry issues: Enabled
```

#### **Jira Integration** (Optional)
```bash
1. Go to Settings > Integrations
2. Find Jira and click "Install"  
3. Configure Jira connection
4. Set up automatic issue creation for critical errors
```

## 🔍 Release Management

### **1. Automatic Release Creation**
The setup includes automatic release creation on deployment:

```bash
# This happens automatically in CI/CD pipeline
sentry-cli releases new $RELEASE_VERSION
sentry-cli releases set-commits $RELEASE_VERSION --auto
sentry-cli releases finalize $RELEASE_VERSION
```

### **2. Manual Release Management**
```bash
# Create a new release
sentry-cli releases new 1.0.1

# Associate commits
sentry-cli releases set-commits 1.0.1 --auto

# Upload source maps (automatic in build process)
sentry-cli releases files 1.0.1 upload-sourcemaps ./dist

# Mark release as deployed
sentry-cli releases deploys 1.0.1 new -e production

# Finalize release
sentry-cli releases finalize 1.0.1
```

## 🔐 Security Configuration

### **1. IP Allowlisting** (Optional)
```bash
# Go to Settings > Security & Privacy
# Add your server IPs to allowlist
# This restricts which IPs can send events to Sentry
```

### **2. Data Scrubbing Rules**
```bash
# Go to Settings > Security & Privacy > Data Scrubbing
# Add custom rules to scrub sensitive data:

Rule 1: Remove credit card numbers
Pattern: \d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}
Replacement: [Filtered]

Rule 2: Remove email addresses  
Pattern: [a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}
Replacement: [Filtered]

Rule 3: Remove API keys
Pattern: (api[_-]?key|token)["\s]*[:=]["\s]*([a-zA-Z0-9]+)
Replacement: $1: [Filtered]
```

### **3. Rate Limiting**
```bash
# Go to Settings > Security & Privacy > Rate Limiting
# Configure rate limits to prevent abuse:

Per-key rate limit: 1000 events per minute
Per-IP rate limit: 100 events per minute
Burst allowance: 50 events
```

## 📈 Performance Optimization

### **1. Sampling Configuration**
```bash
# Adjust sampling rates based on traffic volume:

# Low traffic (< 1000 events/day)
tracesSampleRate: 1.0
replaysSessionSampleRate: 0.1

# Medium traffic (1000-10000 events/day)  
tracesSampleRate: 0.5
replaysSessionSampleRate: 0.05

# High traffic (> 10000 events/day)
tracesSampleRate: 0.1
replaysSessionSampleRate: 0.01
```

### **2. Event Filtering**
```bash
# Configure beforeSend filters to reduce noise:

// Filter out known non-actionable errors
beforeSend: (event) => {
  if (event.exception?.values?.[0]?.type === 'ChunkLoadError') {
    return null; // Don't send chunk load errors
  }
  return event;
}
```

## 🚨 Troubleshooting

### **Common Issues**

#### **1. DSN Not Working**
```bash
# Check DSN format
✅ Correct: https://key@org.ingest.sentry.io/project-id
❌ Wrong: https://key@sentry.io/project-id

# Verify project ID matches
# Check network connectivity to sentry.io
```

#### **2. Source Maps Not Uploading**
```bash
# Check auth token permissions
sentry-cli info

# Verify build process
npm run build
ls -la dist/ # Check if source maps exist

# Manual upload test
sentry-cli releases files VERSION upload-sourcemaps ./dist
```

#### **3. No Events Appearing**
```bash
# Check environment variables
echo $SENTRY_DSN

# Test with manual error
Sentry.captureException(new Error("Test error"));

# Check browser network tab for requests to sentry.io
# Check server logs for Sentry initialization messages
```

#### **4. Too Many Events**
```bash
# Implement rate limiting
beforeSend: (event) => {
  // Implement custom rate limiting logic
  return shouldSendEvent(event) ? event : null;
}

# Adjust sampling rates
tracesSampleRate: 0.1 // Reduce from 1.0
```

### **Debug Mode**
```bash
# Enable debug mode for troubleshooting
SENTRY_DEBUG=true
NEXT_PUBLIC_SENTRY_DEBUG=true

# Check console for Sentry debug messages
# Look for initialization and event sending logs
```

## 📞 Support Resources

### **Documentation**
- [Sentry Node.js Docs](https://docs.sentry.io/platforms/node/)
- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry CLI Docs](https://docs.sentry.io/cli/)

### **Community**
- [Sentry Discord](https://discord.gg/sentry)
- [GitHub Issues](https://github.com/getsentry/sentry)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/sentry)

### **Professional Support**
- Sentry Business/Enterprise plans include professional support
- Response times: 24h (Business), 4h (Enterprise)
- Dedicated customer success manager for Enterprise

---

This setup guide provides everything needed to get Sentry error tracking up and running for the Nexus Workspace project. Follow the steps in order, and you'll have comprehensive error monitoring and performance tracking across both frontend and backend applications.
