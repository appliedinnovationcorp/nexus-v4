import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Environment and release info
  environment: process.env.NODE_ENV || 'development',
  release: process.env.SENTRY_RELEASE || '1.0.0',
  
  // Performance monitoring (reduced for edge runtime)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0.5,
  
  // Error filtering
  beforeSend: (event, hint) => {
    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
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
  
  // Initial scope
  initialScope: {
    tags: {
      service: 'nexus-frontend-edge',
      platform: 'edge',
    },
  },
  
  // Debug mode
  debug: process.env.NODE_ENV === 'development' && process.env.SENTRY_DEBUG === 'true',
  
  // Maximum breadcrumbs (reduced for edge runtime)
  maxBreadcrumbs: 20,
  
  // Attach stack trace to messages
  attachStacktrace: true,
  
  // Send default PII (disabled for privacy)
  sendDefaultPii: false,
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
