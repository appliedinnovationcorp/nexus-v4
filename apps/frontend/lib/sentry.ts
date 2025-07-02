import * as Sentry from '@sentry/nextjs';

export interface SentryUser {
  id?: string;
  email?: string;
  username?: string;
}

export interface SentryContext {
  page?: string;
  component?: string;
  action?: string;
  feature?: string;
  userAgent?: string;
  url?: string;
  referrer?: string;
}

export interface SentryTags {
  environment?: string;
  service?: string;
  version?: string;
  feature?: string;
  component?: string;
  page?: string;
  [key: string]: string | undefined;
}

/**
 * Sentry utility functions for the frontend
 */
export class SentryClient {
  /**
   * Capture an exception with context
   */
  static captureException(
    error: Error,
    context?: SentryContext,
    user?: SentryUser,
    tags?: SentryTags,
  ): string {
    return Sentry.withScope((scope) => {
      // Set user context
      if (user) {
        scope.setUser(user);
      }

      // Set tags
      if (tags) {
        Object.entries(tags).forEach(([key, value]) => {
          if (value !== undefined) {
            scope.setTag(key, value);
          }
        });
      }

      // Set context
      if (context) {
        scope.setContext('page', {
          page: context.page,
          component: context.component,
          action: context.action,
          feature: context.feature,
          url: context.url,
          referrer: context.referrer,
          userAgent: context.userAgent,
        });
      }

      // Set level based on error type
      if (error.name === 'ValidationError' || error.name === 'UserInputError') {
        scope.setLevel('warning');
      } else if (error.name === 'NetworkError' || error.name === 'TimeoutError') {
        scope.setLevel('error');
      } else {
        scope.setLevel('error');
      }

      return Sentry.captureException(error);
    });
  }

  /**
   * Capture a message with context
   */
  static captureMessage(
    message: string,
    level: Sentry.SeverityLevel = 'info',
    context?: SentryContext,
    user?: SentryUser,
    tags?: SentryTags,
  ): string {
    return Sentry.withScope((scope) => {
      scope.setLevel(level);

      // Set user context
      if (user) {
        scope.setUser(user);
      }

      // Set tags
      if (tags) {
        Object.entries(tags).forEach(([key, value]) => {
          if (value !== undefined) {
            scope.setTag(key, value);
          }
        });
      }

      // Set context
      if (context) {
        scope.setContext('page', context);
      }

      return Sentry.captureMessage(message, level);
    });
  }

  /**
   * Add breadcrumb for tracking user actions
   */
  static addBreadcrumb(
    message: string,
    category: string = 'custom',
    level: Sentry.SeverityLevel = 'info',
    data?: Record<string, any>,
  ): void {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  }

  /**
   * Set user context
   */
  static setUser(user: SentryUser): void {
    Sentry.setUser(user);
  }

  /**
   * Set tags
   */
  static setTags(tags: SentryTags): void {
    Object.entries(tags).forEach(([key, value]) => {
      if (value !== undefined) {
        Sentry.setTag(key, value);
      }
    });
  }

  /**
   * Set context
   */
  static setContext(key: string, context: Record<string, any>): void {
    Sentry.setContext(key, context);
  }

  /**
   * Start a transaction for performance monitoring
   */
  static startTransaction(
    name: string,
    operation: string,
    description?: string,
  ): Sentry.Transaction {
    return Sentry.startTransaction({
      name,
      op: operation,
      description,
    });
  }

  /**
   * Capture user feedback
   */
  static captureUserFeedback(feedback: {
    name: string;
    email: string;
    comments: string;
    eventId?: string;
  }): void {
    Sentry.captureUserFeedback({
      name: feedback.name,
      email: feedback.email,
      comments: feedback.comments,
      event_id: feedback.eventId || Sentry.lastEventId(),
    });
  }

  /**
   * Show user feedback dialog
   */
  static showReportDialog(options?: {
    eventId?: string;
    user?: SentryUser;
    lang?: string;
    title?: string;
    subtitle?: string;
    subtitle2?: string;
    labelName?: string;
    labelEmail?: string;
    labelComments?: string;
    labelClose?: string;
    labelSubmit?: string;
    errorGeneric?: string;
    errorFormEntry?: string;
    successMessage?: string;
  }): void {
    Sentry.showReportDialog({
      eventId: options?.eventId || Sentry.lastEventId(),
      user: options?.user,
      lang: options?.lang || 'en',
      title: options?.title || 'Report a Problem',
      subtitle: options?.subtitle || 'Something went wrong. Help us fix it by providing additional details.',
      subtitle2: options?.subtitle2 || 'Your feedback helps us improve the application.',
      labelName: options?.labelName || 'Name',
      labelEmail: options?.labelEmail || 'Email',
      labelComments: options?.labelComments || 'What happened?',
      labelClose: options?.labelClose || 'Close',
      labelSubmit: options?.labelSubmit || 'Submit',
      errorGeneric: options?.errorGeneric || 'An error occurred while submitting your feedback.',
      errorFormEntry: options?.errorFormEntry || 'Please fill out all required fields.',
      successMessage: options?.successMessage || 'Thank you for your feedback!',
    });
  }

  /**
   * Flush pending events
   */
  static async flush(timeout: number = 2000): Promise<boolean> {
    return Sentry.flush(timeout);
  }

  /**
   * Get last event ID
   */
  static getLastEventId(): string | undefined {
    return Sentry.lastEventId();
  }

  /**
   * Configure scope for the current user session
   */
  static configureScope(callback: (scope: Sentry.Scope) => void): void {
    Sentry.configureScope(callback);
  }

  /**
   * Capture page view for analytics
   */
  static capturePageView(
    page: string,
    user?: SentryUser,
    additionalData?: Record<string, any>,
  ): void {
    this.addBreadcrumb(
      `Page view: ${page}`,
      'navigation',
      'info',
      {
        page,
        timestamp: new Date().toISOString(),
        ...additionalData,
      },
    );

    if (user) {
      this.setUser(user);
    }

    this.setTags({
      page,
      service: 'nexus-frontend',
    });
  }

  /**
   * Capture user interaction
   */
  static captureUserInteraction(
    action: string,
    component: string,
    additionalData?: Record<string, any>,
  ): void {
    this.addBreadcrumb(
      `User interaction: ${action} on ${component}`,
      'ui',
      'info',
      {
        action,
        component,
        timestamp: new Date().toISOString(),
        ...additionalData,
      },
    );
  }

  /**
   * Capture API call
   */
  static captureApiCall(
    method: string,
    url: string,
    status?: number,
    duration?: number,
    error?: Error,
  ): void {
    const level = error ? 'error' : status && status >= 400 ? 'warning' : 'info';
    
    this.addBreadcrumb(
      `API ${method} ${url} - ${status || 'pending'}`,
      'http',
      level,
      {
        method,
        url,
        status,
        duration,
        error: error?.message,
        timestamp: new Date().toISOString(),
      },
    );

    if (error) {
      this.captureException(error, {
        action: 'api_call',
        url,
      }, undefined, {
        apiMethod: method,
        apiUrl: url,
        apiStatus: status?.toString(),
      });
    }
  }

  /**
   * Capture form submission
   */
  static captureFormSubmission(
    formName: string,
    success: boolean,
    error?: Error,
    additionalData?: Record<string, any>,
  ): void {
    this.addBreadcrumb(
      `Form submission: ${formName} - ${success ? 'success' : 'failed'}`,
      'ui',
      success ? 'info' : 'error',
      {
        formName,
        success,
        error: error?.message,
        timestamp: new Date().toISOString(),
        ...additionalData,
      },
    );

    if (error) {
      this.captureException(error, {
        action: 'form_submission',
        component: formName,
      }, undefined, {
        formName,
        formSuccess: success.toString(),
      });
    }
  }

  /**
   * Capture performance timing
   */
  static capturePerformance(
    name: string,
    duration: number,
    additionalData?: Record<string, any>,
  ): void {
    this.addBreadcrumb(
      `Performance: ${name} took ${duration}ms`,
      'performance',
      duration > 1000 ? 'warning' : 'info',
      {
        name,
        duration,
        timestamp: new Date().toISOString(),
        ...additionalData,
      },
    );

    if (duration > 5000) {
      this.captureMessage(
        `Slow performance detected: ${name}`,
        'warning',
        {
          action: 'performance_monitoring',
          feature: name,
        },
        undefined,
        {
          performanceMetric: name,
          duration: duration.toString(),
          slow: 'true',
        },
      );
    }
  }
}
