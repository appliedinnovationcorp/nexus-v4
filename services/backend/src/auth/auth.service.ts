import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { UsersService } from '../users/users.service'
import { PrismaService } from '../prisma/prisma.service'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { RefreshTokenDto } from './dto/refresh-token.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import * as bcrypt from 'bcryptjs'
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
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    try {
      const user = await this.usersService.findByEmail(email)
      if (!user) {
        return null
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
      if (!isPasswordValid) {
        return null
      }

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })

      // Return user without password
      const { passwordHash, ...result } = user
      return result
    } catch (error) {
      this.logger.error(`Error validating user: ${error.message}`)
      return null
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto

    const user = await this.validateUser(email, password)
    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    // Check if user account is active
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active')
    }

    const tokens = await this.generateTokens(user)

    // Store refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken)

    // Log successful login
    await this.logActivity(user.id, 'LOGIN', 'User logged in successfully')

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

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
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
      await this.logActivity(user.id, 'REGISTER', 'User registered successfully')

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
      this.logger.error(`Registration error: ${error.message}`)
      throw new BadRequestException('Registration failed')
    }
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<AuthTokens> {
    const { refreshToken } = refreshTokenDto

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

      return tokens
    } catch (error) {
      this.logger.error(`Refresh token error: ${error.message}`)
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
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
      await this.logActivity(userId, 'LOGOUT', 'User logged out')
    } catch (error) {
      this.logger.error(`Logout error: ${error.message}`)
    }
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto

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
    await this.logActivity(userId, 'PASSWORD_CHANGE', 'Password changed successfully')
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
      'PASSWORD_RESET',
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
    type: string,
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
