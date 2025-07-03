import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AnalyticsManager } from '../core/AnalyticsManager';
import { AnalyticsConfig, FeatureArea, UserRole } from '../types/events';

interface AnalyticsContextValue {
  analytics: AnalyticsManager | null;
  isInitialized: boolean;
  consentGiven: boolean;
  setConsent: (consent: boolean, categories?: string[]) => void;
  identify: (userId: string, properties?: Record<string, any>) => void;
  trackFeature: (area: FeatureArea, name: string, properties?: Record<string, any>) => void;
  trackPageView: (url?: string, properties?: Record<string, any>) => void;
  trackEngagement: (type: string, element?: string, value?: number, properties?: Record<string, any>) => void;
  trackConversion: (goal: string, funnel: string, step: number, totalSteps: number, properties?: Record<string, any>) => void;
  trackError: (type: string, message: string, properties?: Record<string, any>) => void;
  createFunnel: (name: string, steps: string[]) => any;
  createCohort: (name: string, properties?: Record<string, any>) => any;
}

const AnalyticsContext = createContext<AnalyticsContextValue | undefined>(undefined);

interface AnalyticsProviderProps {
  config: AnalyticsConfig;
  children: ReactNode;
  requireConsent?: boolean;
  autoTrackPageViews?: boolean;
  autoTrackErrors?: boolean;
  autoTrackPerformance?: boolean;
}

export const AnalyticsProvider: React.FC<AnalyticsProviderProps> = ({
  config,
  children,
  requireConsent = true,
  autoTrackPageViews = true,
  autoTrackErrors = true,
  autoTrackPerformance = true
}) => {
  const [analytics, setAnalytics] = useState<AnalyticsManager | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [consentGiven, setConsentGiven] = useState(!requireConsent);

  useEffect(() => {
    const initializeAnalytics = async () => {
      try {
        const manager = new AnalyticsManager(config);
        setAnalytics(manager);
        setIsInitialized(true);

        // Set initial consent
        if (!requireConsent) {
          manager.setConsent(true);
        }
      } catch (error) {
        console.error('Failed to initialize analytics:', error);
      }
    };

    initializeAnalytics();
  }, [config, requireConsent]);

  useEffect(() => {
    if (!analytics || !isInitialized) return;

    // Auto-track page views
    if (autoTrackPageViews) {
      const handleRouteChange = () => {
        analytics.trackPageView(window.location.href, {
          title: document.title,
          referrer: document.referrer
        });
      };

      // Track initial page view
      handleRouteChange();

      // Listen for route changes (works with most SPA routers)
      window.addEventListener('popstate', handleRouteChange);
      
      // For React Router and similar
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = function(...args) {
        originalPushState.apply(history, args);
        setTimeout(handleRouteChange, 0);
      };
      
      history.replaceState = function(...args) {
        originalReplaceState.apply(history, args);
        setTimeout(handleRouteChange, 0);
      };

      return () => {
        window.removeEventListener('popstate', handleRouteChange);
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
      };
    }
  }, [analytics, isInitialized, autoTrackPageViews]);

  useEffect(() => {
    if (!analytics || !isInitialized || !autoTrackErrors) return;

    // Auto-track JavaScript errors
    const handleError = (event: ErrorEvent) => {
      analytics.trackError('javascript', event.message, {
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        severity: 'high'
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      analytics.trackError('javascript', event.reason?.message || 'Unhandled promise rejection', {
        stack: event.reason?.stack,
        severity: 'medium'
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [analytics, isInitialized, autoTrackErrors]);

  useEffect(() => {
    if (!analytics || !isInitialized || !autoTrackPerformance) return;

    // Auto-track Core Web Vitals
    const trackWebVitals = () => {
      // Track Largest Contentful Paint (LCP)
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        analytics.trackPerformance('core_web_vitals', lastEntry.startTime, 'ms', {
          metric: 'LCP',
          isGoodPerformance: lastEntry.startTime < 2500
        });
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // Track First Input Delay (FID)
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          analytics.trackPerformance('core_web_vitals', entry.processingStart - entry.startTime, 'ms', {
            metric: 'FID',
            isGoodPerformance: (entry.processingStart - entry.startTime) < 100
          });
        });
      }).observe({ entryTypes: ['first-input'] });

      // Track Cumulative Layout Shift (CLS)
      let clsValue = 0;
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        analytics.trackPerformance('core_web_vitals', clsValue, 'score', {
          metric: 'CLS',
          isGoodPerformance: clsValue < 0.1
        });
      }).observe({ entryTypes: ['layout-shift'] });
    };

    // Track performance when page is loaded
    if (document.readyState === 'complete') {
      trackWebVitals();
    } else {
      window.addEventListener('load', trackWebVitals);
    }
  }, [analytics, isInitialized, autoTrackPerformance]);

  const setConsent = (consent: boolean, categories?: string[]) => {
    setConsentGiven(consent);
    if (analytics) {
      analytics.setConsent(consent, categories);
    }
  };

  const identify = (userId: string, properties?: Record<string, any>) => {
    if (analytics) {
      analytics.identify(userId, properties);
    }
  };

  const trackFeature = (area: FeatureArea, name: string, properties?: Record<string, any>) => {
    if (analytics) {
      analytics.trackFeatureUsage(area, name, properties);
    }
  };

  const trackPageView = (url?: string, properties?: Record<string, any>) => {
    if (analytics) {
      analytics.trackPageView(url || window.location.href, properties);
    }
  };

  const trackEngagement = (type: string, element?: string, value?: number, properties?: Record<string, any>) => {
    if (analytics) {
      analytics.trackEngagement(type as any, element, value, properties);
    }
  };

  const trackConversion = (goal: string, funnel: string, step: number, totalSteps: number, properties?: Record<string, any>) => {
    if (analytics) {
      analytics.trackConversion(goal, funnel, step, totalSteps, properties);
    }
  };

  const trackError = (type: string, message: string, properties?: Record<string, any>) => {
    if (analytics) {
      analytics.trackError(type as any, message, properties);
    }
  };

  const createFunnel = (name: string, steps: string[]) => {
    if (analytics) {
      return analytics.createFunnel(name, steps);
    }
    return null;
  };

  const createCohort = (name: string, properties?: Record<string, any>) => {
    if (analytics) {
      return analytics.createCohort(name, properties);
    }
    return null;
  };

  const contextValue: AnalyticsContextValue = {
    analytics,
    isInitialized,
    consentGiven,
    setConsent,
    identify,
    trackFeature,
    trackPageView,
    trackEngagement,
    trackConversion,
    trackError,
    createFunnel,
    createCohort
  };

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  );
};

export const useAnalytics = (): AnalyticsContextValue => {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
};

// Higher-order component for class components
export const withAnalytics = <P extends object>(
  Component: React.ComponentType<P & { analytics: AnalyticsContextValue }>
) => {
  return (props: P) => {
    const analytics = useAnalytics();
    return <Component {...props} analytics={analytics} />;
  };
};
