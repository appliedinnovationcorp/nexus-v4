// Global test setup for backend
import { ConfigService } from '@nestjs/config'

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
process.env.MONGODB_URL = 'mongodb://test:test@localhost:27017/test_db'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.SESSION_SECRET = 'test-session-secret'

// Mock ConfigService
jest.mock('@nestjs/config', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    get: jest.fn((key) => {
      const config = {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
        MONGODB_URL: 'mongodb://test:test@localhost:27017/test_db',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'test-jwt-secret',
        SESSION_SECRET: 'test-session-secret',
        PORT: 3001,
      }
      return config[key]
    }),
  })),
}))

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}

// Global test timeout
jest.setTimeout(30000)

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
})

// Global setup
beforeAll(async () => {
  // Any global setup can go here
})

// Global teardown
afterAll(async () => {
  // Any global cleanup can go here
})
