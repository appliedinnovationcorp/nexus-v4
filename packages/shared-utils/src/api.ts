/**
 * API utility functions for Nexus workspace
 * Shared between frontend and backend applications
 */

import type { ApiResponse, ErrorResponse } from '@nexus/shared-types';

/**
 * Creates a standardized API response
 */
export function createApiResponse<T>(
  data: T,
  message?: string,
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Creates a standardized API error response
 */
export function createErrorResponse(
  error: string,
  code?: string,
  details?: Record<string, unknown>,
): ErrorResponse {
  return {
    success: false,
    error,
    code,
    details,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Checks if a response is an error response
 */
export function isErrorResponse(
  response: ApiResponse | ErrorResponse,
): response is ErrorResponse {
  return !response.success;
}

/**
 * Extracts data from API response or throws error
 */
export function extractApiData<T>(response: ApiResponse<T>): T {
  if (isErrorResponse(response)) {
    throw new Error(response.error);
  }
  
  if (response.data === undefined) {
    throw new Error('No data in response');
  }
  
  return response.data;
}

/**
 * Creates a fetch wrapper with common error handling
 */
export async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
): Promise<ApiResponse<T> | ErrorResponse> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      return createErrorResponse(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status.toString(),
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      'NETWORK_ERROR',
    );
  }
}
