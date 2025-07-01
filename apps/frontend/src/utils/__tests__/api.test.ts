import { ApiClient, ApiError, userApi, healthApi } from '../api'

// Mock fetch globally
global.fetch = jest.fn()

describe('ApiClient', () => {
  let apiClient: ApiClient
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    apiClient = new ApiClient('http://localhost:3001/api')
    mockFetch.mockClear()
  })

  describe('constructor', () => {
    it('should use default base URL when none provided', () => {
      const client = new ApiClient()
      expect(client).toBeDefined()
    })

    it('should use provided base URL', () => {
      const client = new ApiClient('http://custom-api.com')
      expect(client).toBeDefined()
    })
  })

  describe('get', () => {
    it('should make GET request successfully', async () => {
      const mockData = { id: 1, name: 'Test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response)

      const result = await apiClient.get('/test')

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      expect(result).toEqual({
        data: mockData,
        status: 200,
      })
    })

    it('should handle GET request errors', async () => {
      const errorData = { message: 'Not found' }
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => errorData,
      } as Response)

      await expect(apiClient.get('/not-found')).rejects.toThrow(ApiError)
    })
  })

  describe('post', () => {
    it('should make POST request with data', async () => {
      const requestData = { name: 'New Item' }
      const responseData = { id: 1, name: 'New Item' }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => responseData,
      } as Response)

      const result = await apiClient.post('/items', requestData)

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })
      expect(result).toEqual({
        data: responseData,
        status: 201,
      })
    })

    it('should make POST request without data', async () => {
      const responseData = { success: true }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => responseData,
      } as Response)

      const result = await apiClient.post('/action')

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: undefined,
      })
      expect(result).toEqual({
        data: responseData,
        status: 200,
      })
    })
  })

  describe('put', () => {
    it('should make PUT request with data', async () => {
      const requestData = { name: 'Updated Item' }
      const responseData = { id: 1, name: 'Updated Item' }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => responseData,
      } as Response)

      const result = await apiClient.put('/items/1', requestData)

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/items/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })
      expect(result).toEqual({
        data: responseData,
        status: 200,
      })
    })
  })

  describe('patch', () => {
    it('should make PATCH request with data', async () => {
      const requestData = { name: 'Patched Item' }
      const responseData = { id: 1, name: 'Patched Item' }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => responseData,
      } as Response)

      const result = await apiClient.patch('/items/1', requestData)

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/items/1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })
      expect(result).toEqual({
        data: responseData,
        status: 200,
      })
    })
  })

  describe('delete', () => {
    it('should make DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
      } as Response)

      const result = await apiClient.delete('/items/1')

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/items/1', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      expect(result).toEqual({
        data: {},
        status: 204,
      })
    })
  })

  describe('error handling', () => {
    it('should throw ApiError for HTTP errors', async () => {
      const errorData = { message: 'Validation failed', details: { field: 'required' } }
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => errorData,
      } as Response)

      try {
        await apiClient.get('/invalid')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect(error.message).toBe('Validation failed')
        expect(error.status).toBe(400)
        expect(error.details).toEqual(errorData)
      }
    })

    it('should throw ApiError for network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      try {
        await apiClient.get('/test')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect(error.message).toBe('Network error')
        expect(error.status).toBe(0)
      }
    })

    it('should handle unknown errors', async () => {
      mockFetch.mockRejectedValueOnce('Unknown error')

      try {
        await apiClient.get('/test')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect(error.message).toBe('Network error')
        expect(error.status).toBe(0)
      }
    })
  })
})

describe('userApi', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    mockFetch.mockClear()
  })

  describe('getUsers', () => {
    it('should get users without parameters', async () => {
      const mockUsers = { users: [], total: 0 }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUsers,
      } as Response)

      await userApi.getUsers()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/users'),
        expect.any(Object)
      )
    })

    it('should get users with parameters', async () => {
      const mockUsers = { users: [], total: 0 }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUsers,
      } as Response)

      await userApi.getUsers({ page: 2, limit: 20, search: 'test' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/users?page=2&limit=20&search=test'),
        expect.any(Object)
      )
    })
  })

  describe('getUser', () => {
    it('should get user by id', async () => {
      const mockUser = { id: '123', name: 'Test User' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUser,
      } as Response)

      await userApi.getUser('123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/123'),
        expect.any(Object)
      )
    })
  })

  describe('createUser', () => {
    it('should create user', async () => {
      const userData = { name: 'New User', email: 'new@example.com' }
      const mockUser = { id: '123', ...userData }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockUser,
      } as Response)

      await userApi.createUser(userData)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/users'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(userData),
        })
      )
    })
  })

  describe('updateUser', () => {
    it('should update user', async () => {
      const userData = { name: 'Updated User' }
      const mockUser = { id: '123', ...userData }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUser,
      } as Response)

      await userApi.updateUser('123', userData)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/123'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(userData),
        })
      )
    })
  })

  describe('deleteUser', () => {
    it('should delete user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
      } as Response)

      await userApi.deleteUser('123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/123'),
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('getUserStats', () => {
    it('should get user statistics', async () => {
      const mockStats = { posts: 5, followers: 10 }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockStats,
      } as Response)

      await userApi.getUserStats('123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/123/stats'),
        expect.any(Object)
      )
    })
  })
})

describe('healthApi', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    mockFetch.mockClear()
  })

  describe('checkHealth', () => {
    it('should check general health', async () => {
      const mockHealth = { status: 'ok' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockHealth,
      } as Response)

      await healthApi.checkHealth()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.any(Object)
      )
    })
  })

  describe('checkLiveness', () => {
    it('should check liveness', async () => {
      const mockHealth = { status: 'ok' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockHealth,
      } as Response)

      await healthApi.checkLiveness()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/health/live'),
        expect.any(Object)
      )
    })
  })

  describe('checkReadiness', () => {
    it('should check readiness', async () => {
      const mockHealth = { status: 'ok', database: { status: 'healthy' } }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockHealth,
      } as Response)

      await healthApi.checkReadiness()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/health/ready'),
        expect.any(Object)
      )
    })
  })
})
