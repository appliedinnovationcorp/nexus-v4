import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto, UserListResponseDto } from './dto/user-response.dto';
import { Prisma, UserStatus, Theme } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { plainToClass } from 'class-transformer';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: createUserDto.email },
            { username: createUserDto.username },
          ],
        },
      });

      if (existingUser) {
        if (existingUser.email === createUserDto.email) {
          throw new ConflictException('Email already exists');
        }
        if (existingUser.username === createUserDto.username) {
          throw new ConflictException('Username already exists');
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(createUserDto.password, 12);

      // Create user with profile
      const user = await this.prisma.user.create({
        data: {
          email: createUserDto.email,
          username: createUserDto.username,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          passwordHash,
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
      });

      this.logger.log(`Created user: ${user.username} (${user.id})`);

      return plainToClass(UserResponseDto, user);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error('Failed to create user:', error);
      throw new BadRequestException('Failed to create user');
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    role?: string,
    status?: UserStatus
  ): Promise<UserListResponseDto> {
    try {
      const skip = (page - 1) * limit;
      
      const where: Prisma.UserWhereInput = {};

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (role) {
        where.role = role as any;
      }

      if (status) {
        where.status = status;
      }

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
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
          skip,
          take: limit,
        }),
        this.prisma.user.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        users: users.map(user => plainToClass(UserResponseDto, user)),
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error) {
      this.logger.error('Failed to fetch users:', error);
      throw new BadRequestException('Failed to fetch users');
    }
  }

  async findOne(id: string): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
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
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return plainToClass(UserResponseDto, user);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to fetch user ${id}:`, error);
      throw new BadRequestException('Failed to fetch user');
    }
  }

  async findByEmail(email: string): Promise<UserResponseDto | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        include: {
          profile: true,
        },
      });

      return user ? plainToClass(UserResponseDto, user) : null;
    } catch (error) {
      this.logger.error(`Failed to fetch user by email ${email}:`, error);
      return null;
    }
  }

  async findByUsername(username: string): Promise<UserResponseDto | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username },
        include: {
          profile: true,
        },
      });

      return user ? plainToClass(UserResponseDto, user) : null;
    } catch (error) {
      this.logger.error(`Failed to fetch user by username ${username}:`, error);
      return null;
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    try {
      // Check if user exists
      const existingUser = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      // Check for conflicts if email or username is being updated
      if (updateUserDto.email || updateUserDto.username) {
        const conflictUser = await this.prisma.user.findFirst({
          where: {
            AND: [
              { id: { not: id } },
              {
                OR: [
                  ...(updateUserDto.email ? [{ email: updateUserDto.email }] : []),
                  ...(updateUserDto.username ? [{ username: updateUserDto.username }] : []),
                ],
              },
            ],
          },
        });

        if (conflictUser) {
          if (conflictUser.email === updateUserDto.email) {
            throw new ConflictException('Email already exists');
          }
          if (conflictUser.username === updateUserDto.username) {
            throw new ConflictException('Username already exists');
          }
        }
      }

      const user = await this.prisma.user.update({
        where: { id },
        data: updateUserDto,
        include: {
          profile: true,
        },
      });

      this.logger.log(`Updated user: ${user.username} (${user.id})`);

      return plainToClass(UserResponseDto, user);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Failed to update user ${id}:`, error);
      throw new BadRequestException('Failed to update user');
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      await this.prisma.user.delete({
        where: { id },
      });

      this.logger.log(`Deleted user: ${user.username} (${user.id})`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to delete user ${id}:`, error);
      throw new BadRequestException('Failed to delete user');
    }
  }

  async updateLastLogin(id: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id },
        data: {
          lastLoginAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update last login for user ${id}:`, error);
    }
  }

  async verifyEmail(id: string): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
        include: {
          profile: true,
        },
      });

      this.logger.log(`Email verified for user: ${user.username} (${user.id})`);

      return plainToClass(UserResponseDto, user);
    } catch (error) {
      this.logger.error(`Failed to verify email for user ${id}:`, error);
      throw new BadRequestException('Failed to verify email');
    }
  }

  async getUserStats(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: {
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
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      const recentActivity = await this.prisma.activity.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      return {
        counts: user._count,
        recentActivity,
        joinedAt: user.createdAt,
        lastActive: user.lastLoginAt,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get user stats for ${id}:`, error);
      throw new BadRequestException('Failed to get user statistics');
    }
  }
}
