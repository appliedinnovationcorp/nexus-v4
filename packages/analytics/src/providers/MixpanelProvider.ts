import mixpanel from 'mixpanel-browser';
import Mixpanel from 'mixpanel';
import { AnyAnalyticsEvent } from '../types/events';

/**
 * Mixpanel Analytics Provider
 * Handles client and server-side Mixpanel integration
 */
export class MixpanelProvider {
  private clientInstance?: typeof mixpanel;
  private serverInstance?: Mixpanel.Mixpanel;
  private config: {
    token: string;
    options?: Record<string, any>;
  };
  private isClient: boolean;

  constructor(config: { token: string; options?: Record<string, any> }) {
    this.config = config;
    this.isClient = typeof window !== 'undefined';
  }

  /**
   * Initialize Mixpanel
   */
  async initialize(): Promise<void> {
    try {
      if (this.isClient) {
        await this.initializeClient();
      } else {
        await this.initializeServer();
      }
    } catch (error) {
      console.error('Failed to initialize Mixpanel:', error);
      throw error;
    }
  }

  /**
   * Initialize client-side Mixpanel
   */
  private async initializeClient(): Promise<void> {
    const defaultOptions = {
      debug: process.env.NODE_ENV === 'development',
      track_pageview: false, // We'll handle this manually
      persistence: 'localStorage',
      secure_cookie: true,
      cross_subdomain_cookie: true,
      ignore_dnt: false,
      property_blacklist: [
        '$password',
        '$email',
        '$phone',
        '$credit_card'
      ],
      ip: false, // Don't collect IP addresses
      loaded: (mixpanel: any) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('Mixpanel loaded');
        }
      },
      ...this.config.options
    };

    mixpanel.init(this.config.token, defaultOptions);
    this.clientInstance = mixpanel;
  }

  /**
   * Initialize server-side Mixpanel
   */
  private async initializeServer(): Promise<void> {
    this.serverInstance = Mixpanel.init(this.config.token, {
      debug: process.env.NODE_ENV === 'development',
      ...this.config.options
    });
  }

  /**
   * Identify a user
   */
  identify(userId: string, properties?: Record<string, any>): void {
    try {
      if (this.isClient && this.clientInstance) {
        this.clientInstance.identify(userId);
        if (properties) {
          this.clientInstance.people.set(properties);
        }
      } else if (this.serverInstance) {
        // Server-side identification is handled per event
        if (properties) {
          this.serverInstance.people.set(userId, properties);
        }
      }
    } catch (error) {
      console.error('Mixpanel identify error:', error);
    }
  }

  /**
   * Set user properties
   */
  setUserProperties(properties: Record<string, any>): void {
    try {
      if (this.isClient && this.clientInstance) {
        this.clientInstance.people.set(properties);
      } else if (this.serverInstance) {
        console.warn('Server-side setUserProperties requires userId');
      }
    } catch (error) {
      console.error('Mixpanel setUserProperties error:', error);
    }
  }

  /**
   * Track an event
   */
  track(event: AnyAnalyticsEvent): void {
    try {
      const eventData = this.transformEvent(event);
      
      if (this.isClient && this.clientInstance) {
        this.clientInstance.track(eventData.event, eventData.properties);
      } else if (this.serverInstance) {
        const distinctId = eventData.properties.userId || eventData.properties.sessionId || 'anonymous';
        this.serverInstance.track(eventData.event, {
          distinct_id: distinctId,
          ...eventData.properties
        });
      }
    } catch (error) {
      console.error('Mixpanel track error:', error);
    }
  }

  /**
   * Track page view
   */
  trackPageView(url: string, properties?: Record<string, any>): void {
    try {
      const pageProperties = {
        url,
        title: typeof document !== 'undefined' ? document.title : undefined,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
        ...properties
      };

      if (this.isClient && this.clientInstance) {
        this.clientInstance.track('Page View', pageProperties);
      } else if (this.serverInstance) {
        const distinctId = properties?.userId || properties?.sessionId || 'anonymous';
        this.serverInstance.track('Page View', {
          distinct_id: distinctId,
          ...pageProperties
        });
      }
    } catch (error) {
      console.error('Mixpanel trackPageView error:', error);
    }
  }

  /**
   * Set user profile properties
   */
  setUserProfile(userId: string, properties: Record<string, any>): void {
    try {
      if (this.isClient && this.clientInstance) {
        this.clientInstance.people.set(properties);
      } else if (this.serverInstance) {
        this.serverInstance.people.set(userId, properties);
      }
    } catch (error) {
      console.error('Mixpanel setUserProfile error:', error);
    }
  }

  /**
   * Increment user property
   */
  incrementUserProperty(property: string, value: number = 1, userId?: string): void {
    try {
      if (this.isClient && this.clientInstance) {
        this.clientInstance.people.increment(property, value);
      } else if (this.serverInstance && userId) {
        this.serverInstance.people.increment(userId, property, value);
      }
    } catch (error) {
      console.error('Mixpanel incrementUserProperty error:', error);
    }
  }

  /**
   * Track revenue
   */
  trackRevenue(amount: number, properties?: Record<string, any>): void {
    try {
      if (this.isClient && this.clientInstance) {
        this.clientInstance.people.track_charge(amount, properties);
      } else if (this.serverInstance && properties?.userId) {
        this.serverInstance.people.track_charge(properties.userId, amount, properties);
      }
    } catch (error) {
      console.error('Mixpanel trackRevenue error:', error);
    }
  }

  /**
   * Create funnel
   */
  trackFunnel(funnelName: string, step: string, properties?: Record<string, any>): void {
    try {
      const funnelProperties = {
        funnel_name: funnelName,
        funnel_step: step,
        ...properties
      };

      this.track({
        event: 'Funnel Step',
        category: 'conversion',
        properties: {
          sessionId: properties?.sessionId || 'unknown',
          ...funnelProperties
        }
      });
    } catch (error) {
      console.error('Mixpanel trackFunnel error:', error);
    }
  }

  /**
   * Create cohort
   */
  async createCohort(name: string, userIds: string[]): Promise<void> {
    try {
      // Mixpanel cohorts are typically managed through the UI or API
      // This would require API integration
      console.log('Creating cohort:', name, 'with users:', userIds.length);
      
      // For server-side, you would use the Mixpanel API
      if (this.serverInstance) {
        // Example: Add users to a cohort via people properties
        for (const userId of userIds) {
          this.serverInstance.people.set(userId, {
            [`cohort_${name}`]: true,
            cohort_joined_date: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Mixpanel createCohort error:', error);
    }
  }

  /**
   * Set consent for data collection
   */
  setConsent(consent: boolean, categories?: string[]): void {
    try {
      if (this.isClient && this.clientInstance) {
        if (consent) {
          this.clientInstance.opt_in_tracking();
        } else {
          this.clientInstance.opt_out_tracking();
        }
      }
    } catch (error) {
      console.error('Mixpanel setConsent error:', error);
    }
  }

  /**
   * Time an event
   */
  timeEvent(eventName: string): void {
    try {
      if (this.isClient && this.clientInstance) {
        this.clientInstance.time_event(eventName);
      }
    } catch (error) {
      console.error('Mixpanel timeEvent error:', error);
    }
  }

  /**
   * Register super properties (sent with every event)
   */
  registerSuperProperties(properties: Record<string, any>): void {
    try {
      if (this.isClient && this.clientInstance) {
        this.clientInstance.register(properties);
      }
    } catch (error) {
      console.error('Mixpanel registerSuperProperties error:', error);
    }
  }

  /**
   * Unregister super property
   */
  unregisterSuperProperty(property: string): void {
    try {
      if (this.isClient && this.clientInstance) {
        this.clientInstance.unregister(property);
      }
    } catch (error) {
      console.error('Mixpanel unregisterSuperProperty error:', error);
    }
  }

  /**
   * Flush pending events
   */
  async flush(): Promise<void> {
    try {
      // Mixpanel automatically flushes events
      // For server-side, events are sent immediately
    } catch (error) {
      console.error('Mixpanel flush error:', error);
    }
  }

  /**
   * Reset user state
   */
  reset(): void {
    try {
      if (this.isClient && this.clientInstance) {
        this.clientInstance.reset();
      }
    } catch (error) {
      console.error('Mixpanel reset error:', error);
    }
  }

  /**
   * Clear user data
   */
  clearUserData(): void {
    try {
      if (this.isClient && this.clientInstance) {
        this.clientInstance.reset();
        // Clear local storage
        localStorage.removeItem('mp_' + this.config.token + '_mixpanel');
      }
    } catch (error) {
      console.error('Mixpanel clearUserData error:', error);
    }
  }

  /**
   * Get distinct ID
   */
  getDistinctId(): string | undefined {
    try {
      if (this.isClient && this.clientInstance) {
        return this.clientInstance.get_distinct_id();
      }
    } catch (error) {
      console.error('Mixpanel getDistinctId error:', error);
      return undefined;
    }
  }

  /**
   * Transform analytics event to Mixpanel format
   */
  private transformEvent(event: AnyAnalyticsEvent): { event: string; properties: Record<string, any> } {
    const properties = {
      ...event.properties,
      event_category: event.category,
      timestamp: event.properties.timestamp || new Date(),
      session_id: event.properties.sessionId,
      user_id: event.properties.userId
    };

    // Add device information
    if (event.properties.device) {
      properties.device_type = event.properties.device.type;
      properties.os = event.properties.device.os;
      properties.browser = event.properties.device.browser;
      properties.viewport_width = event.properties.device.viewport.width;
      properties.viewport_height = event.properties.device.viewport.height;
    }

    // Add location information
    if (event.properties.location) {
      properties.country = event.properties.location.country;
      properties.region = event.properties.location.region;
      properties.city = event.properties.location.city;
      properties.timezone = event.properties.location.timezone;
    }

    // Add UTM parameters
    if (event.properties.utm) {
      properties.utm_source = event.properties.utm.source;
      properties.utm_medium = event.properties.utm.medium;
      properties.utm_campaign = event.properties.utm.campaign;
      properties.utm_term = event.properties.utm.term;
      properties.utm_content = event.properties.utm.content;
    }

    // Handle specific event types
    switch (event.category) {
      case 'feature':
        if ('feature' in event.properties) {
          properties.feature_area = event.properties.feature.area;
          properties.feature_name = event.properties.feature.name;
          properties.feature_version = event.properties.feature.version;
        }
        break;
      
      case 'navigation':
        if ('navigation' in event.properties) {
          properties.page_from = event.properties.navigation.from;
          properties.page_to = event.properties.navigation.to;
          properties.navigation_method = event.properties.navigation.method;
        }
        break;
      
      case 'conversion':
        if ('conversion' in event.properties) {
          properties.conversion_goal = event.properties.conversion.goal;
          properties.funnel_name = event.properties.conversion.funnel;
          properties.funnel_step = event.properties.conversion.step;
          properties.total_steps = event.properties.conversion.totalSteps;
          properties.conversion_value = event.properties.conversion.value;
        }
        break;
      
      case 'error':
        if ('error' in event.properties) {
          properties.error_type = event.properties.error.type;
          properties.error_message = event.properties.error.message;
          properties.error_severity = event.properties.error.severity;
        }
        break;
    }

    // Remove undefined values
    Object.keys(properties).forEach(key => {
      if (properties[key] === undefined) {
        delete properties[key];
      }
    });

    return {
      event: event.event,
      properties
    };
  }

  /**
   * Get Mixpanel instance (for advanced usage)
   */
  getInstance(): typeof mixpanel | Mixpanel.Mixpanel | undefined {
    return this.isClient ? this.clientInstance : this.serverInstance;
  }
}
