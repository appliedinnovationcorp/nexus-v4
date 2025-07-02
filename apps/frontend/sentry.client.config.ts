import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Environment and release info
  environment: process.env.NODE_ENV || 'development',
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || '1.0.0',
  
  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Session replay
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  // Integrations
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration({
      // Set up automatic route change tracking for Next.js App Router
      routingInstrumentation: Sentry.nextjsRouterInstrumentationWithDefaults({
        parameterize: false,
      }),
    }),
    Sentry.feedbackIntegration({
      // Additional configuration goes here
      colorScheme: 'system',
    }),
  ],
  
  // Error filtering
  beforeSend: (event, hint) => {
    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_SENTRY_DEBUG) {
      return null;
    }
    
    // Filter out network errors that are not actionable
    if (event.exception?.values?.[0]?.type === 'ChunkLoadError') {
      return null;
    }
    
    // Filter out ResizeObserver errors (common browser quirk)
    if (event.message?.includes('ResizeObserver loop limit exceeded')) {
      return null;
    }
    
    // Filter out non-actionable script errors
    if (event.message?.includes('Script error')) {
      return null;
    }
    
    // Sanitize sensitive data
    if (event.request?.data) {
      event.request.data = sanitizeData(event.request.data);
    }
    
    if (event.extra) {
      event.extra = sanitizeData(event.extra);
    }
    
    return event;
  },
  
  // Breadcrumb filtering
  beforeBreadcrumb: (breadcrumb) => {
    // Filter out noisy console logs
    if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
      return null;
    }
    
    // Filter out navigation breadcrumbs to non-actionable routes
    if (breadcrumb.category === 'navigation' && breadcrumb.data?.to?.includes('/_next/')) {
      return null;
    }
    
    // Sanitize breadcrumb data
    if (breadcrumb.data) {
      breadcrumb.data = sanitizeData(breadcrumb.data);
    }
    
    return breadcrumb;
  },
  
  // Initial scope
  initialScope: {
    tags: {
      service: 'nexus-frontend',
      platform: 'web',
    },
  },
  
  // Debug mode
  debug: process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_SENTRY_DEBUG === 'true',
  
  // Capture unhandled promise rejections
  captureUnhandledRejections: true,
  
  // Maximum breadcrumbs
  maxBreadcrumbs: 50,
  
  // Attach stack trace to messages
  attachStacktrace: true,
  
  // Send default PII (disabled for privacy)
  sendDefaultPii: false,
  
  // Auto session tracking
  autoSessionTracking: true,
});

function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'cookie',
    'session',
    'csrf',
    'api_key',
    'apiKey',
    'access_token',
    'refresh_token',
    'private_key',
    'credit_card',
    'ssn',
    'social_security',
    'email',
    'phone',
    'address',
  ];

  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  const sanitizeRecursive = (obj: any): any => {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const lowerKey = key.toLowerCase();
        
        // Check if key contains sensitive information
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          obj[key] = sanitizeRecursive(obj[key]);
        }
      }
    }

    return obj;
  };

  return sanitizeRecursive(sanitized);
}
