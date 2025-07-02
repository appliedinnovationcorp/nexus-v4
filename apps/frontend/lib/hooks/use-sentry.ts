'use client';

import { useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { SentryClient, SentryUser, SentryContext, SentryTags } from '../sentry';

/**
 * Hook for Sentry integration in React components
 */
export function useSentry(user?: SentryUser) {
  const pathname = usePathname();

  // Set user context when user changes
  useEffect(() => {
    if (user) {
      SentryClient.setUser(user);
    }
  }, [user]);

  // Capture page views
  useEffect(() => {
    SentryClient.capturePageView(pathname, user, {
      referrer: document.referrer,
      userAgent: navigator.userAgent,
    });
  }, [pathname, user]);

  // Capture exception with component context
  const captureException = useCallback(
    (
      error: Error,
      context?: Omit<SentryContext, 'page'>,
      tags?: SentryTags,
    ) => {
      return SentryClient.captureException(
        error,
        {
          page: pathname,
          url: window.location.href,
          referrer: document.referrer,
          userAgent: navigator.userAgent,
          ...context,
        },
        user,
        {
          page: pathname,
          ...tags,
        },
      );
    },
    [pathname, user],
  );

  // Capture message with component context
  const captureMessage = useCallback(
    (
      message: string,
      level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info',
      context?: Omit<SentryContext, 'page'>,
      tags?: SentryTags,
    ) => {
      return SentryClient.captureMessage(
        message,
        level,
        {
          page: pathname,
          url: window.location.href,
          referrer: document.referrer,
          userAgent: navigator.userAgent,
          ...context,
        },
        user,
        {
          page: pathname,
          ...tags,
        },
      );
    },
    [pathname, user],
  );

  // Add breadcrumb
  const addBreadcrumb = useCallback(
    (
      message: string,
      category: string = 'custom',
      level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info',
      data?: Record<string, any>,
    ) => {
      SentryClient.addBreadcrumb(message, category, level, {
        page: pathname,
        ...data,
      });
    },
    [pathname],
  );

  // Capture user interaction
  const captureUserInteraction = useCallback(
    (action: string, component: string, additionalData?: Record<string, any>) => {
      SentryClient.captureUserInteraction(action, component, {
        page: pathname,
        ...additionalData,
      });
    },
    [pathname],
  );

  // Capture form submission
  const captureFormSubmission = useCallback(
    (
      formName: string,
      success: boolean,
      error?: Error,
      additionalData?: Record<string, any>,
    ) => {
      SentryClient.captureFormSubmission(formName, success, error, {
        page: pathname,
        ...additionalData,
      });
    },
    [pathname],
  );

  // Capture API call
  const captureApiCall = useCallback(
    (
      method: string,
      url: string,
      status?: number,
      duration?: number,
      error?: Error,
    ) => {
      SentryClient.captureApiCall(method, url, status, duration, error);
    },
    [],
  );

  // Capture performance timing
  const capturePerformance = useCallback(
    (name: string, duration: number, additionalData?: Record<string, any>) => {
      SentryClient.capturePerformance(name, duration, {
        page: pathname,
        ...additionalData,
      });
    },
    [pathname],
  );

  // Show feedback dialog
  const showFeedbackDialog = useCallback(() => {
    SentryClient.showReportDialog({
      user,
      title: 'Report a Problem',
      subtitle: 'Help us improve by reporting what went wrong.',
    });
  }, [user]);

  return {
    captureException,
    captureMessage,
    addBreadcrumb,
    captureUserInteraction,
    captureFormSubmission,
    captureApiCall,
    capturePerformance,
    showFeedbackDialog,
  };
}

/**
 * Hook for error boundary integration
 */
export function useSentryErrorBoundary() {
  const pathname = usePathname();

  const captureError = useCallback(
    (error: Error, errorInfo: { componentStack: string }) => {
      SentryClient.captureException(
        error,
        {
          page: pathname,
          component: 'ErrorBoundary',
          action: 'component_error',
          url: window.location.href,
        },
        undefined,
        {
          page: pathname,
          errorBoundary: 'true',
        },
      );

      // Add component stack as context
      SentryClient.setContext('errorBoundary', {
        componentStack: errorInfo.componentStack,
        page: pathname,
        timestamp: new Date().toISOString(),
      });
    },
    [pathname],
  );

  return { captureError };
}
