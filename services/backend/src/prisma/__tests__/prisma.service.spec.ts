import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma.service'

describe('PrismaService', () => {
  let service: PrismaService
  let configService: ConfigService

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
        NODE_ENV: 'test',
      }
      return config[key]
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile()

    service = module.get<PrismaService>(PrismaService)
    configService = module.get<ConfigService>(ConfigService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined()
    })

    it('should configure database URL from config service', () => {
      expect(configService.get).toHaveBeenCalledWith('DATABASE_URL')
    })
  })

  describe('healthCheck', () => {
    it('should return healthy status when database is accessible', async () => {
      // Mock the $queryRaw method
      service.$queryRaw = jest.fn().mockResolvedValue([{ result: 1 }])

      const result = await service.healthCheck()

      expect(result).toEqual({
        status: 'healthy',
        timestamp: expect.any(Date),
      })
      expect(service.$queryRaw).toHaveBeenCalledWith(expect.anything())
    })

    it('should throw error when database is not accessible', async () => {
      // Mock the $queryRaw method to throw an error
      service.$queryRaw = jest.fn().mockRejectedValue(new Error('Connection failed'))

      await expect(service.healthCheck()).rejects.toThrow('Database connection failed')
    })
  })

  describe('getDatabaseStats', () => {
    it('should return database statistics', async () => {
      // Mock the count methods
      service.user = {
        count: jest.fn()
          .mockResolvedValueOnce(100) // total users
          .mockResolvedValueOnce(25), // active users
      } as any

      service.post = {
        count: jest.fn()
          .mockResolvedValueOnce(50) // total posts
          .mockResolvedValueOnce(10), // recent posts
      } as any

      service.comment = {
        count: jest.fn().mockResolvedValue(200), // total comments
      } as any

      const result = await service.getDatabaseStats()

      expect(result).toEqual({
        users: {
          total: 100,
          active: 25,
        },
        posts: {
          total: 50,
          recent: 10,
        },
        comments: {
          total: 200,
        },
        timestamp: expect.any(Date),
      })
    })

    it('should handle errors gracefully', async () => {
      // Mock the count methods to throw errors
      service.user = {
        count: jest.fn().mockRejectedValue(new Error('Database error')),
      } as any

      await expect(service.getDatabaseStats()).rejects.toThrow('Database error')
    })
  })

  describe('executeRaw', () => {
    it('should execute raw SQL query', async () => {
      const mockResult = [{ id: 1, name: 'test' }]
      service.$queryRawUnsafe = jest.fn().mockResolvedValue(mockResult)

      const result = await service.executeRaw('SELECT * FROM users WHERE id = ?', 1)

      expect(service.$queryRawUnsafe).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', 1)
      expect(result).toEqual(mockResult)
    })

    it('should handle raw query errors', async () => {
      service.$queryRawUnsafe = jest.fn().mockRejectedValue(new Error('SQL error'))

      await expect(service.executeRaw('INVALID SQL')).rejects.toThrow('SQL error')
    })
  })

  describe('transaction', () => {
    it('should execute transaction successfully', async () => {
      const mockResult = { success: true }
      const mockTransactionFn = jest.fn().mockResolvedValue(mockResult)
      
      service.$transaction = jest.fn().mockImplementation((fn) => fn(service))

      const result = await service.transaction(mockTransactionFn)

      expect(service.$transaction).toHaveBeenCalledWith(mockTransactionFn, undefined)
      expect(mockTransactionFn).toHaveBeenCalledWith(service)
      expect(result).toEqual(mockResult)
    })

    it('should execute transaction with options', async () => {
      const mockResult = { success: true }
      const mockTransactionFn = jest.fn().mockResolvedValue(mockResult)
      const options = { maxWait: 5000, timeout: 10000 }
      
      service.$transaction = jest.fn().mockImplementation((fn) => fn(service))

      const result = await service.transaction(mockTransactionFn, options)

      expect(service.$transaction).toHaveBeenCalledWith(mockTransactionFn, options)
      expect(result).toEqual(mockResult)
    })

    it('should handle transaction errors', async () => {
      const mockTransactionFn = jest.fn().mockRejectedValue(new Error('Transaction failed'))
      
      service.$transaction = jest.fn().mockImplementation((fn) => fn(service))

      await expect(service.transaction(mockTransactionFn)).rejects.toThrow('Transaction failed')
    })
  })
})
