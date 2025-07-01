import { Test, TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common'
import { AuthService } from '../auth.service'
import { UsersService } from '../../users/users.service'
import { PrismaService } from '../../prisma/prisma.service'
import { LoginDto } from '../dto/login.dto'
import { RegisterDto } from '../dto/register.dto'
import { UserRole, UserStatus } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))

describe('AuthService', () => {
  let service: AuthService
  let usersService: UsersService
  let jwtService: JwtService
  let prismaService: PrismaService
  let configService: ConfigService

  const mockUsersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
  }

  const mockJwtService = {
    signAsync: jest.fn(),
    verify: jest.fn(),
  }

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    passwordReset: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    activity: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  }

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        JWT_SECRET: 'test-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        JWT_ISSUER: 'nexus-api',
        JWT_AUDIENCE: 'nexus-app',
      }
      return config[key]
    }),
  }

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    passwordHash: 'hashedPassword',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    emailVerified: false,
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
    usersService = module.get<UsersService>(UsersService)
    jwtService = module.get<JwtService>(JwtService)
    prismaService = module.get<PrismaService>(PrismaService)
    configService = module.get<ConfigService>(ConfigService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('validateUser', () => {
    it('should return user without password when credentials are valid', async () => {
      const email = 'test@example.com'
      const password = 'password123'

      mockUsersService.findByEmail.mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
      mockPrismaService.user.update.mockResolvedValue(mockUser)

      const result = await service.validateUser(email, password)

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(email)
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.passwordHash)
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      })
      expect(result).toEqual(expect.objectContaining({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
      }))
      expect(result.passwordHash).toBeUndefined()
    })

    it('should return null when user is not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null)

      const result = await service.validateUser('nonexistent@example.com', 'password')

      expect(result).toBeNull()
    })

    it('should return null when password is invalid', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

      const result = await service.validateUser('test@example.com', 'wrongpassword')

      expect(result).toBeNull()
    })
  })

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    }

    it('should return auth response when login is successful', async () => {
      const validatedUser = { ...mockUser }
      delete validatedUser.passwordHash

      jest.spyOn(service, 'validateUser').mockResolvedValue(validatedUser)
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token')
      mockPrismaService.refreshToken.create.mockResolvedValue({})
      mockPrismaService.activity.create.mockResolvedValue({})

      const result = await service.login(loginDto)

      expect(result).toEqual({
        user: {
          id: validatedUser.id,
          email: validatedUser.email,
          username: validatedUser.username,
          firstName: validatedUser.firstName,
          lastName: validatedUser.lastName,
          role: validatedUser.role,
          emailVerified: validatedUser.emailVerified,
          avatarUrl: validatedUser.avatarUrl,
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900, // 15 minutes
          tokenType: 'Bearer',
        },
      })
    })

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      jest.spyOn(service, 'validateUser').mockResolvedValue(null)

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials')
      )
    })

    it('should throw UnauthorizedException when user account is not active', async () => {
      const inactiveUser = { ...mockUser, status: UserStatus.INACTIVE }
      delete inactiveUser.passwordHash

      jest.spyOn(service, 'validateUser').mockResolvedValue(inactiveUser)

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Account is not active')
      )
    })
  })

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      username: 'newuser',
      firstName: 'New',
      lastName: 'User',
      password: 'Password123!',
    }

    it('should register user successfully', async () => {
      const createdUser = {
        ...mockUser,
        email: registerDto.email,
        username: registerDto.username,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      }

      mockPrismaService.user.findFirst.mockResolvedValue(null)
      mockUsersService.create.mockResolvedValue(createdUser)
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token')
      mockPrismaService.refreshToken.create.mockResolvedValue({})
      mockPrismaService.activity.create.mockResolvedValue({})

      const result = await service.register(registerDto)

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: registerDto.email },
            { username: registerDto.username },
          ],
        },
      })
      expect(mockUsersService.create).toHaveBeenCalledWith({
        ...registerDto,
        role: 'USER',
      })
      expect(result.user.email).toBe(registerDto.email)
      expect(result.tokens).toBeDefined()
    })

    it('should throw ConflictException when email already exists', async () => {
      const existingUser = { ...mockUser, username: 'differentuser' }
      mockPrismaService.user.findFirst.mockResolvedValue(existingUser)

      await expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException('Email already exists')
      )
    })

    it('should throw ConflictException when username already exists', async () => {
      const existingUser = { ...mockUser, email: 'different@example.com' }
      mockPrismaService.user.findFirst.mockResolvedValue(existingUser)

      await expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException('Username already exists')
      )
    })
  })

  describe('refreshToken', () => {
    const refreshTokenDto = { refreshToken: 'valid-refresh-token' }

    it('should return new tokens when refresh token is valid', async () => {
      const payload = { sub: mockUser.id, email: mockUser.email }
      const storedToken = {
        id: 'token-id',
        token: refreshTokenDto.refreshToken,
        userId: mockUser.id,
        user: mockUser,
        expiresAt: new Date(Date.now() + 86400000), // 1 day
        revoked: false,
      }

      mockJwtService.verify.mockReturnValue(payload)
      mockPrismaService.refreshToken.findFirst.mockResolvedValue(storedToken)
      mockJwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token')
      mockPrismaService.refreshToken.update.mockResolvedValue({})
      mockPrismaService.refreshToken.create.mockResolvedValue({})

      const result = await service.refreshToken(refreshTokenDto)

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
      })
      expect(mockPrismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { id: storedToken.id },
        data: { revoked: true },
      })
    })

    it('should throw UnauthorizedException when refresh token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      await expect(service.refreshToken(refreshTokenDto)).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token')
      )
    })

    it('should throw UnauthorizedException when refresh token is not found in database', async () => {
      const payload = { sub: mockUser.id, email: mockUser.email }
      mockJwtService.verify.mockReturnValue(payload)
      mockPrismaService.refreshToken.findFirst.mockResolvedValue(null)

      await expect(service.refreshToken(refreshTokenDto)).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token')
      )
    })
  })

  describe('logout', () => {
    it('should revoke specific refresh token when provided', async () => {
      const userId = mockUser.id
      const refreshToken = 'refresh-token'

      mockPrismaService.refreshToken.updateMany.mockResolvedValue({})
      mockPrismaService.activity.create.mockResolvedValue({})

      await service.logout(userId, refreshToken)

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          token: refreshToken,
          userId,
        },
        data: { revoked: true },
      })
    })

    it('should revoke all refresh tokens when none provided', async () => {
      const userId = mockUser.id

      mockPrismaService.refreshToken.updateMany.mockResolvedValue({})
      mockPrismaService.activity.create.mockResolvedValue({})

      await service.logout(userId)

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId },
        data: { revoked: true },
      })
    })
  })

  describe('changePassword', () => {
    const changePasswordDto = {
      currentPassword: 'currentPassword',
      newPassword: 'NewPassword123!',
    }

    it('should change password successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword')
      mockPrismaService.user.update.mockResolvedValue({})
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({})
      mockPrismaService.activity.create.mockResolvedValue({})

      await service.changePassword(mockUser.id, changePasswordDto)

      expect(bcrypt.compare).toHaveBeenCalledWith(
        changePasswordDto.currentPassword,
        mockUser.passwordHash
      )
      expect(bcrypt.hash).toHaveBeenCalledWith(changePasswordDto.newPassword, 12)
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { passwordHash: 'newHashedPassword' },
      })
      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        data: { revoked: true },
      })
    })

    it('should throw UnauthorizedException when current password is incorrect', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

      await expect(
        service.changePassword(mockUser.id, changePasswordDto)
      ).rejects.toThrow(
        new UnauthorizedException('Current password is incorrect')
      )
    })

    it('should throw UnauthorizedException when user is not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null)

      await expect(
        service.changePassword('nonexistent-id', changePasswordDto)
      ).rejects.toThrow(
        new UnauthorizedException('User not found')
      )
    })
  })
})
