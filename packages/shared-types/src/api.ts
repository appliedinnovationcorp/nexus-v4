/**
 * Shared API types for Nexus workspace
 * Used across frontend and backend applications
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database?: 'connected' | 'disconnected';
    redis?: 'connected' | 'disconnected';
    external?: 'connected' | 'disconnected';
  };
}

export interface ErrorResponse extends ApiResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}
