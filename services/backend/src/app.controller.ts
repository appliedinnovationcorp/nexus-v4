import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { AppService } from './app.service'
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard'
import { Public } from './auth/decorators/public.decorator'
import { CurrentUser } from './auth/decorators/current-user.decorator'
import { Roles } from './auth/decorators/roles.decorator'
import { RolesGuard } from './auth/guards/roles.guard'
import { UserRole } from '@prisma/client'

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get hello message' })
  @ApiResponse({ status: 200, description: 'Returns hello message' })
  getHello(): string {
    return this.appService.getHello()
  }

  @Get('protected')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Protected route example' })
  @ApiResponse({ status: 200, description: 'Returns protected data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProtected(@CurrentUser() user: any): any {
    return {
      message: 'This is a protected route',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    }
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin only route' })
  @ApiResponse({ status: 200, description: 'Returns admin data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  getAdminData(@CurrentUser() user: any): any {
    return {
      message: 'This is an admin only route',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    }
  }
}
