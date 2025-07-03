import { useCallback, useEffect, useRef } from 'react';
import { useAnalytics } from '../AnalyticsProvider';
import { FeatureArea } from '../../types/events';

interface UseFeatureTrackingOptions {
  /** Feature area */
  area: FeatureArea;
  /** Feature name */
  name: string;
  /** Auto-track when component mounts */
  trackOnMount?: boolean;
  /** Auto-track when component unmounts */
  trackOnUnmount?: boolean;
  /** Track time spent on feature */
  trackTimeSpent?: boolean;
  /** Additional properties to include with all events */
  defaultProperties?: Record<string, any>;
}

interface FeatureTracker {
  /** Track feature usage */
  track: (properties?: Record<string, any>) => void;
  /** Track feature interaction */
  trackInteraction: (interaction: string, properties?: Record<string, any>) => void;
  /** Track feature completion */
  trackCompletion: (success: boolean, properties?: Record<string, any>) => void;
  /** Track feature error */
  trackError: (error: string, properties?: Record<string, any>) => void;
  /** Start timing an action */
  startTiming: (action: string) => void;
  /** End timing an action */
  endTiming: (action: string, properties?: Record<string, any>) => void;
}

export const useFeatureTracking = (options: UseFeatureTrackingOptions): FeatureTracker => {
  const { analytics } = useAnalytics();
  const mountTimeRef = useRef<number>();
  const timingRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    mountTimeRef.current = Date.now();

    if (options.trackOnMount) {
      track({ source: 'mount' });
    }

    return () => {
      if (options.trackOnUnmount) {
        const timeSpent = mountTimeRef.current ? Date.now() - mountTimeRef.current : undefined;
        track({ 
          source: 'unmount',
          timeSpent: options.trackTimeSpent ? timeSpent : undefined
        });
      }
    };
  }, [options.area, options.name]);

  const track = useCallback((properties?: Record<string, any>) => {
    if (!analytics) return;

    analytics.trackFeatureUsage(options.area, options.name, {
      ...options.defaultProperties,
      ...properties
    });
  }, [analytics, options.area, options.name, options.defaultProperties]);

  const trackInteraction = useCallback((interaction: string, properties?: Record<string, any>) => {
    if (!analytics) return;

    analytics.trackEngagement('interaction', `${options.area}-${options.name}-${interaction}`, undefined, {
      feature: {
        area: options.area,
        name: options.name
      },
      interaction,
      ...options.defaultProperties,
      ...properties
    });
  }, [analytics, options.area, options.name, options.defaultProperties]);

  const trackCompletion = useCallback((success: boolean, properties?: Record<string, any>) => {
    if (!analytics) return;

    analytics.track({
      event: 'feature_completion',
      category: 'feature',
      properties: {
        sessionId: 'current-session', // This would be managed by the analytics system
        feature: {
          area: options.area,
          name: options.name
        },
        success,
        completionTime: mountTimeRef.current ? Date.now() - mountTimeRef.current : undefined,
        ...options.defaultProperties,
        ...properties
      }
    });
  }, [analytics, options.area, options.name, options.defaultProperties]);

  const trackError = useCallback((error: string, properties?: Record<string, any>) => {
    if (!analytics) return;

    analytics.trackError('validation', error, {
      feature: {
        area: options.area,
        name: options.name
      },
      severity: 'medium',
      ...options.defaultProperties,
      ...properties
    });
  }, [analytics, options.area, options.name, options.defaultProperties]);

  const startTiming = useCallback((action: string) => {
    timingRef.current.set(action, Date.now());
  }, []);

  const endTiming = useCallback((action: string, properties?: Record<string, any>) => {
    const startTime = timingRef.current.get(action);
    if (!startTime || !analytics) return;

    const duration = Date.now() - startTime;
    timingRef.current.delete(action);

    analytics.trackPerformance('component_render', duration, 'ms', {
      feature: {
        area: options.area,
        name: options.name
      },
      action,
      isGoodPerformance: duration < 100, // Consider < 100ms as good performance
      ...options.defaultProperties,
      ...properties
    });
  }, [analytics, options.area, options.name, options.defaultProperties]);

  return {
    track,
    trackInteraction,
    trackCompletion,
    trackError,
    startTiming,
    endTiming
  };
};

// Specialized hooks for common use cases

export const useButtonTracking = (buttonName: string, area: FeatureArea) => {
  const { trackInteraction } = useFeatureTracking({
    area,
    name: buttonName,
    trackOnMount: false
  });

  return useCallback((properties?: Record<string, any>) => {
    trackInteraction('click', {
      element: 'button',
      ...properties
    });
  }, [trackInteraction]);
};

export const useFormTracking = (formName: string, area: FeatureArea) => {
  const tracker = useFeatureTracking({
    area,
    name: formName,
    trackOnMount: true,
    trackTimeSpent: true
  });

  return {
    trackFieldFocus: useCallback((fieldName: string) => {
      tracker.trackInteraction('field_focus', { field: fieldName });
    }, [tracker]),
    
    trackFieldBlur: useCallback((fieldName: string, value?: any) => {
      tracker.trackInteraction('field_blur', { 
        field: fieldName,
        hasValue: value !== undefined && value !== ''
      });
    }, [tracker]),
    
    trackValidationError: useCallback((fieldName: string, error: string) => {
      tracker.trackError(`Validation error in ${fieldName}: ${error}`, {
        field: fieldName,
        validationError: error
      });
    }, [tracker]),
    
    trackSubmit: useCallback((success: boolean, errors?: string[]) => {
      tracker.trackCompletion(success, {
        action: 'submit',
        errors: errors?.length ? errors : undefined,
        errorCount: errors?.length || 0
      });
    }, [tracker])
  };
};

export const usePageTracking = (pageName: string, area: FeatureArea) => {
  const tracker = useFeatureTracking({
    area,
    name: pageName,
    trackOnMount: true,
    trackOnUnmount: true,
    trackTimeSpent: true
  });

  const scrollDepthRef = useRef<number>(0);
  const maxScrollRef = useRef<number>(0);

  useEffect(() => {
    const trackScrollDepth = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      const scrollPercent = Math.round((scrollTop + windowHeight) / documentHeight * 100);
      
      if (scrollPercent > maxScrollRef.current) {
        maxScrollRef.current = scrollPercent;
        
        // Track scroll milestones
        const milestones = [25, 50, 75, 90, 100];
        const milestone = milestones.find(m => scrollPercent >= m && scrollDepthRef.current < m);
        
        if (milestone) {
          scrollDepthRef.current = milestone;
          tracker.trackInteraction('scroll', {
            scrollDepth: milestone,
            scrollPercent: scrollPercent
          });
        }
      }
    };

    window.addEventListener('scroll', trackScrollDepth, { passive: true });
    return () => window.removeEventListener('scroll', trackScrollDepth);
  }, [tracker]);

  return {
    trackAction: tracker.trackInteraction,
    trackError: tracker.trackError,
    trackCompletion: tracker.trackCompletion
  };
};

export const useModalTracking = (modalName: string, area: FeatureArea) => {
  const tracker = useFeatureTracking({
    area,
    name: modalName,
    trackOnMount: false
  });

  return {
    trackOpen: useCallback((trigger?: string) => {
      tracker.track({ 
        action: 'open',
        trigger: trigger || 'unknown'
      });
    }, [tracker]),
    
    trackClose: useCallback((method: 'button' | 'escape' | 'backdrop' | 'programmatic') => {
      tracker.track({ 
        action: 'close',
        closeMethod: method
      });
    }, [tracker]),
    
    trackInteraction: tracker.trackInteraction,
    trackCompletion: tracker.trackCompletion
  };
};
