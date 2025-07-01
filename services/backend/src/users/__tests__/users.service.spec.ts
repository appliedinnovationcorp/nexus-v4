import { Test, TestingModule } from '@nestjs/testing'
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common'
import { UsersService } from '../users.service'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateUserDto } from '../dto/create-user.dto'
import { UpdateUserDto } from '../dto/update-user.dto'
import { UserRole, UserStatus, Theme } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn().mockResolvedValue(true),
}))

describe('UsersService', () => {
  let service: UsersService
  let prismaService: PrismaService

  const mockPrismaService = {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    activity: {
      findMany: jest.fn(),
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    service = module.get<UsersService>(UsersService)
    prismaService = module.get<PrismaService>(PrismaService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      email: 'test@example.com',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      password: 'password123',
      role: UserRole.USER,
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
      emailVerifiedAt: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      avatarUrl: null,
      bio: null,
      website: null,
      location: null,
      profile: {
        id: '123e4567-e89b-12d3-a456-426614174001',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        theme: Theme.SYSTEM,
        language: 'en',
        timezone: 'UTC',
        notificationsEmail: true,
        notificationsPush: true,
        notificationsSms: false,
        profileVisible: true,
        activityVisible: true,
        socialLinks: null,
        customSettings: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }

    it('should create a user successfully', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null)
      mockPrismaService.user.create.mockResolvedValue(mockUser)

      const result = await service.create(createUserDto)

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: createUserDto.email },
            { username: createUserDto.username },
          ],
        },
      })

      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 12)

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: createUserDto.email,
          username: createUserDto.username,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          passwordHash: 'hashedPassword',
          role: createUserDto.role,
          bio: createUserDto.bio,
          website: createUserDto.website,
          location: createUserDto.location,
          profile: {
            create: {
              theme: Theme.SYSTEM,
              language: 'en',
              timezone: 'UTC',
              notificationsEmail: true,
              notificationsPush: true,
              notificationsSms: false,
              profileVisible: true,
              activityVisible: true,
            },
          },
        },
        include: {
          profile: true,
        },
      })

      expect(result).toBeDefined()
      expect(result.email).toBe(createUserDto.email)
      expect(result.username).toBe(createUserDto.username)
    })

    it('should throw ConflictException if email already exists', async () => {
      const existingUser = { ...mockUser, username: 'differentuser' }
      mockPrismaService.user.findFirst.mockResolvedValue(existingUser)

      await expect(service.create(createUserDto)).rejects.toThrow(
        new ConflictException('Email already exists')
      )

      expect(mockPrismaService.user.create).not.toHaveBeenCalled()
    })

    it('should throw ConflictException if username already exists', async () => {
      const existingUser = { ...mockUser, email: 'different@example.com' }
      mockPrismaService.user.findFirst.mockResolvedValue(existingUser)

      await expect(service.create(createUserDto)).rejects.toThrow(
        new ConflictException('Username already exists')
      )

      expect(mockPrismaService.user.create).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null)
      mockPrismaService.user.create.mockRejectedValue(new Error('Database error'))

      await expect(service.create(createUserDto)).rejects.toThrow(BadRequestException)
    })
  })

  describe('findAll', () => {
    const mockUsers = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user1@example.com',
        username: 'user1',
        firstName: 'User',
        lastName: 'One',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        profile: null,
        _count: {
          posts: 5,
          comments: 10,
          likes: 15,
          followers: 2,
          follows: 3,
        },
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174001',
        email: 'user2@example.com',
        username: 'user2',
        firstName: 'User',
        lastName: 'Two',
        role: UserRole.MODERATOR,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        profile: null,
        _count: {
          posts: 8,
          comments: 12,
          likes: 20,
          followers: 5,
          follows: 1,
        },
      },
    ]

    it('should return paginated users', async () => {
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers)
      mockPrismaService.user.count.mockResolvedValue(2)

      const result = await service.findAll(1, 10)

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          profile: true,
          _count: {
            select: {
              posts: true,
              comments: true,
              likes: true,
              followers: true,
              follows: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      })

      expect(result).toEqual({
        users: expect.any(Array),
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      })
    })

    it('should filter users by search term', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([mockUsers[0]])
      mockPrismaService.user.count.mockResolvedValue(1)

      await service.findAll(1, 10, 'user1')

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { firstName: { contains: 'user1', mode: 'insensitive' } },
            { lastName: { contains: 'user1', mode: 'insensitive' } },
            { username: { contains: 'user1', mode: 'insensitive' } },
            { email: { contains: 'user1', mode: 'insensitive' } },
          ],
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      })
    })

    it('should filter users by role', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([mockUsers[1]])
      mockPrismaService.user.count.mockResolvedValue(1)

      await service.findAll(1, 10, undefined, 'MODERATOR')

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { role: 'MODERATOR' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      })
    })

    it('should filter users by status', async () => {
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers)
      mockPrismaService.user.count.mockResolvedValue(2)

      await service.findAll(1, 10, undefined, undefined, UserStatus.ACTIVE)

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { status: UserStatus.ACTIVE },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      })
    })
  })

  describe('findOne', () => {
    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      profile: null,
      _count: {
        posts: 5,
        comments: 10,
        likes: 15,
        followers: 2,
        follows: 3,
      },
    }

    it('should return a user by id', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)

      const result = await service.findOne('123e4567-e89b-12d3-a456-426614174000')

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: '123e4567-e89b-12d3-a456-426614174000' },
        include: {
          profile: true,
          _count: {
            select: {
              posts: true,
              comments: true,
              likes: true,
              followers: true,
              follows: true,
            },
          },
        },
      })

      expect(result).toBeDefined()
      expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000')
    })

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null)

      await expect(
        service.findOne('123e4567-e89b-12d3-a456-426614174000')
      ).rejects.toThrow(
        new NotFoundException('User with ID 123e4567-e89b-12d3-a456-426614174000 not found')
      )
    })
  })

  describe('update', () => {
    const updateUserDto: UpdateUserDto = {
      firstName: 'Updated',
      lastName: 'User',
      bio: 'Updated bio',
    }

    const existingUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      username: 'testuser',
    }

    const updatedUser = {
      ...existingUser,
      firstName: 'Updated',
      lastName: 'User',
      bio: 'Updated bio',
      profile: null,
    }

    it('should update a user successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)
      mockPrismaService.user.update.mockResolvedValue(updatedUser)

      const result = await service.update('123e4567-e89b-12d3-a456-426614174000', updateUserDto)

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: '123e4567-e89b-12d3-a456-426614174000' },
      })

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: '123e4567-e89b-12d3-a456-426614174000' },
        data: updateUserDto,
        include: {
          profile: true,
        },
      })

      expect(result).toBeDefined()
      expect(result.firstName).toBe('Updated')
    })

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null)

      await expect(
        service.update('123e4567-e89b-12d3-a456-426614174000', updateUserDto)
      ).rejects.toThrow(
        new NotFoundException('User with ID 123e4567-e89b-12d3-a456-426614174000 not found')
      )

      expect(mockPrismaService.user.update).not.toHaveBeenCalled()
    })

    it('should check for email conflicts when updating email', async () => {
      const updateWithEmail = { ...updateUserDto, email: 'newemail@example.com' }
      
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)
      mockPrismaService.user.findFirst.mockResolvedValue(null)
      mockPrismaService.user.update.mockResolvedValue({ ...updatedUser, email: 'newemail@example.com' })

      await service.update('123e4567-e89b-12d3-a456-426614174000', updateWithEmail)

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          AND: [
            { id: { not: '123e4567-e89b-12d3-a456-426614174000' } },
            {
              OR: [
                { email: 'newemail@example.com' },
              ],
            },
          ],
        },
      })
    })
  })

  describe('remove', () => {
    const existingUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      username: 'testuser',
    }

    it('should delete a user successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)
      mockPrismaService.user.delete.mockResolvedValue(existingUser)

      await service.remove('123e4567-e89b-12d3-a456-426614174000')

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: '123e4567-e89b-12d3-a456-426614174000' },
      })

      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: '123e4567-e89b-12d3-a456-426614174000' },
      })
    })

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null)

      await expect(
        service.remove('123e4567-e89b-12d3-a456-426614174000')
      ).rejects.toThrow(
        new NotFoundException('User with ID 123e4567-e89b-12d3-a456-426614174000 not found')
      )

      expect(mockPrismaService.user.delete).not.toHaveBeenCalled()
    })
  })

  describe('getUserStats', () => {
    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      createdAt: new Date('2023-01-01'),
      lastLoginAt: new Date('2023-12-01'),
      _count: {
        posts: 5,
        comments: 10,
        likes: 15,
        followers: 2,
        follows: 3,
      },
    }

    const mockActivities = [
      {
        id: '1',
        type: 'LOGIN',
        description: 'User logged in',
        createdAt: new Date(),
      },
      {
        id: '2',
        type: 'POST_CREATE',
        description: 'Created a new post',
        createdAt: new Date(),
      },
    ]

    it('should return user statistics', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
      mockPrismaService.activity.findMany.mockResolvedValue(mockActivities)

      const result = await service.getUserStats('123e4567-e89b-12d3-a456-426614174000')

      expect(result).toEqual({
        counts: mockUser._count,
        recentActivity: mockActivities,
        joinedAt: mockUser.createdAt,
        lastActive: mockUser.lastLoginAt,
      })
    })

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null)

      await expect(
        service.getUserStats('123e4567-e89b-12d3-a456-426614174000')
      ).rejects.toThrow(
        new NotFoundException('User with ID 123e4567-e89b-12d3-a456-426614174000 not found')
      )
    })
  })
})
