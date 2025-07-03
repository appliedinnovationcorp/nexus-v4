import { Controller, Get, Post, Body, Query, Param, UseGuards, Req } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { UserContext } from '@nexus/feature-flags';

@Controller('api/feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get('all')
  async getAllFlags(@Req() req: any) {
    const userContext = this.buildUserContextFromRequest(req);
    return await this.featureFlagsService.getAllFlags(userContext);
  }

  @Get('evaluate')
  async evaluateFlags(
    @Query('flags') flags: string,
    @Req() req: any
  ) {
    const userContext = this.buildUserContextFromRequest(req);
    const flagKeys = flags.split(',').map(f => f.trim());
    return await this.featureFlagsService.evaluateFlags(flagKeys, userContext);
  }

  @Get(':flagKey')
  async getFlag(
    @Param('flagKey') flagKey: string,
    @Query('type') type: 'boolean' | 'string' | 'number' = 'boolean',
    @Query('defaultValue') defaultValue?: string,
    @Req() req: any
  ) {
    const userContext = this.buildUserContextFromRequest(req);
    
    switch (type) {
      case 'boolean':
        const boolDefault = defaultValue ? defaultValue.toLowerCase() === 'true' : false;
        return {
          flagKey,
          value: await this.featureFlagsService.isEnabled(flagKey, userContext, boolDefault),
          type: 'boolean',
        };
        
      case 'string':
        return {
          flagKey,
          value: await this.featureFlagsService.getString(flagKey, userContext, defaultValue || ''),
          type: 'string',
        };
        
      case 'number':
        const numDefault = defaultValue ? parseFloat(defaultValue) : 0;
        return {
          flagKey,
          value: await this.featureFlagsService.getNumber(flagKey, userContext, numDefault),
          type: 'number',
        };
        
      default:
        return {
          flagKey,
          value: await this.featureFlagsService.isEnabled(flagKey, userContext),
          type: 'boolean',
        };
    }
  }

  @Get(':flagKey/variant')
  async getFlagVariant(
    @Param('flagKey') flagKey: string,
    @Query('defaultValue') defaultValue: string = 'control',
    @Req() req: any
  ) {
    const userContext = this.buildUserContextFromRequest(req);
    return {
      flagKey,
      variant: await this.featureFlagsService.getVariant(flagKey, userContext, defaultValue),
    };
  }

  @Post('evaluate')
  async evaluateFlagsPost(
    @Body() body: {
      flags: string[];
      userContext?: UserContext;
    }
  ) {
    const userContext = body.userContext;
    return await this.featureFlagsService.evaluateFlags(body.flags, userContext);
  }

  @Get('business/premium-access')
  async checkPremiumAccess(@Req() req: any) {
    const userContext = this.buildUserContextFromRequest(req);
    return {
      hasAccess: await this.featureFlagsService.canAccessPremiumFeatures(userContext),
    };
  }

  @Get('business/beta-access')
  async checkBetaAccess(@Req() req: any) {
    const userContext = this.buildUserContextFromRequest(req);
    return {
      hasAccess: await this.featureFlagsService.canAccessBetaFeatures(userContext),
    };
  }

  @Get('system/maintenance-mode')
  async getMaintenanceMode() {
    return {
      maintenanceMode: await this.featureFlagsService.isMaintenanceMode(),
    };
  }

  @Get('system/read-only-mode')
  async getReadOnlyMode() {
    return {
      readOnlyMode: await this.featureFlagsService.isReadOnlyMode(),
    };
  }

  @Get('ui/dashboard-variant')
  async getDashboardVariant(@Req() req: any) {
    const userContext = this.buildUserContextFromRequest(req);
    return {
      useNewDashboard: await this.featureFlagsService.shouldUseNewDashboard(userContext),
    };
  }

  @Get('flows/checkout-variant')
  async getCheckoutVariant(@Req() req: any) {
    const userContext = this.buildUserContextFromRequest(req);
    return {
      variant: await this.featureFlagsService.getCheckoutFlowVariant(userContext),
    };
  }

  @Get('flows/onboarding-variant')
  async getOnboardingVariant(@Req() req: any) {
    const userContext = this.buildUserContextFromRequest(req);
    return {
      variant: await this.featureFlagsService.getOnboardingFlowVariant(userContext),
    };
  }

  @Get('admin/metrics')
  // @UseGuards(AdminGuard) // Uncomment when admin guard is implemented
  async getMetrics() {
    const metrics = this.featureFlagsService.getMetrics();
    const metricsArray = Array.from(metrics.entries()).map(([flagKey, metric]) => ({
      flagKey,
      ...metric,
    }));
    
    return {
      metrics: metricsArray,
      totalFlags: metricsArray.length,
      totalEvaluations: metricsArray.reduce((sum, m) => sum + m.evaluations, 0),
    };
  }

  @Post('admin/clear-cache')
  // @UseGuards(AdminGuard) // Uncomment when admin guard is implemented
  async clearCache() {
    await this.featureFlagsService.clearCache();
    return { success: true, message: 'Feature flag cache cleared' };
  }

  @Post('admin/clear-metrics')
  // @UseGuards(AdminGuard) // Uncomment when admin guard is implemented
  async clearMetrics() {
    this.featureFlagsService.clearMetrics();
    return { success: true, message: 'Feature flag metrics cleared' };
  }

  @Post('admin/invalidate/:flagKey')
  // @UseGuards(AdminGuard) // Uncomment when admin guard is implemented
  async invalidateFlag(@Param('flagKey') flagKey: string) {
    await this.featureFlagsService.invalidateFlag(flagKey);
    return { success: true, message: `Flag ${flagKey} cache invalidated` };
  }

  private buildUserContextFromRequest(req: any): UserContext | undefined {
    // Extract user context from request
    // This depends on your authentication system
    const user = req.user;
    
    if (!user) {
      return undefined;
    }

    return this.featureFlagsService.buildUserContext(user);
  }
}
