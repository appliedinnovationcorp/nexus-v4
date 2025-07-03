# @nexus/analytics - Product Analytics Integration

A comprehensive product analytics package integrating PostHog and Mixpanel to track user behaviors, understand feature value, and drive data-driven product decisions.

## 🎯 Overview

This package provides a complete analytics solution that enables teams to:

- Track user behaviors and feature usage across the application
- Understand which features provide the most value to users
- Analyze conversion funnels and user journeys
- Segment users and create cohorts for targeted analysis
- Generate automated insights and recommendations
- Maintain user privacy and comply with data regulations

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  React Hooks    │    │ Analytics       │    │   PostHog       │
│  & Components   │───▶│   Manager       │◀──▶│   Provider      │
└─────────────────┘    │   (Core)        │    └─────────────────┘
                       │                 │    ┌─────────────────┐
┌─────────────────┐    │                 │◀──▶│   Mixpanel      │
│  Event Types    │───▶│                 │    │   Provider      │
│  & Config       │    └─────────────────┘    └─────────────────┘
└─────────────────┘              │
                                 ▼
                       ┌─────────────────┐
                       │   Insights &    │
                       │   Reports       │
                       └─────────────────┘
```

## 🚀 Quick Start

### Installation

```bash
npm install @nexus/analytics
# or
yarn add @nexus/analytics
# or
pnpm add @nexus/analytics
```

### Basic Setup

```tsx
import { AnalyticsProvider } from '@nexus/analytics/react';

const analyticsConfig = {
  posthog: {
    apiKey: process.env.POSTHOG_API_KEY,
    host: 'https://app.posthog.com'
  },
  mixpanel: {
    token: process.env.MIXPANEL_TOKEN
  },
  global: {
    enabled: true,
    environment: 'production',
    debug: false,
    consent: {
      required: true,
      categories: ['analytics', 'performance']
    }
  },
  events: {
    // Event configuration
  }
};

function App() {
  return (
    <AnalyticsProvider 
      config={analyticsConfig}
      requireConsent={true}
      autoTrackPageViews={true}
      autoTrackErrors={true}
    >
      <YourApp />
    </AnalyticsProvider>
  );
}
```

### Using Analytics Hooks

```tsx
import { useAnalytics, useFeatureTracking } from '@nexus/analytics/react';

function FeatureComponent() {
  const { trackFeature, trackConversion } = useAnalytics();
  
  const featureTracker = useFeatureTracking({
    area: 'dashboard',
    name: 'widget_customization',
    trackOnMount: true,
    trackTimeSpent: true
  });

  const handleFeatureUse = () => {
    featureTracker.track({
      source: 'button',
      customization_type: 'layout'
    });
  };

  const handleCompletion = () => {
    featureTracker.trackCompletion(true, {
      widgets_configured: 3,
      time_spent: 120
    });
  };

  return (
    <div>
      <button onClick={handleFeatureUse}>
        Customize Dashboard
      </button>
      <button onClick={handleCompletion}>
        Save Configuration
      </button>
    </div>
  );
}
```

## 📊 Event Tracking

### Core Event Types

The package supports comprehensive event tracking across multiple categories:

#### User Events
```tsx
// User identification
analytics.identify('user_123', {
  role: 'developer',
  plan: 'pro',
  signupDate: new Date(),
  isNewUser: true
});

// User actions
analytics.track({
  event: 'user_signup',
  category: 'user',
  properties: {
    sessionId: 'session_456',
    userProfile: {
      role: 'developer',
      plan: 'free'
    }
  }
});
```

#### Feature Usage Events
```tsx
// Track feature usage
analytics.trackFeatureUsage('api_management', 'endpoint_creation', {
  source: 'dashboard',
  endpoint_type: 'REST',
  complexity: 'simple'
});

// Track feature completion
analytics.track({
  event: 'feature_completion',
  category: 'feature',
  properties: {
    sessionId: 'current-session',
    feature: {
      area: 'secret_management',
      name: 'secret_rotation'
    },
    success: true,
    completionTime: 45000
  }
});
```

#### Conversion Events
```tsx
// Track funnel progression
const onboardingFunnel = analytics.createFunnel('user_onboarding', [
  'signup_started',
  'email_verified', 
  'profile_completed',
  'first_login',
  'dashboard_viewed'
]);

onboardingFunnel.trackStep(2, { verification_method: 'email' });
onboardingFunnel.trackCompletion({ time_to_complete: 300 });
```

#### Error Tracking
```tsx
// Automatic error tracking
analytics.trackError('javascript', 'API request failed', {
  endpoint: '/api/secrets',
  statusCode: 500,
  severity: 'high',
  component: 'SecretManager'
});
```

### Specialized Tracking Hooks

#### Button Tracking
```tsx
import { useButtonTracking } from '@nexus/analytics/react';

function ActionButton() {
  const trackClick = useButtonTracking('save_configuration', 'settings');
  
  return (
    <button onClick={() => trackClick({ section: 'profile' })}>
      Save Settings
    </button>
  );
}
```

#### Form Tracking
```tsx
import { useFormTracking } from '@nexus/analytics/react';

function ContactForm() {
  const {
    trackFieldFocus,
    trackFieldBlur,
    trackValidationError,
    trackSubmit
  } = useFormTracking('contact_form', 'support');

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      trackSubmit(true);
    }}>
      <input
        onFocus={() => trackFieldFocus('email')}
        onBlur={(e) => trackFieldBlur('email', e.target.value)}
      />
    </form>
  );
}
```

#### Page Tracking
```tsx
import { usePageTracking } from '@nexus/analytics/react';

function DashboardPage() {
  const { trackAction, trackError } = usePageTracking('dashboard', 'dashboard');
  
  // Automatically tracks:
  // - Page mount/unmount
  // - Time spent on page
  // - Scroll depth milestones
  
  return <div>Dashboard Content</div>;
}
```

## 🎯 Feature Value Analysis

### Understanding Feature Usage

```tsx
// Track feature discovery
analytics.track({
  event: 'feature_discovered',
  category: 'feature',
  properties: {
    sessionId: 'current-session',
    feature: {
      area: 'design_system',
      name: 'component_library'
    },
    discoveryMethod: 'navigation_menu',
    userExperience: 'first_time'
  }
});

// Track feature adoption
analytics.track({
  event: 'feature_adopted',
  category: 'feature', 
  properties: {
    sessionId: 'current-session',
    feature: {
      area: 'monitoring',
      name: 'slo_dashboard'
    },
    adoptionStage: 'regular_user', // first_use, occasional_user, regular_user, power_user
    usageFrequency: 'daily',
    valueRealized: true
  }
});
```

### Value Metrics

```tsx
// Track business value events
analytics.track({
  event: 'business_value_realized',
  category: 'business',
  properties: {
    sessionId: 'current-session',
    business: {
      metric: 'time_saved',
      value: 30, // minutes
      unit: 'minutes'
    },
    feature: 'secret_management',
    context: 'automated_rotation'
  }
});
```

## 📈 User Segmentation & Cohorts

### Creating User Segments

```tsx
// Segment by user characteristics
const powerUserCohort = analytics.createCohort('power_users', {
  criteria: {
    sessionsPerWeek: { min: 5 },
    featuresUsed: { min: 10 },
    planType: ['pro', 'enterprise']
  }
});

// Track cohort-specific events
powerUserCohort.trackEvent('advanced_feature_used', {
  feature: 'api_rate_limiting',
  complexity: 'high'
});
```

### Behavioral Cohorts

```tsx
// Create cohorts based on behavior
const apiIntegratorCohort = analytics.createCohort('api_integrators', {
  criteria: {
    apiCallsPerDay: { min: 100 },
    hasApiKey: true,
    integrationType: ['REST', 'GraphQL']
  }
});

// Track cohort progression
apiIntegratorCohort.addUser('user_123', {
  integrationDate: new Date(),
  primaryUseCase: 'microservices'
});
```

## 🔄 Conversion Funnels

### Defining Funnels

```tsx
// User onboarding funnel
const onboardingFunnel = analytics.createFunnel('user_onboarding', [
  'signup_started',
  'email_verified',
  'profile_completed', 
  'first_login',
  'dashboard_viewed',
  'first_feature_used'
]);

// Feature adoption funnel
const featureAdoptionFunnel = analytics.createFunnel('feature_adoption', [
  'feature_discovered',
  'feature_clicked',
  'feature_configured',
  'feature_used_successfully',
  'feature_mastered'
]);
```

### Tracking Funnel Steps

```tsx
// Track progression through funnel
function SignupFlow() {
  useEffect(() => {
    onboardingFunnel.trackStep(0, { 
      source: 'landing_page',
      campaign: 'product_hunt' 
    });
  }, []);

  const handleEmailVerification = () => {
    onboardingFunnel.trackStep(1, {
      verification_method: 'email',
      time_to_verify: 120 // seconds
    });
  };

  return <SignupForm onVerify={handleEmailVerification} />;
}
```

## 🔍 Analytics Insights & Reports

### Automated Analysis

The package includes automated analysis tools that generate insights:

```bash
# Analyze feature usage patterns
pnpm analyze-usage features --days 30

# Analyze user behavior
pnpm analyze-usage users --days 30 --segment-by plan

# Analyze conversion funnels
pnpm analyze-usage funnels --days 30

# Run comprehensive analysis
pnpm analyze-usage all --days 30
```

### Generated Insights

The analysis generates actionable insights:

```json
{
  "insights": [
    {
      "type": "success",
      "title": "Top Performing Features",
      "description": "secret_management, api_management, dashboard are your most used features",
      "data": [
        { "name": "secret_management", "usage": 15420 },
        { "name": "api_management", "usage": 12350 },
        { "name": "dashboard", "usage": 11200 }
      ]
    },
    {
      "type": "warning", 
      "title": "Declining Feature Usage",
      "description": "2 features showing declining usage trends",
      "data": [
        { "name": "legacy_api", "change": -25 },
        { "name": "old_dashboard", "change": -15 }
      ]
    }
  ],
  "recommendations": [
    {
      "priority": "high",
      "category": "feature_optimization",
      "title": "Improve Underutilized Features",
      "actions": [
        "Conduct user research on underutilized features",
        "Improve feature discoverability in UI",
        "Add onboarding flows for complex features"
      ]
    }
  ]
}
```

## 🔒 Privacy & Compliance

### Consent Management

```tsx
import { useAnalytics } from '@nexus/analytics/react';

function ConsentBanner() {
  const { setConsent, consentGiven } = useAnalytics();

  const handleAccept = () => {
    setConsent(true, ['analytics', 'performance', 'functional']);
  };

  const handleDecline = () => {
    setConsent(false);
  };

  if (consentGiven) return null;

  return (
    <div className="consent-banner">
      <p>We use analytics to improve your experience.</p>
      <button onClick={handleAccept}>Accept</button>
      <button onClick={handleDecline}>Decline</button>
    </div>
  );
}
```

### Data Privacy

```yaml
# Configuration for privacy compliance
privacy:
  ipAddress: "anonymize"  # collect, anonymize, exclude
  geolocation: "city"     # precise, city, country, none
  cookies:
    enabled: true
    sameSite: "lax"
    secure: true

# PII scrubbing for sensitive events
events:
  secret_accessed:
    piiScrubbing:
      enabled: true
      fields: ["secret_name", "secret_value", "vault_path"]
```

## 🛠️ Configuration

### Environment Variables

```bash
# PostHog configuration
POSTHOG_API_KEY=your_posthog_api_key
POSTHOG_HOST=https://app.posthog.com

# Mixpanel configuration  
MIXPANEL_TOKEN=your_mixpanel_token

# Analytics settings
ANALYTICS_DEBUG=false
NODE_ENV=production
```

### YAML Configuration

```yaml
# packages/analytics/configs/analytics-config.yaml
version: "1.0"

posthog:
  apiKey: "${POSTHOG_API_KEY}"
  host: "${POSTHOG_HOST:-https://app.posthog.com}"
  options:
    capture_pageview: false
    session_recording:
      maskAllInputs: true
      blockClass: "ph-no-capture"

mixpanel:
  token: "${MIXPANEL_TOKEN}"
  options:
    track_pageview: false
    persistence: "localStorage"
    secure_cookie: true

global:
  enabled: true
  environment: "${NODE_ENV:-production}"
  consent:
    required: true
    categories: ["analytics", "performance", "functional"]

events:
  feature_used:
    enabled: true
    sampleRate: 1.0
    posthog: true
    mixpanel: true
  
  user_engagement:
    enabled: true
    sampleRate: 0.1  # Sample 10% of engagement events
    posthog: true
    mixpanel: false
```

## 🔄 CI/CD Integration

### Automated Analytics Monitoring

The package includes GitHub Actions workflows for:

- **Daily Analytics Reports**: Generated at 8 AM UTC
- **Weekly Insights**: Generated on Mondays at 9 AM UTC  
- **Monthly Deep Analysis**: Generated on 1st of month at 10 AM UTC
- **Critical Issue Detection**: Automatic GitHub issues for critical insights

```yaml
# .github/workflows/analytics-monitoring.yml
name: Analytics Monitoring & Insights
on:
  schedule:
    - cron: '0 8 * * *'  # Daily reports
    - cron: '0 9 * * 1'  # Weekly insights
    - cron: '0 10 1 * *' # Monthly analysis
```

### Integration with Existing Systems

The analytics system integrates seamlessly with our existing infrastructure:

**Secret Management**: Tracks secret access patterns while maintaining security through PII scrubbing.

**Design System**: Monitors component usage and Storybook interactions to understand design system adoption.

**SRE Monitoring**: Correlates user behavior with system performance and reliability metrics.

**Branch Protection**: Analytics configuration changes require appropriate team reviews through our governance system.

## 📊 Dashboard Integration

### PostHog Dashboards

- **Product Overview**: Key metrics, feature usage, user engagement
- **Feature Analytics**: Individual feature performance and adoption
- **User Journey Analysis**: Conversion funnels and user paths
- **Cohort Analysis**: User segmentation and retention metrics

### Mixpanel Reports

- **Revenue Analytics**: Conversion tracking and business metrics
- **Retention Analysis**: User lifecycle and churn prediction
- **A/B Test Results**: Experiment performance and statistical significance
- **Custom Events**: Business-specific tracking and KPIs

## 🧪 Testing

### Unit Tests

```bash
pnpm test
pnpm test:watch
pnpm test:coverage
```

### Integration Tests

```bash
# Test with real analytics providers
POSTHOG_API_KEY=test_key MIXPANEL_TOKEN=test_token pnpm test:integration
```

### Event Validation

```bash
# Validate event schemas and configuration
pnpm validate-events
```

## 📚 Best Practices

### Event Design

1. **Consistent Naming**: Use clear, descriptive event names
2. **Structured Properties**: Organize properties logically
3. **Avoid PII**: Never track sensitive user information
4. **Sampling**: Use appropriate sampling rates for high-volume events

### Performance

1. **Batch Events**: Group related events when possible
2. **Async Tracking**: Don't block user interactions
3. **Error Handling**: Gracefully handle analytics failures
4. **Caching**: Cache user properties and session data

### Privacy

1. **Consent First**: Always respect user consent preferences
2. **Data Minimization**: Only collect necessary data
3. **Anonymization**: Anonymize or pseudonymize when possible
4. **Retention Limits**: Implement data retention policies

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/new-event-type`
3. **Add comprehensive tests** for new functionality
4. **Update documentation** and examples
5. **Submit a pull request**

### Development Setup

```bash
# Clone repository
git clone https://github.com/nexus-team/nexus-workspace.git
cd nexus-workspace/packages/analytics

# Install dependencies
pnpm install

# Run tests
pnpm test

# Start development
pnpm dev
```

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Resources

- [PostHog Documentation](https://posthog.com/docs)
- [Mixpanel Documentation](https://developer.mixpanel.com/)
- [Product Analytics Best Practices](https://amplitude.com/blog/product-analytics-best-practices)
- [Privacy-First Analytics](https://plausible.io/privacy-focused-web-analytics)
- [GDPR Compliance Guide](https://gdpr.eu/compliance/)

---

Built with ❤️ by the Nexus Product Team

*"Data-driven decisions, user-centric design."*
