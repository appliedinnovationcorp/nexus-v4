import { Test, TestingModule } from '@nestjs/testing'
import { UsersController } from '../users.controller'
import { UsersService } from '../users.service'
import { CreateUserDto } from '../dto/create-user.dto'
import { UpdateUserDto } from '../dto/update-user.dto'
import { UserRole, UserStatus } from '@prisma/client'

describe('UsersController', () => {
  let controller: UsersController
  let service: UsersService

  const mockUsersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByEmail: jest.fn(),
    findByUsername: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    verifyEmail: jest.fn(),
    getUserStats: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile()

    controller = module.get<UsersController>(UsersController)
    service = module.get<UsersService>(UsersService)
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

    const mockUserResponse = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('should create a user', async () => {
      mockUsersService.create.mockResolvedValue(mockUserResponse)

      const result = await controller.create(createUserDto)

      expect(service.create).toHaveBeenCalledWith(createUserDto)
      expect(result).toEqual(mockUserResponse)
    })
  })

  describe('findAll', () => {
    const mockUsersResponse = {
      users: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'user1@example.com',
          username: 'user1',
          firstName: 'User',
          lastName: 'One',
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    }

    it('should return paginated users with default parameters', async () => {
      mockUsersService.findAll.mockResolvedValue(mockUsersResponse)

      const result = await controller.findAll(1, 10)

      expect(service.findAll).toHaveBeenCalledWith(1, 10, undefined, undefined, undefined)
      expect(result).toEqual(mockUsersResponse)
    })

    it('should return filtered users', async () => {
      mockUsersService.findAll.mockResolvedValue(mockUsersResponse)

      const result = await controller.findAll(1, 10, 'search', 'USER', UserStatus.ACTIVE)

      expect(service.findAll).toHaveBeenCalledWith(1, 10, 'search', 'USER', UserStatus.ACTIVE)
      expect(result).toEqual(mockUsersResponse)
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
    }

    it('should return a user by id', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser)

      const result = await controller.findOne('123e4567-e89b-12d3-a456-426614174000')

      expect(service.findOne).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000')
      expect(result).toEqual(mockUser)
    })
  })

  describe('findByEmail', () => {
    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      username: 'testuser',
    }

    it('should return a user by email', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser)

      const result = await controller.findByEmail('test@example.com')

      expect(service.findByEmail).toHaveBeenCalledWith('test@example.com')
      expect(result).toEqual(mockUser)
    })

    it('should throw error if user not found by email', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null)

      await expect(controller.findByEmail('notfound@example.com')).rejects.toThrow('User not found')
    })
  })

  describe('findByUsername', () => {
    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      username: 'testuser',
    }

    it('should return a user by username', async () => {
      mockUsersService.findByUsername.mockResolvedValue(mockUser)

      const result = await controller.findByUsername('testuser')

      expect(service.findByUsername).toHaveBeenCalledWith('testuser')
      expect(result).toEqual(mockUser)
    })

    it('should throw error if user not found by username', async () => {
      mockUsersService.findByUsername.mockResolvedValue(null)

      await expect(controller.findByUsername('notfound')).rejects.toThrow('User not found')
    })
  })

  describe('update', () => {
    const updateUserDto: UpdateUserDto = {
      firstName: 'Updated',
      lastName: 'User',
    }

    const mockUpdatedUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      firstName: 'Updated',
      lastName: 'User',
    }

    it('should update a user', async () => {
      mockUsersService.update.mockResolvedValue(mockUpdatedUser)

      const result = await controller.update('123e4567-e89b-12d3-a456-426614174000', updateUserDto)

      expect(service.update).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', updateUserDto)
      expect(result).toEqual(mockUpdatedUser)
    })
  })

  describe('remove', () => {
    it('should delete a user', async () => {
      mockUsersService.remove.mockResolvedValue(undefined)

      await controller.remove('123e4567-e89b-12d3-a456-426614174000')

      expect(service.remove).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000')
    })
  })

  describe('verifyEmail', () => {
    const mockVerifiedUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    }

    it('should verify user email', async () => {
      mockUsersService.verifyEmail.mockResolvedValue(mockVerifiedUser)

      const result = await controller.verifyEmail('123e4567-e89b-12d3-a456-426614174000')

      expect(service.verifyEmail).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000')
      expect(result).toEqual(mockVerifiedUser)
    })
  })

  describe('getUserStats', () => {
    const mockStats = {
      counts: {
        posts: 5,
        comments: 10,
        likes: 15,
        followers: 2,
        follows: 3,
      },
      recentActivity: [],
      joinedAt: new Date(),
      lastActive: new Date(),
    }

    it('should return user statistics', async () => {
      mockUsersService.getUserStats.mockResolvedValue(mockStats)

      const result = await controller.getUserStats('123e4567-e89b-12d3-a456-426614174000')

      expect(service.getUserStats).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000')
      expect(result).toEqual(mockStats)
    })
  })
})
