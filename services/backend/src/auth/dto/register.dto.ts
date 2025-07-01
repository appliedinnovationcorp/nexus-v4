import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  Matches,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { UserRole } from '@prisma/client'

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string

  @ApiProperty({
    description: 'Username (3-30 characters, alphanumeric and underscores only)',
    example: 'john_doe',
    minLength: 3,
    maxLength: 30,
  })
  @IsString({ message: 'Username must be a string' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(30, { message: 'Username must be at most 30 characters long' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  @IsNotEmpty({ message: 'Username is required' })
  username: string

  @ApiProperty({
    description: 'User first name',
    example: 'John',
    maxLength: 50,
  })
  @IsString({ message: 'First name must be a string' })
  @MaxLength(50, { message: 'First name must be at most 50 characters long' })
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    maxLength: 50,
  })
  @IsString({ message: 'Last name must be a string' })
  @MaxLength(50, { message: 'Last name must be at most 50 characters long' })
  @IsNotEmpty({ message: 'Last name is required' })
  lastName: string

  @ApiProperty({
    description: 'User password (minimum 8 characters, must contain uppercase, lowercase, number, and special character)',
    example: 'Password123!',
    minLength: 8,
  })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  @IsNotEmpty({ message: 'Password is required' })
  password: string

  @ApiPropertyOptional({
    description: 'User role',
    enum: UserRole,
    default: UserRole.USER,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be a valid user role' })
  role?: UserRole

  @ApiPropertyOptional({
    description: 'User bio',
    example: 'Software developer passionate about web technologies',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Bio must be a string' })
  @MaxLength(500, { message: 'Bio must be at most 500 characters long' })
  bio?: string

  @ApiPropertyOptional({
    description: 'User website URL',
    example: 'https://johndoe.dev',
  })
  @IsOptional()
  @IsString({ message: 'Website must be a string' })
  @Matches(/^https?:\/\/.+/, { message: 'Website must be a valid URL' })
  website?: string

  @ApiPropertyOptional({
    description: 'User location',
    example: 'San Francisco, CA',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Location must be a string' })
  @MaxLength(100, { message: 'Location must be at most 100 characters long' })
  location?: string
}
