import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Environment and release info
  environment: process.env.NODE_ENV || 'development',
  release: process.env.SENTRY_RELEASE || '1.0.0',
  
  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Profiling
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Integrations
  integrations: [
    Sentry.httpIntegration(),
    Sentry.nodeContextIntegration(),
    Sentry.localVariablesIntegration(),
    Sentry.requestDataIntegration({
      include: {
        request: ['method', 'url', 'headers', 'query_string'],
        user: ['id', 'email', 'username'],
      },
    }),
  ],
  
  // Error filtering
  beforeSend: (event, hint) => {
    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
      return null;
    }
    
    // Filter out Next.js build-time errors
    if (event.logger === 'webpack' || event.logger === 'next.js') {
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
    // Filter out noisy HTTP requests
    if (breadcrumb.category === 'http' && breadcrumb.data?.url?.includes('/_next/')) {
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
      service: 'nexus-frontend-server',
      platform: 'node',
    },
  },
  
  // Debug mode
  debug: process.env.NODE_ENV === 'development' && process.env.SENTRY_DEBUG === 'true',
  
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
