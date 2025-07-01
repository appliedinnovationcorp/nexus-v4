import { renderHook, act } from '@testing-library/react'
import { useApi, useApiMutation, usePaginatedApi } from '../useApi'
import { ApiResponse, ApiError } from '../../utils/api'

describe('useApi', () => {
  const mockApiFunction = jest.fn()

  beforeEach(() => {
    mockApiFunction.mockClear()
  })

  it('should initialize with default state', () => {
    mockApiFunction.mockResolvedValue({ data: null, status: 200 })
    
    const { result } = renderHook(() => 
      useApi(mockApiFunction, { immediate: false })
    )

    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should execute API call immediately by default', async () => {
    const mockData = { id: 1, name: 'Test' }
    mockApiFunction.mockResolvedValue({ data: mockData, status: 200 })

    const { result } = renderHook(() => useApi(mockApiFunction))

    expect(result.current.loading).toBe(true)
    expect(mockApiFunction).toHaveBeenCalledTimes(1)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(result.current.data).toEqual(mockData)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should not execute immediately when immediate is false', () => {
    mockApiFunction.mockResolvedValue({ data: null, status: 200 })

    const { result } = renderHook(() => 
      useApi(mockApiFunction, { immediate: false })
    )

    expect(result.current.loading).toBe(false)
    expect(mockApiFunction).not.toHaveBeenCalled()
  })

  it('should handle API errors', async () => {
    const apiError = new ApiError({ message: 'Test error', status: 400 })
    mockApiFunction.mockRejectedValue(apiError)

    const { result } = renderHook(() => useApi(mockApiFunction))

    expect(result.current.loading).toBe(true)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toEqual(apiError)
  })

  it('should handle non-ApiError exceptions', async () => {
    const error = new Error('Network error')
    mockApiFunction.mockRejectedValue(error)

    const { result } = renderHook(() => useApi(mockApiFunction))

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(result.current.error).toBeInstanceOf(ApiError)
    expect(result.current.error?.message).toBe('Network error')
  })

  it('should call onSuccess callback', async () => {
    const mockData = { id: 1, name: 'Test' }
    const onSuccess = jest.fn()
    mockApiFunction.mockResolvedValue({ data: mockData, status: 200 })

    renderHook(() => useApi(mockApiFunction, { onSuccess }))

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(onSuccess).toHaveBeenCalledWith(mockData)
  })

  it('should call onError callback', async () => {
    const apiError = new ApiError({ message: 'Test error', status: 400 })
    const onError = jest.fn()
    mockApiFunction.mockRejectedValue(apiError)

    renderHook(() => useApi(mockApiFunction, { onError }))

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(onError).toHaveBeenCalledWith(apiError)
  })

  it('should execute manually', async () => {
    const mockData = { id: 1, name: 'Test' }
    mockApiFunction.mockResolvedValue({ data: mockData, status: 200 })

    const { result } = renderHook(() => 
      useApi(mockApiFunction, { immediate: false })
    )

    expect(mockApiFunction).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.execute()
    })

    expect(mockApiFunction).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual(mockData)
  })

  it('should reset state', async () => {
    const mockData = { id: 1, name: 'Test' }
    mockApiFunction.mockResolvedValue({ data: mockData, status: 200 })

    const { result } = renderHook(() => useApi(mockApiFunction))

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(result.current.data).toEqual(mockData)

    act(() => {
      result.current.reset()
    })

    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })
})

describe('useApiMutation', () => {
  const mockApiFunction = jest.fn()

  beforeEach(() => {
    mockApiFunction.mockClear()
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useApiMutation(mockApiFunction))

    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should not execute automatically', () => {
    renderHook(() => useApiMutation(mockApiFunction))

    expect(mockApiFunction).not.toHaveBeenCalled()
  })

  it('should execute mutation with parameters', async () => {
    const mockData = { id: 1, name: 'Created' }
    const params = { name: 'New Item' }
    mockApiFunction.mockResolvedValue({ data: mockData, status: 201 })

    const { result } = renderHook(() => useApiMutation(mockApiFunction))

    await act(async () => {
      await result.current.mutate(params)
    })

    expect(mockApiFunction).toHaveBeenCalledWith(params)
    expect(result.current.data).toEqual(mockData)
    expect(result.current.loading).toBe(false)
  })

  it('should handle mutation errors', async () => {
    const apiError = new ApiError({ message: 'Validation failed', status: 400 })
    mockApiFunction.mockRejectedValue(apiError)

    const { result } = renderHook(() => useApiMutation(mockApiFunction))

    await act(async () => {
      try {
        await result.current.mutate({ invalid: 'data' })
      } catch (error) {
        // Expected to throw
      }
    })

    expect(result.current.error).toEqual(apiError)
    expect(result.current.loading).toBe(false)
  })

  it('should call onSuccess callback on mutation', async () => {
    const mockData = { id: 1, name: 'Created' }
    const onSuccess = jest.fn()
    mockApiFunction.mockResolvedValue({ data: mockData, status: 201 })

    const { result } = renderHook(() => 
      useApiMutation(mockApiFunction, { onSuccess })
    )

    await act(async () => {
      await result.current.mutate({ name: 'New Item' })
    })

    expect(onSuccess).toHaveBeenCalledWith(mockData)
  })
})

describe('usePaginatedApi', () => {
  const mockApiFunction = jest.fn()

  beforeEach(() => {
    mockApiFunction.mockClear()
  })

  it('should initialize with default pagination', () => {
    mockApiFunction.mockResolvedValue({ data: [], status: 200 })

    const { result } = renderHook(() => 
      usePaginatedApi(mockApiFunction, 1, 10, { immediate: false })
    )

    expect(result.current.page).toBe(1)
    expect(result.current.limit).toBe(10)
    expect(result.current.allData).toEqual([])
  })

  it('should load first page', async () => {
    const mockData = [{ id: 1 }, { id: 2 }]
    mockApiFunction.mockResolvedValue({ data: mockData, status: 200 })

    const { result } = renderHook(() => usePaginatedApi(mockApiFunction))

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(mockApiFunction).toHaveBeenCalledWith(1, 10)
    expect(result.current.allData).toEqual(mockData)
  })

  it('should load more pages', async () => {
    const page1Data = [{ id: 1 }, { id: 2 }]
    const page2Data = [{ id: 3 }, { id: 4 }]
    
    mockApiFunction
      .mockResolvedValueOnce({ data: page1Data, status: 200 })
      .mockResolvedValueOnce({ data: page2Data, status: 200 })

    const { result } = renderHook(() => usePaginatedApi(mockApiFunction))

    // Wait for first page
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(result.current.allData).toEqual(page1Data)

    // Load more
    await act(async () => {
      result.current.loadMore()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(mockApiFunction).toHaveBeenCalledWith(2, 10)
    expect(result.current.allData).toEqual([...page1Data, ...page2Data])
    expect(result.current.page).toBe(2)
  })

  it('should refresh data', async () => {
    const initialData = [{ id: 1 }]
    const refreshedData = [{ id: 2 }]
    
    mockApiFunction
      .mockResolvedValueOnce({ data: initialData, status: 200 })
      .mockResolvedValueOnce({ data: refreshedData, status: 200 })

    const { result } = renderHook(() => usePaginatedApi(mockApiFunction))

    // Wait for initial load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(result.current.allData).toEqual(initialData)

    // Refresh
    await act(async () => {
      result.current.refresh()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(result.current.page).toBe(1)
    expect(result.current.allData).toEqual(refreshedData)
  })

  it('should change limit', async () => {
    const mockData = [{ id: 1 }]
    mockApiFunction.mockResolvedValue({ data: mockData, status: 200 })

    const { result } = renderHook(() => 
      usePaginatedApi(mockApiFunction, 1, 10, { immediate: false })
    )

    act(() => {
      result.current.changeLimit(20)
    })

    expect(result.current.limit).toBe(20)
    expect(result.current.page).toBe(1)
    expect(result.current.allData).toEqual([])
  })
})
