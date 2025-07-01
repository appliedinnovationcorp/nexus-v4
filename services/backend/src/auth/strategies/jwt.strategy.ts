import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ConfigService } from '@nestjs/config'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { AuthService, JwtPayload } from '../auth.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      issuer: configService.get<string>('JWT_ISSUER', 'nexus-api'),
      audience: configService.get<string>('JWT_AUDIENCE', 'nexus-app'),
    })
  }

  async validate(payload: JwtPayload): Promise<any> {
    try {
      const user = await this.authService.validateJwtPayload(payload)
      if (!user) {
        throw new UnauthorizedException('Invalid token')
      }
      return user
    } catch (error) {
      throw new UnauthorizedException('Invalid token')
    }
  }
}
