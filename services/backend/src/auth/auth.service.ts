import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { UsersService } from '../users/users.service'
import { PrismaService } from '../prisma/prisma.service'
import { LoggerService } from '../common/logger/logger.service'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { RefreshTokenDto } from './dto/refresh-token.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import { ActivityType } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import * as crypto from 'crypto'

export interface JwtPayload {
  sub: string
  email: string
  username: string
  role: string
  iat?: number
  exp?: number
  iss?: string
  aud?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}

export interface AuthResponse {
  user: {
    id: string
    email: string
    username: string
    firstName: string
    lastName: string
    role: string
    emailVerified: boolean
    avatarUrl?: string
  }
  tokens: AuthTokens
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async validateUser(email: string, password: string, context?: { requestId?: string; ip?: string }): Promise<any> {
    try {
      this.logger.debug('Validating user credentials', {
        requestId: context?.requestId,
        operation: 'auth.validateUser',
        metadata: { email, ip: context?.ip },
      });

      const user = await this.usersService.findByEmail(email)
      if (!user) {
        this.logger.warn('User validation failed - user not found', {
          requestId: context?.requestId,
          operation: 'auth.validateUser',
          metadata: { email, ip: context?.ip },
        });
        return null
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
      if (!isPasswordValid) {
        this.logger.logSecurity('invalid_password_attempt', 'medium', {
          userId: user.id,
          email: user.email,
          ip: context?.ip,
        }, {
          requestId: context?.requestId,
          operation: 'auth.validateUser',
        });
        return null
      }

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })

      this.logger.debug('User validation successful', {
        requestId: context?.requestId,
        operation: 'auth.validateUser',
        userId: user.id,
        metadata: { email: user.email },
      });

      // Return user without password
      const { passwordHash, ...result } = user
      return result
    } catch (error) {
      this.logger.error('Error validating user', error, {
        requestId: context?.requestId,
        operation: 'auth.validateUser',
        metadata: { email, ip: context?.ip },
      });
      return null
    }
  }

  async login(loginDto: LoginDto, context?: { requestId?: string; ip?: string; userAgent?: string }): Promise<AuthResponse> {
    const { email, password } = loginDto

    this.logger.info('User login attempt', {
      requestId: context?.requestId,
      operation: 'auth.login',
      metadata: { 
        email,
        ip: context?.ip,
        userAgent: context?.userAgent,
      },
    });

    const user = await this.validateUser(email, password, context)
    if (!user) {
      this.logger.logSecurity('login_failed_invalid_credentials', 'medium', {
        email,
        ip: context?.ip,
        userAgent: context?.userAgent,
      }, {
        requestId: context?.requestId,
        operation: 'auth.login',
      });
      throw new UnauthorizedException('Invalid credentials')
    }

    // Check if user account is active
    if (user.status !== 'ACTIVE') {
      this.logger.logSecurity('login_attempt_inactive_account', 'medium', {
        userId: user.id,
        email: user.email,
        status: user.status,
        ip: context?.ip,
      }, {
        requestId: context?.requestId,
        operation: 'auth.login',
      });
      throw new UnauthorizedException('Account is not active')
    }

    const tokens = await this.generateTokens(user)

    // Store refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken)

    // Log successful login
    await this.logActivity(user.id, ActivityType.LOGIN, 'User logged in successfully')

    this.logger.logAuth('user_logged_in', user.id, {
      email: user.email,
      username: user.username,
      role: user.role,
      ip: context?.ip,
      userAgent: context?.userAgent,
    }, {
      requestId: context?.requestId,
      operation: 'auth.login',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        avatarUrl: user.avatarUrl,
      },
      tokens,
    }
  }

  async register(registerDto: RegisterDto, context?: { requestId?: string }): Promise<AuthResponse> {
    this.logger.info('User registration attempt', {
      requestId: context?.requestId,
      operation: 'auth.register',
      metadata: { 
        email: registerDto.email, 
        username: registerDto.username,
      },
    });

    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: registerDto.email },
            { username: registerDto.username },
          ],
        },
      })

      if (existingUser) {
        this.logger.warn('Registration failed - user already exists', {
          requestId: context?.requestId,
          operation: 'auth.register',
          metadata: { 
            email: registerDto.email, 
            username: registerDto.username,
            existingField: existingUser.email === registerDto.email ? 'email' : 'username',
          },
        });

        if (existingUser.email === registerDto.email) {
          throw new ConflictException('Email already exists')
        }
        if (existingUser.username === registerDto.username) {
          throw new ConflictException('Username already exists')
        }
      }

      // Create user
      const user = await this.usersService.create({
        ...registerDto,
        role: registerDto.role || 'USER',
      })

      const tokens = await this.generateTokens(user)

      // Store refresh token
      await this.storeRefreshToken(user.id, tokens.refreshToken)

      // Log successful registration
      await this.logActivity(user.id, ActivityType.REGISTER, 'User registered successfully')

      this.logger.logAuth('user_registered', user.id, {
        email: user.email,
        username: user.username,
        role: user.role,
      }, {
        requestId: context?.requestId,
        operation: 'auth.register',
      });

      this.logger.logBusinessEvent('user_registration_completed', {
        userId: user.id,
        email: user.email,
        username: user.username,
      }, {
        requestId: context?.requestId,
        userId: user.id,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          emailVerified: user.emailVerified,
          avatarUrl: user.avatarUrl,
        },
        tokens,
      }
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error
      }
      this.logger.error('Registration failed', error, {
        requestId: context?.requestId,
        operation: 'auth.register',
        metadata: { 
          email: registerDto.email, 
          username: registerDto.username,
        },
      });
      throw new BadRequestException('Registration failed')
    }
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto, context?: { requestId?: string }): Promise<AuthTokens> {
    const { refreshToken } = refreshTokenDto

    this.logger.debug('Token refresh attempt', {
      requestId: context?.requestId,
      operation: 'auth.refreshToken',
    });

    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      })

      // Check if refresh token exists in database
      const storedToken = await this.prisma.refreshToken.findFirst({
        where: {
          token: refreshToken,
          userId: payload.sub,
          expiresAt: { gt: new Date() },
          revoked: false,
        },
        include: { user: true },
      })

      if (!storedToken) {
        this.logger.logSecurity('refresh_token_invalid', 'medium', {
          userId: payload.sub,
        }, {
          requestId: context?.requestId,
          operation: 'auth.refreshToken',
        });
        throw new UnauthorizedException('Invalid refresh token')
      }

      // Generate new tokens
      const tokens = await this.generateTokens(storedToken.user)

      // Revoke old refresh token and store new one
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revoked: true },
      })

      await this.storeRefreshToken(storedToken.userId, tokens.refreshToken)

      this.logger.logAuth('token_refreshed', storedToken.userId, {
        email: storedToken.user.email,
      }, {
        requestId: context?.requestId,
        operation: 'auth.refreshToken',
      });

      return tokens
    } catch (error) {
      this.logger.logSecurity('refresh_token_error', 'medium', {
        error: error.message,
      }, {
        requestId: context?.requestId,
        operation: 'auth.refreshToken',
      });
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  async logout(userId: string, refreshToken?: string, context?: { requestId?: string }): Promise<void> {
    this.logger.info('User logout', {
      requestId: context?.requestId,
      operation: 'auth.logout',
      userId,
    });

    try {
      // Revoke refresh token if provided
      if (refreshToken) {
        await this.prisma.refreshToken.updateMany({
          where: {
            token: refreshToken,
            userId,
          },
          data: { revoked: true },
        })
      } else {
        // Revoke all refresh tokens for user
        await this.prisma.refreshToken.updateMany({
          where: { userId },
          data: { revoked: true },
        })
      }

      // Log logout activity
      await this.logActivity(userId, ActivityType.LOGOUT, 'User logged out')

      this.logger.logAuth('user_logged_out', userId, {}, {
        requestId: context?.requestId,
        operation: 'auth.logout',
      });
    } catch (error) {
      this.logger.error('Logout error', error, {
        requestId: context?.requestId,
        operation: 'auth.logout',
        userId,
      });
    }
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    context?: { requestId?: string },
  ): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto

    this.logger.info('Password change attempt', {
      requestId: context?.requestId,
      operation: 'auth.changePassword',
      userId,
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    )

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect')
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedNewPassword },
    })

    // Revoke all refresh tokens to force re-login
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    })

    // Log password change
    await this.logActivity(userId, ActivityType.PASSWORD_CHANGE, 'Password changed successfully')
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const { email } = forgotPasswordDto

    const user = await this.usersService.findByEmail(email)
    if (!user) {
      // Don't reveal if email exists
      return
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex')
    const resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Store reset token
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: resetTokenHash,
        expiresAt: resetTokenExpires,
      },
    })

    // TODO: Send email with reset token
    // await this.emailService.sendPasswordResetEmail(user.email, resetToken)

    this.logger.log(`Password reset requested for user: ${user.email}`)
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const { token, newPassword } = resetPasswordDto

    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const passwordReset = await this.prisma.passwordReset.findFirst({
      where: {
        token: resetTokenHash,
        expiresAt: { gt: new Date() },
        used: false,
      },
      include: { user: true },
    })

    if (!passwordReset) {
      throw new BadRequestException('Invalid or expired reset token')
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Update password and mark reset token as used
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: passwordReset.userId },
        data: { passwordHash: hashedPassword },
      }),
      this.prisma.passwordReset.update({
        where: { id: passwordReset.id },
        data: { used: true },
      }),
    ])

    // Revoke all refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: { userId: passwordReset.userId },
      data: { revoked: true },
    })

    // Log password reset
    await this.logActivity(
      passwordReset.userId,
      ActivityType.PASSWORD_CHANGE,
      'Password reset successfully',
    )
  }

  async validateJwtPayload(payload: JwtPayload): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { profile: true },
    })

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive')
    }

    return user
  }

  private async generateTokens(user: any): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    }

    const accessTokenExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '15m')
    const refreshTokenExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d')

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: accessTokenExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTokenExpiresIn,
      }),
    ])

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiresIn(accessTokenExpiresIn),
      tokenType: 'Bearer',
    }
  }

  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d')
    const expiresAt = new Date(Date.now() + this.parseExpiresIn(expiresIn) * 1000)

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt,
      },
    })
  }

  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/)
    if (!match) return 900 // Default 15 minutes

    const value = parseInt(match[1])
    const unit = match[2]

    switch (unit) {
      case 's': return value
      case 'm': return value * 60
      case 'h': return value * 60 * 60
      case 'd': return value * 24 * 60 * 60
      default: return 900
    }
  }

  private async logActivity(
    userId: string,
    type: ActivityType,
    description: string,
  ): Promise<void> {
    try {
      await this.prisma.activity.create({
        data: {
          userId,
          type,
          description,
          metadata: {},
        },
      })
    } catch (error) {
      this.logger.error(`Failed to log activity: ${error.message}`)
    }
  }
}
