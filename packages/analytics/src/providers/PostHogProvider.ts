import posthog from 'posthog-js';
import { PostHog } from 'posthog-node';
import { AnyAnalyticsEvent } from '../types/events';

/**
 * PostHog Analytics Provider
 * Handles client and server-side PostHog integration
 */
export class PostHogProvider {
  private clientInstance?: typeof posthog;
  private serverInstance?: PostHog;
  private config: {
    apiKey: string;
    host?: string;
    options?: Record<string, any>;
  };
  private isClient: boolean;

  constructor(config: { apiKey: string; host?: string; options?: Record<string, any> }) {
    this.config = config;
    this.isClient = typeof window !== 'undefined';
  }

  /**
   * Initialize PostHog
   */
  async initialize(): Promise<void> {
    try {
      if (this.isClient) {
        await this.initializeClient();
      } else {
        await this.initializeServer();
      }
    } catch (error) {
      console.error('Failed to initialize PostHog:', error);
      throw error;
    }
  }

  /**
   * Initialize client-side PostHog
   */
  private async initializeClient(): Promise<void> {
    const defaultOptions = {
      api_host: this.config.host || 'https://app.posthog.com',
      loaded: (posthog: any) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('PostHog loaded');
        }
      },
      capture_pageview: false, // We'll handle this manually
      capture_pageleave: true,
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true,
        maskInputOptions: {
          password: true,
          email: false
        },
        blockClass: 'ph-no-capture',
        blockSelector: '[data-ph-no-capture]',
        ignoreClass: 'ph-ignore-input'
      },
      autocapture: {
        dom_event_allowlist: ['click', 'change', 'submit'],
        url_allowlist: [],
        element_allowlist: ['a', 'button', 'form', 'input', 'select', 'textarea', 'label']
      },
      cross_subdomain_cookie: true,
      secure_cookie: true,
      persistence: 'localStorage+cookie',
      property_blacklist: [
        '$password',
        '$email',
        '$phone',
        '$credit_card'
      ],
      sanitize_properties: (properties: any, event: string) => {
        // Remove PII from properties
        const sanitized = { ...properties };
        
        // Remove common PII fields
        const piiFields = ['password', 'email', 'phone', 'ssn', 'credit_card', 'api_key', 'token'];
        piiFields.forEach(field => {
          if (sanitized[field]) {
            delete sanitized[field];
          }
        });

        return sanitized;
      },
      ...this.config.options
    };

    posthog.init(this.config.apiKey, defaultOptions);
    this.clientInstance = posthog;
  }

  /**
   * Initialize server-side PostHog
   */
  private async initializeServer(): Promise<void> {
    this.serverInstance = new PostHog(this.config.apiKey, {
      host: this.config.host || 'https://app.posthog.com',
      flushAt: 20,
      flushInterval: 10000,
      ...this.config.options
    });
  }

  /**
   * Identify a user
   */
  identify(userId: string, properties?: Record<string, any>): void {
    try {
      if (this.isClient && this.clientInstance) {
        this.clientInstance.identify(userId, properties);
      } else if (this.serverInstance) {
        this.serverInstance.identify({
          distinctId: userId,
          properties: properties || {}
        });
      }
    } catch (error) {
      console.error('PostHog identify error:', error);
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
        // Server-side user properties are set during identify or capture
        console.warn('Server-side setUserProperties should be called with identify');
      }
    } catch (error) {
      console.error('PostHog setUserProperties error:', error);
    }
  }

  /**
   * Track an event
   */
  track(event: AnyAnalyticsEvent): void {
    try {
      const eventData = this.transformEvent(event);
      
      if (this.isClient && this.clientInstance) {
        this.clientInstance.capture(eventData.event, eventData.properties);
      } else if (this.serverInstance) {
        this.serverInstance.capture({
          distinctId: eventData.properties.userId || eventData.properties.sessionId,
          event: eventData.event,
          properties: eventData.properties
        });
      }
    } catch (error) {
      console.error('PostHog track error:', error);
    }
  }

  /**
   * Track page view
   */
  trackPageView(url: string, properties?: Record<string, any>): void {
    try {
      if (this.isClient && this.clientInstance) {
        this.clientInstance.capture('$pageview', {
          $current_url: url,
          ...properties
        });
      } else if (this.serverInstance) {
        this.serverInstance.capture({
          distinctId: properties?.userId || properties?.sessionId || 'anonymous',
          event: '$pageview',
          properties: {
            $current_url: url,
            ...properties
          }
        });
      }
    } catch (error) {
      console.error('PostHog trackPageView error:', error);
    }
  }

  /**
   * Create feature flag evaluation
   */
  getFeatureFlag(key: string, userId?: string): boolean | string | undefined {
    try {
      if (this.isClient && this.clientInstance) {
        return this.clientInstance.getFeatureFlag(key);
      } else if (this.serverInstance && userId) {
        // Server-side feature flags require async evaluation
        console.warn('Server-side feature flags require async evaluation');
        return undefined;
      }
    } catch (error) {
      console.error('PostHog getFeatureFlag error:', error);
      return undefined;
    }
  }

  /**
   * Evaluate feature flag (async for server-side)
   */
  async evaluateFeatureFlag(key: string, userId: string): Promise<boolean | string | undefined> {
    try {
      if (this.isClient && this.clientInstance) {
        return this.clientInstance.getFeatureFlag(key);
      } else if (this.serverInstance) {
        return await this.serverInstance.getFeatureFlag(key, userId);
      }
    } catch (error) {
      console.error('PostHog evaluateFeatureFlag error:', error);
      return undefined;
    }
  }

  /**
   * Start session recording
   */
  startSessionRecording(): void {
    try {
      if (this.isClient && this.clientInstance) {
        this.clientInstance.startSessionRecording();
      }
    } catch (error) {
      console.error('PostHog startSessionRecording error:', error);
    }
  }

  /**
   * Stop session recording
   */
  stopSessionRecording(): void {
    try {
      if (this.isClient && this.clientInstance) {
        this.clientInstance.stopSessionRecording();
      }
    } catch (error) {
      console.error('PostHog stopSessionRecording error:', error);
    }
  }

  /**
   * Set consent for data collection
   */
  setConsent(consent: boolean, categories?: string[]): void {
    try {
      if (this.isClient && this.clientInstance) {
        if (consent) {
          this.clientInstance.opt_in_capturing();
        } else {
          this.clientInstance.opt_out_capturing();
        }
      }
    } catch (error) {
      console.error('PostHog setConsent error:', error);
    }
  }

  /**
   * Create cohort
   */
  async createCohort(name: string, userIds: string[]): Promise<void> {
    try {
      // PostHog cohorts are typically managed through the UI or API
      // This would require API integration
      console.log('Creating cohort:', name, 'with users:', userIds.length);
    } catch (error) {
      console.error('PostHog createCohort error:', error);
    }
  }

  /**
   * Flush pending events
   */
  async flush(): Promise<void> {
    try {
      if (this.serverInstance) {
        await this.serverInstance.flush();
      }
      // Client-side PostHog flushes automatically
    } catch (error) {
      console.error('PostHog flush error:', error);
    }
  }

  /**
   * Reset user state
   */
  reset(): void {
    try {
      if (this.isClient && this.clientInstance) {
        this.clientInstance.reset();
      } else if (this.serverInstance) {
        // Server-side doesn't maintain user state
      }
    } catch (error) {
      console.error('PostHog reset error:', error);
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
        localStorage.removeItem('ph_phc_' + this.config.apiKey + '_posthog');
      }
    } catch (error) {
      console.error('PostHog clearUserData error:', error);
    }
  }

  /**
   * Get session replay URL
   */
  getSessionReplayURL(): string | undefined {
    try {
      if (this.isClient && this.clientInstance) {
        return this.clientInstance.get_session_replay_url();
      }
    } catch (error) {
      console.error('PostHog getSessionReplayURL error:', error);
      return undefined;
    }
  }

  /**
   * Transform analytics event to PostHog format
   */
  private transformEvent(event: AnyAnalyticsEvent): { event: string; properties: Record<string, any> } {
    const properties = {
      ...event.properties,
      $event_category: event.category,
      $timestamp: event.properties.timestamp || new Date(),
      $session_id: event.properties.sessionId,
      $user_id: event.properties.userId
    };

    // Add PostHog-specific properties
    if (event.properties.device) {
      properties.$device_type = event.properties.device.type;
      properties.$os = event.properties.device.os;
      properties.$browser = event.properties.device.browser;
      properties.$viewport_width = event.properties.device.viewport.width;
      properties.$viewport_height = event.properties.device.viewport.height;
    }

    if (event.properties.location) {
      properties.$country = event.properties.location.country;
      properties.$region = event.properties.location.region;
      properties.$city = event.properties.location.city;
      properties.$timezone = event.properties.location.timezone;
    }

    if (event.properties.utm) {
      properties.$utm_source = event.properties.utm.source;
      properties.$utm_medium = event.properties.utm.medium;
      properties.$utm_campaign = event.properties.utm.campaign;
      properties.$utm_term = event.properties.utm.term;
      properties.$utm_content = event.properties.utm.content;
    }

    // Handle specific event types
    switch (event.category) {
      case 'feature':
        if ('feature' in event.properties) {
          properties.$feature_area = event.properties.feature.area;
          properties.$feature_name = event.properties.feature.name;
          properties.$feature_version = event.properties.feature.version;
        }
        break;
      
      case 'navigation':
        if ('navigation' in event.properties) {
          properties.$page_from = event.properties.navigation.from;
          properties.$page_to = event.properties.navigation.to;
          properties.$navigation_method = event.properties.navigation.method;
        }
        break;
      
      case 'error':
        if ('error' in event.properties) {
          properties.$error_type = event.properties.error.type;
          properties.$error_message = event.properties.error.message;
          properties.$error_severity = event.properties.error.severity;
        }
        break;
    }

    return {
      event: event.event,
      properties
    };
  }

  /**
   * Get PostHog instance (for advanced usage)
   */
  getInstance(): typeof posthog | PostHog | undefined {
    return this.isClient ? this.clientInstance : this.serverInstance;
  }
}
