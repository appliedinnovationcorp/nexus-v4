import { useCallback } from 'react'
import { useAuth } from './useAuth'
import { ApiClient, ApiResponse, ApiError } from '../utils/api'

export interface AuthenticatedApiClient {
  get: <T>(endpoint: string, options?: RequestInit) => Promise<ApiResponse<T>>
  post: <T>(endpoint: string, data?: any, options?: RequestInit) => Promise<ApiResponse<T>>
  put: <T>(endpoint: string, data?: any, options?: RequestInit) => Promise<ApiResponse<T>>
  patch: <T>(endpoint: string, data?: any, options?: RequestInit) => Promise<ApiResponse<T>>
  delete: <T>(endpoint: string, options?: RequestInit) => Promise<ApiResponse<T>>
}

export function useAuthenticatedApi(): AuthenticatedApiClient {
  const { accessToken, isAuthenticated, requireAuth } = useAuth()

  const createAuthenticatedRequest = useCallback(
    async <T>(
      method: string,
      endpoint: string,
      data?: any,
      options: RequestInit = {}
    ): Promise<ApiResponse<T>> => {
      // Ensure user is authenticated
      if (!isAuthenticated || !accessToken) {
        requireAuth()
        throw new ApiError({
          message: 'Authentication required',
          status: 401,
        })
      }

      const apiClient = new ApiClient()
      const authHeaders = {
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers,
      }

      const requestOptions = {
        ...options,
        headers: authHeaders,
      }

      try {
        switch (method.toUpperCase()) {
          case 'GET':
            return await apiClient.get<T>(endpoint, requestOptions)
          case 'POST':
            return await apiClient.post<T>(endpoint, data, requestOptions)
          case 'PUT':
            return await apiClient.put<T>(endpoint, data, requestOptions)
          case 'PATCH':
            return await apiClient.patch<T>(endpoint, data, requestOptions)
          case 'DELETE':
            return await apiClient.delete<T>(endpoint, requestOptions)
          default:
            throw new ApiError({
              message: `Unsupported HTTP method: ${method}`,
              status: 400,
            })
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          // Token might be expired, redirect to login
          requireAuth()
        }
        throw error
      }
    },
    [accessToken, isAuthenticated, requireAuth]
  )

  const get = useCallback(
    <T>(endpoint: string, options?: RequestInit) =>
      createAuthenticatedRequest<T>('GET', endpoint, undefined, options),
    [createAuthenticatedRequest]
  )

  const post = useCallback(
    <T>(endpoint: string, data?: any, options?: RequestInit) =>
      createAuthenticatedRequest<T>('POST', endpoint, data, options),
    [createAuthenticatedRequest]
  )

  const put = useCallback(
    <T>(endpoint: string, data?: any, options?: RequestInit) =>
      createAuthenticatedRequest<T>('PUT', endpoint, data, options),
    [createAuthenticatedRequest]
  )

  const patch = useCallback(
    <T>(endpoint: string, data?: any, options?: RequestInit) =>
      createAuthenticatedRequest<T>('PATCH', endpoint, data, options),
    [createAuthenticatedRequest]
  )

  const deleteRequest = useCallback(
    <T>(endpoint: string, options?: RequestInit) =>
      createAuthenticatedRequest<T>('DELETE', endpoint, undefined, options),
    [createAuthenticatedRequest]
  )

  return {
    get,
    post,
    put,
    patch,
    delete: deleteRequest,
  }
}
