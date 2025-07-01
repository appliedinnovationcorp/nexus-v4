import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus, Theme } from '@prisma/client';
import { Exclude, Expose, Type } from 'class-transformer';

export class UserProfileDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: Theme })
  theme: Theme;

  @ApiProperty()
  language: string;

  @ApiProperty()
  timezone: string;

  @ApiProperty()
  notificationsEmail: boolean;

  @ApiProperty()
  notificationsPush: boolean;

  @ApiProperty()
  notificationsSms: boolean;

  @ApiProperty()
  profileVisible: boolean;

  @ApiProperty()
  activityVisible: boolean;

  @ApiProperty({ required: false })
  socialLinks?: any;

  @ApiProperty({ required: false })
  customSettings?: any;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class UserResponseDto {
  @ApiProperty({
    description: 'User unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Unique username',
    example: 'johndoe',
  })
  username: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  lastName: string;

  @ApiProperty({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  avatarUrl?: string;

  @ApiProperty({
    description: 'User bio',
    example: 'Software developer passionate about web technologies',
    required: false,
  })
  bio?: string;

  @ApiProperty({
    description: 'User website URL',
    example: 'https://johndoe.dev',
    required: false,
  })
  website?: string;

  @ApiProperty({
    description: 'User location',
    example: 'San Francisco, CA',
    required: false,
  })
  location?: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
  })
  role: UserRole;

  @ApiProperty({
    description: 'User status',
    enum: UserStatus,
  })
  status: UserStatus;

  @ApiProperty({
    description: 'Email verification status',
  })
  emailVerified: boolean;

  @ApiProperty({
    description: 'Email verification timestamp',
    required: false,
  })
  emailVerifiedAt?: Date;

  @ApiProperty({
    description: 'Last login timestamp',
    required: false,
  })
  lastLoginAt?: Date;

  @ApiProperty({
    description: 'User creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'User last update timestamp',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'User profile',
    type: UserProfileDto,
    required: false,
  })
  @Type(() => UserProfileDto)
  profile?: UserProfileDto;

  // Exclude sensitive fields
  @Exclude()
  passwordHash: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}

export class UserListResponseDto {
  @ApiProperty({
    description: 'List of users',
    type: [UserResponseDto],
  })
  @Type(() => UserResponseDto)
  users: UserResponseDto[];

  @ApiProperty({
    description: 'Total number of users',
  })
  total: number;

  @ApiProperty({
    description: 'Current page',
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
  })
  totalPages: number;

  @ApiProperty({
    description: 'Has next page',
  })
  hasNext: boolean;

  @ApiProperty({
    description: 'Has previous page',
  })
  hasPrev: boolean;
}
