import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { BusinessIntelligenceService, BusinessMetric, KPI, Insight } from './business-intelligence.service';

@ApiTags('Business Intelligence')
@Controller('api/v1/bi')
export class BusinessIntelligenceController {
  constructor(private readonly biService: BusinessIntelligenceService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get comprehensive business intelligence dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getDashboard(): Promise<{
    metrics: BusinessMetric[];
    kpis: KPI[];
    insights: Insight[];
    summary: any;
  }> {
    return await this.biService.getDashboardData();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get business metrics' })
  @ApiQuery({ name: 'timeRange', required: false, description: 'Time range for metrics (e.g., 24h, 7d, 30d)' })
  @ApiResponse({ status: 200, description: 'Business metrics retrieved successfully' })
  async getMetrics(@Query('timeRange') timeRange: string = '24h'): Promise<BusinessMetric[]> {
    return await this.biService.getBusinessMetrics(timeRange);
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Get Key Performance Indicators' })
  @ApiResponse({ status: 200, description: 'KPIs retrieved successfully' })
  async getKPIs(): Promise<KPI[]> {
    return await this.biService.getKPIs();
  }

  @Get('insights')
  @ApiOperation({ summary: 'Get AI-powered business insights' })
  @ApiResponse({ status: 200, description: 'Insights retrieved successfully' })
  async getInsights(): Promise<Insight[]> {
    return await this.biService.getInsights();
  }

  @Get('insights/:type')
  @ApiOperation({ summary: 'Get insights by type' })
  @ApiResponse({ status: 200, description: 'Filtered insights retrieved successfully' })
  async getInsightsByType(@Param('type') type: string): Promise<Insight[]> {
    const allInsights = await this.biService.getInsights();
    return allInsights.filter(insight => insight.type === type);
  }

  @Get('metrics/:metricId')
  @ApiOperation({ summary: 'Get specific business metric details' })
  @ApiResponse({ status: 200, description: 'Metric details retrieved successfully' })
  async getMetricDetails(@Param('metricId') metricId: string): Promise<BusinessMetric | null> {
    const metrics = await this.biService.getBusinessMetrics();
    return metrics.find(metric => metric.id === metricId) || null;
  }

  @Get('kpis/:kpiId')
  @ApiOperation({ summary: 'Get specific KPI details' })
  @ApiResponse({ status: 200, description: 'KPI details retrieved successfully' })
  async getKPIDetails(@Param('kpiId') kpiId: string): Promise<KPI | null> {
    const kpis = await this.biService.getKPIs();
    return kpis.find(kpi => kpi.id === kpiId) || null;
  }
}
