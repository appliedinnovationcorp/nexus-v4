import { useState, useEffect, useCallback } from 'react'
import { ApiResponse, ApiError } from '../utils/api'

export interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: ApiError | null
}

export interface UseApiOptions {
  immediate?: boolean
  onSuccess?: (data: any) => void
  onError?: (error: ApiError) => void
}

/**
 * Custom hook for making API requests with loading and error states
 */
export function useApi<T = any>(
  apiFunction: () => Promise<ApiResponse<T>>,
  options: UseApiOptions = {}
) {
  const { immediate = true, onSuccess, onError } = options

  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await apiFunction()
      setState({
        data: response.data || null,
        loading: false,
        error: null,
      })

      if (onSuccess && response.data) {
        onSuccess(response.data)
      }

      return response
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError({
        message: error instanceof Error ? error.message : 'Unknown error',
        status: 0,
      })

      setState({
        data: null,
        loading: false,
        error: apiError,
      })

      if (onError) {
        onError(apiError)
      }

      throw apiError
    }
  }, [apiFunction, onSuccess, onError])

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    })
  }, [])

  useEffect(() => {
    if (immediate) {
      execute()
    }
  }, [execute, immediate])

  return {
    ...state,
    execute,
    reset,
  }
}

/**
 * Custom hook for making API requests with manual trigger
 */
export function useApiMutation<T = any, P = any>(
  apiFunction: (params: P) => Promise<ApiResponse<T>>,
  options: UseApiOptions = {}
) {
  const { onSuccess, onError } = options

  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const mutate = useCallback(async (params: P) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await apiFunction(params)
      setState({
        data: response.data || null,
        loading: false,
        error: null,
      })

      if (onSuccess && response.data) {
        onSuccess(response.data)
      }

      return response
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError({
        message: error instanceof Error ? error.message : 'Unknown error',
        status: 0,
      })

      setState({
        data: null,
        loading: false,
        error: apiError,
      })

      if (onError) {
        onError(apiError)
      }

      throw apiError
    }
  }, [apiFunction, onSuccess, onError])

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    })
  }, [])

  return {
    ...state,
    mutate,
    reset,
  }
}

/**
 * Custom hook for paginated API requests
 */
export function usePaginatedApi<T = any>(
  apiFunction: (page: number, limit: number, ...args: any[]) => Promise<ApiResponse<T>>,
  initialPage: number = 1,
  initialLimit: number = 10,
  options: UseApiOptions = {}
) {
  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)
  const [allData, setAllData] = useState<T[]>([])

  const apiCall = useCallback(() => {
    return apiFunction(page, limit)
  }, [apiFunction, page, limit])

  const { data, loading, error, execute } = useApi(apiCall, {
    ...options,
    onSuccess: (newData) => {
      if (page === 1) {
        setAllData(Array.isArray(newData) ? newData : [])
      } else {
        setAllData(prev => [...prev, ...(Array.isArray(newData) ? newData : [])])
      }
      options.onSuccess?.(newData)
    },
  })

  const loadMore = useCallback(() => {
    setPage(prev => prev + 1)
  }, [])

  const refresh = useCallback(() => {
    setPage(1)
    setAllData([])
    execute()
  }, [execute])

  const changeLimit = useCallback((newLimit: number) => {
    setLimit(newLimit)
    setPage(1)
    setAllData([])
  }, [])

  return {
    data,
    allData,
    loading,
    error,
    page,
    limit,
    loadMore,
    refresh,
    changeLimit,
    execute,
  }
}
