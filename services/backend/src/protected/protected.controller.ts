import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { UserRole } from '@prisma/client'

@ApiTags('Protected Routes')
@Controller('protected')
export class ProtectedController {
  
  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Public endpoint - no authentication required' })
  @ApiResponse({ status: 200, description: 'Public data' })
  getPublicData() {
    return {
      message: 'This is a public endpoint, no authentication required',
      timestamp: new Date().toISOString(),
    }
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile - authentication required' })
  @ApiResponse({ status: 200, description: 'User profile data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getUserProfile(@CurrentUser() user: any) {
    return {
      message: 'This is a protected endpoint',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      timestamp: new Date().toISOString(),
    }
  }

  @Get('admin-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin only endpoint - requires ADMIN role' })
  @ApiResponse({ status: 200, description: 'Admin data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  getAdminData(@CurrentUser() user: any) {
    return {
      message: 'This endpoint is only accessible by admins',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      timestamp: new Date().toISOString(),
    }
  }

  @Get('moderator-admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Moderator/Admin endpoint - requires MODERATOR or ADMIN role' })
  @ApiResponse({ status: 200, description: 'Moderator/Admin data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  getModeratorAdminData(@CurrentUser() user: any) {
    return {
      message: 'This endpoint is accessible by moderators and admins',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      timestamp: new Date().toISOString(),
    }
  }

  @Post('user-action')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'User action endpoint - any authenticated user' })
  @ApiResponse({ status: 200, description: 'Action completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  performUserAction(
    @CurrentUser() user: any,
    @Body() actionData: { action: string; data?: any },
  ) {
    return {
      message: `Action '${actionData.action}' performed successfully`,
      performedBy: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      actionData: actionData.data,
      timestamp: new Date().toISOString(),
    }
  }

  @Get('user-specific-data')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user-specific data using CurrentUser decorator' })
  @ApiResponse({ status: 200, description: 'User-specific data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getUserSpecificData(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') userEmail: string,
    @CurrentUser('role') userRole: string,
  ) {
    return {
      message: 'User-specific data retrieved using CurrentUser decorator',
      userId,
      userEmail,
      userRole,
      timestamp: new Date().toISOString(),
    }
  }
}
