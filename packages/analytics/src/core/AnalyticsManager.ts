import { v4 as uuidv4 } from 'uuid';
import { debounce, throttle } from 'lodash';
import { 
  AnalyticsConfig, 
  AnyAnalyticsEvent, 
  BaseEventProperties,
  EventCategory,
  UserRole,
  FeatureArea 
} from '../types/events';
import { PostHogProvider } from '../providers/PostHogProvider';
import { MixpanelProvider } from '../providers/MixpanelProvider';

/**
 * Core Analytics Manager
 * Handles event tracking, user identification, and provider management
 */
export class AnalyticsManager {
  private config: AnalyticsConfig;
  private providers: Map<string, any> = new Map();
  private sessionId: string;
  private userId?: string;
  private userProperties: Record<string, any> = {};
  private eventQueue: AnyAnalyticsEvent[] = [];
  private isInitialized = false;
  private consentGiven = false;
  private debugMode = false;

  constructor(config: AnalyticsConfig) {
    this.config = config;
    this.sessionId = this.generateSessionId();
    this.debugMode = config.global.debug;
    
    this.initialize();
  }

  /**
   * Initialize analytics providers
   */
  private async initialize(): Promise<void> {
    try {
      // Initialize PostHog if configured
      if (this.config.posthog) {
        const posthogProvider = new PostHogProvider(this.config.posthog);
        await posthogProvider.initialize();
        this.providers.set('posthog', posthogProvider);
        this.log('PostHog provider initialized');
      }

      // Initialize Mixpanel if configured
      if (this.config.mixpanel) {
        const mixpanelProvider = new MixpanelProvider(this.config.mixpanel);
        await mixpanelProvider.initialize();
        this.providers.set('mixpanel', mixpanelProvider);
        this.log('Mixpanel provider initialized');
      }

      // Set up session management
      this.setupSessionManagement();
      
      // Set up automatic event tracking
      this.setupAutomaticTracking();

      this.isInitialized = true;
      this.log('Analytics Manager initialized');

      // Process queued events
      await this.processEventQueue();

    } catch (error) {
      console.error('Failed to initialize Analytics Manager:', error);
    }
  }

  /**
   * Set user consent for analytics tracking
   */
  setConsent(consent: boolean, categories?: string[]): void {
    this.consentGiven = consent;
    
    if (consent) {
      this.log('Analytics consent granted');
      this.processEventQueue();
    } else {
      this.log('Analytics consent revoked');
      this.clearUserData();
    }

    // Update providers with consent status
    this.providers.forEach(provider => {
      if (provider.setConsent) {
        provider.setConsent(consent, categories);
      }
    });
  }

  /**
   * Identify a user
   */
  identify(userId: string, properties?: Record<string, any>): void {
    this.userId = userId;
    this.userProperties = { ...this.userProperties, ...properties };

    if (!this.shouldTrack()) return;

    this.providers.forEach(provider => {
      if (provider.identify) {
        provider.identify(userId, this.userProperties);
      }
    });

    this.log('User identified:', userId);
  }

  /**
   * Set user properties
   */
  setUserProperties(properties: Record<string, any>): void {
    this.userProperties = { ...this.userProperties, ...properties };

    if (!this.shouldTrack()) return;

    this.providers.forEach(provider => {
      if (provider.setUserProperties) {
        provider.setUserProperties(properties);
      }
    });

    this.log('User properties set:', properties);
  }

  /**
   * Track an event
   */
  track(event: AnyAnalyticsEvent): void {
    if (!this.shouldTrack()) {
      this.eventQueue.push(event);
      return;
    }

    // Enrich event with base properties
    const enrichedEvent = this.enrichEvent(event);
    
    // Apply event configuration
    const eventConfig = this.config.events[event.event];
    if (eventConfig && !eventConfig.enabled) {
      this.log('Event disabled:', event.event);
      return;
    }

    // Apply sampling
    if (eventConfig?.sampleRate && Math.random() > eventConfig.sampleRate) {
      this.log('Event sampled out:', event.event);
      return;
    }

    // Send to configured providers
    this.providers.forEach((provider, name) => {
      const shouldSend = eventConfig?.[name as keyof typeof eventConfig] !== false;
      if (shouldSend && provider.track) {
        provider.track(enrichedEvent);
      }
    });

    this.log('Event tracked:', event.event, enrichedEvent.properties);
  }

  /**
   * Track page view
   */
  trackPageView(url: string, title?: string, properties?: Record<string, any>): void {
    this.track({
      event: 'page_view',
      category: 'navigation',
      properties: {
        ...this.getBaseProperties(),
        navigation: {
          from: document.referrer || 'direct',
          to: url,
          method: 'browser' as const
        },
        page: {
          title: title || document.title,
          url,
          referrer: document.referrer,
          loadTime: performance.now()
        },
        ...properties
      }
    });
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(
    featureArea: FeatureArea,
    featureName: string,
    properties?: Record<string, any>
  ): void {
    this.track({
      event: 'feature_used',
      category: 'feature',
      properties: {
        ...this.getBaseProperties(),
        feature: {
          area: featureArea,
          name: featureName,
          version: properties?.version
        },
        context: {
          source: properties?.source || 'unknown',
          previousAction: properties?.previousAction,
          timeSpentOnPage: properties?.timeSpentOnPage
        },
        ...properties
      }
    });
  }

  /**
   * Track user engagement
   */
  trackEngagement(
    type: 'scroll' | 'click' | 'hover' | 'focus' | 'time_spent' | 'interaction',
    element?: string,
    value?: number,
    properties?: Record<string, any>
  ): void {
    this.track({
      event: 'user_engagement',
      category: 'engagement',
      properties: {
        ...this.getBaseProperties(),
        engagement: {
          type,
          element,
          value,
          duration: properties?.duration
        },
        content: properties?.content,
        ...properties
      }
    });
  }

  /**
   * Track conversion events
   */
  trackConversion(
    goal: string,
    funnel: string,
    step: number,
    totalSteps: number,
    properties?: Record<string, any>
  ): void {
    this.track({
      event: 'conversion',
      category: 'conversion',
      properties: {
        ...this.getBaseProperties(),
        conversion: {
          goal: goal as any,
          funnel,
          step,
          totalSteps,
          value: properties?.value,
          currency: properties?.currency
        },
        attribution: properties?.attribution,
        ...properties
      }
    });
  }

  /**
   * Track errors
   */
  trackError(
    type: 'javascript' | 'network' | 'validation' | 'authentication' | 'authorization',
    message: string,
    properties?: Record<string, any>
  ): void {
    this.track({
      event: 'error_occurred',
      category: 'error',
      properties: {
        ...this.getBaseProperties(),
        error: {
          type,
          message,
          stack: properties?.stack,
          code: properties?.code,
          severity: properties?.severity || 'medium'
        },
        context: {
          action: properties?.action || 'unknown',
          component: properties?.component,
          url: window.location.href,
          userAgent: navigator.userAgent
        },
        ...properties
      }
    });
  }

  /**
   * Track performance metrics
   */
  trackPerformance(
    metric: 'page_load' | 'api_response' | 'component_render' | 'bundle_size' | 'core_web_vitals',
    value: number,
    unit: 'ms' | 'bytes' | 'score',
    properties?: Record<string, any>
  ): void {
    this.track({
      event: 'performance_metric',
      category: 'performance',
      properties: {
        ...this.getBaseProperties(),
        performance: {
          metric,
          value,
          unit,
          threshold: properties?.threshold,
          isGoodPerformance: properties?.isGoodPerformance ?? true
        },
        context: properties?.context,
        ...properties
      }
    });
  }

  /**
   * Create a funnel tracker
   */
  createFunnel(name: string, steps: string[]) {
    return {
      trackStep: (stepIndex: number, properties?: Record<string, any>) => {
        this.trackConversion(
          'funnel_step',
          name,
          stepIndex + 1,
          steps.length,
          {
            stepName: steps[stepIndex],
            ...properties
          }
        );
      },
      trackCompletion: (properties?: Record<string, any>) => {
        this.trackConversion(
          'funnel_completion',
          name,
          steps.length,
          steps.length,
          properties
        );
      }
    };
  }

  /**
   * Create a cohort tracker
   */
  createCohort(name: string, properties?: Record<string, any>) {
    return {
      addUser: (userId: string, userProperties?: Record<string, any>) => {
        this.track({
          event: 'cohort_user_added',
          category: 'user',
          properties: {
            ...this.getBaseProperties(),
            cohort: {
              name,
              userId,
              ...properties
            },
            userProfile: userProperties,
            ...userProperties
          }
        });
      },
      trackEvent: (eventName: string, eventProperties?: Record<string, any>) => {
        this.track({
          event: eventName,
          category: 'user',
          properties: {
            ...this.getBaseProperties(),
            cohort: {
              name,
              ...properties
            },
            ...eventProperties
          }
        });
      }
    };
  }

  /**
   * Flush all pending events
   */
  async flush(): Promise<void> {
    const flushPromises = Array.from(this.providers.values()).map(provider => {
      if (provider.flush) {
        return provider.flush();
      }
      return Promise.resolve();
    });

    await Promise.all(flushPromises);
    this.log('All events flushed');
  }

  /**
   * Reset analytics state
   */
  reset(): void {
    this.userId = undefined;
    this.userProperties = {};
    this.sessionId = this.generateSessionId();
    this.eventQueue = [];

    this.providers.forEach(provider => {
      if (provider.reset) {
        provider.reset();
      }
    });

    this.log('Analytics state reset');
  }

  /**
   * Get analytics debug information
   */
  getDebugInfo(): Record<string, any> {
    return {
      isInitialized: this.isInitialized,
      consentGiven: this.consentGiven,
      userId: this.userId,
      sessionId: this.sessionId,
      providers: Array.from(this.providers.keys()),
      queuedEvents: this.eventQueue.length,
      userProperties: this.userProperties,
      config: {
        environment: this.config.global.environment,
        debug: this.config.global.debug,
        enabled: this.config.global.enabled
      }
    };
  }

  // Private methods

  private shouldTrack(): boolean {
    if (!this.config.global.enabled) return false;
    if (this.config.global.consent.required && !this.consentGiven) return false;
    return this.isInitialized;
  }

  private enrichEvent(event: AnyAnalyticsEvent): AnyAnalyticsEvent {
    const baseProperties = this.getBaseProperties();
    const eventConfig = this.config.events[event.event];
    
    return {
      ...event,
      properties: {
        ...baseProperties,
        ...event.properties,
        ...eventConfig?.customProperties
      },
      metadata: {
        source: 'client',
        version: '1.0.0',
        environment: this.config.global.environment,
        ...event.metadata
      }
    };
  }

  private getBaseProperties(): BaseEventProperties {
    return {
      timestamp: new Date(),
      userId: this.userId,
      sessionId: this.sessionId,
      device: this.getDeviceInfo(),
      location: this.getLocationInfo(),
      utm: this.getUTMParameters(),
      experiments: this.getExperimentVariants(),
      featureFlags: this.getFeatureFlags()
    };
  }

  private getDeviceInfo() {
    return {
      type: this.getDeviceType(),
      os: this.getOperatingSystem(),
      browser: this.getBrowser(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  }

  private getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    const userAgent = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) return 'tablet';
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) return 'mobile';
    return 'desktop';
  }

  private getOperatingSystem(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Unknown';
  }

  private getBrowser(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private getLocationInfo() {
    // This would typically be populated by the server or a geolocation service
    return {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  private getUTMParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      source: urlParams.get('utm_source') || undefined,
      medium: urlParams.get('utm_medium') || undefined,
      campaign: urlParams.get('utm_campaign') || undefined,
      term: urlParams.get('utm_term') || undefined,
      content: urlParams.get('utm_content') || undefined
    };
  }

  private getExperimentVariants(): Record<string, string> {
    // This would integrate with your A/B testing framework
    return {};
  }

  private getFeatureFlags(): Record<string, boolean> {
    // This would integrate with your feature flag system
    return {};
  }

  private generateSessionId(): string {
    return uuidv4();
  }

  private setupSessionManagement(): void {
    // Extend session on activity
    const extendSession = throttle(() => {
      // Session extension logic
    }, 60000); // 1 minute throttle

    ['click', 'scroll', 'keypress'].forEach(event => {
      document.addEventListener(event, extendSession);
    });

    // Session timeout
    const sessionTimeout = this.config.user.anonymous.sessionTimeout * 60 * 1000;
    setTimeout(() => {
      this.sessionId = this.generateSessionId();
    }, sessionTimeout);
  }

  private setupAutomaticTracking(): void {
    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackEngagement('time_spent', 'page', performance.now());
      }
    });

    // Track unload events
    window.addEventListener('beforeunload', () => {
      this.flush();
    });

    // Track errors
    window.addEventListener('error', (event) => {
      this.trackError('javascript', event.message, {
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        severity: 'high'
      });
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError('javascript', event.reason?.message || 'Unhandled promise rejection', {
        stack: event.reason?.stack,
        severity: 'medium'
      });
    });
  }

  private async processEventQueue(): Promise<void> {
    if (!this.shouldTrack() || this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    for (const event of events) {
      this.track(event);
    }
  }

  private clearUserData(): void {
    this.providers.forEach(provider => {
      if (provider.clearUserData) {
        provider.clearUserData();
      }
    });
  }

  private log(...args: any[]): void {
    if (this.debugMode) {
      console.log('[Analytics]', ...args);
    }
  }
}
