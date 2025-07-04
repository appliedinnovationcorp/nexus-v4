import { Controller, Get, Post, Delete, Param, Body, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ReportingEngineService, Report, ReportTemplate } from './reporting-engine.service';

@ApiTags('Reporting Engine')
@Controller('api/v1/reports')
export class ReportingEngineController {
  constructor(private readonly reportingService: ReportingEngineService) {}

  @Get('templates')
  @ApiOperation({ summary: 'Get all available report templates' })
  @ApiResponse({ status: 200, description: 'Report templates retrieved successfully' })
  async getTemplates(): Promise<ReportTemplate[]> {
    return await this.reportingService.getReportTemplates();
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate a report from template' })
  @ApiResponse({ status: 201, description: 'Report generation started' })
  async generateReport(@Body() body: {
    templateId: string;
    parameters?: Record<string, any>;
  }): Promise<Report> {
    return await this.reportingService.generateReport(body.templateId, body.parameters);
  }

  @Get()
  @ApiOperation({ summary: 'Get all generated reports' })
  @ApiResponse({ status: 200, description: 'Reports retrieved successfully' })
  async getAllReports(): Promise<Report[]> {
    return await this.reportingService.getAllReports();
  }

  @Get(':reportId')
  @ApiOperation({ summary: 'Get specific report by ID' })
  @ApiResponse({ status: 200, description: 'Report retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async getReport(@Param('reportId') reportId: string): Promise<Report> {
    const report = await this.reportingService.getReport(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }
    return report;
  }

  @Get(':reportId/export')
  @ApiOperation({ summary: 'Export report in specified format' })
  @ApiQuery({ name: 'format', enum: ['pdf', 'csv', 'excel', 'html'] })
  @ApiResponse({ status: 200, description: 'Report exported successfully' })
  async exportReport(
    @Param('reportId') reportId: string,
    @Query('format') format: 'pdf' | 'csv' | 'excel' | 'html' = 'pdf',
    @Res() res: Response,
  ): Promise<void> {
    const exportData = await this.reportingService.exportReport(reportId, format);
    
    const contentTypes = {
      pdf: 'application/pdf',
      csv: 'text/csv',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      html: 'text/html',
    };

    const fileExtensions = {
      pdf: 'pdf',
      csv: 'csv',
      excel: 'xlsx',
      html: 'html',
    };

    res.setHeader('Content-Type', contentTypes[format]);
    res.setHeader('Content-Disposition', `attachment; filename="report_${reportId}.${fileExtensions[format]}"`);
    res.send(exportData);
  }

  @Post('schedule')
  @ApiOperation({ summary: 'Schedule a recurring report' })
  @ApiResponse({ status: 201, description: 'Report scheduled successfully' })
  async scheduleReport(@Body() body: {
    templateId: string;
    schedule: string;
    recipients: string[];
    parameters?: Record<string, any>;
  }): Promise<{ scheduleId: string }> {
    const scheduleId = await this.reportingService.scheduleReport(
      body.templateId,
      body.schedule,
      body.recipients,
      body.parameters,
    );
    
    return { scheduleId };
  }

  @Get('scheduled/list')
  @ApiOperation({ summary: 'Get all scheduled reports' })
  @ApiResponse({ status: 200, description: 'Scheduled reports retrieved successfully' })
  async getScheduledReports(): Promise<any[]> {
    return await this.reportingService.getScheduledReports();
  }

  @Delete('scheduled/:scheduleId')
  @ApiOperation({ summary: 'Cancel a scheduled report' })
  @ApiResponse({ status: 200, description: 'Scheduled report cancelled successfully' })
  async cancelScheduledReport(@Param('scheduleId') scheduleId: string): Promise<{ success: boolean }> {
    const success = await this.reportingService.cancelScheduledReport(scheduleId);
    return { success };
  }

  @Delete(':reportId')
  @ApiOperation({ summary: 'Delete a generated report' })
  @ApiResponse({ status: 200, description: 'Report deleted successfully' })
  async deleteReport(@Param('reportId') reportId: string): Promise<{ success: boolean }> {
    const success = await this.reportingService.deleteReport(reportId);
    return { success };
  }
}
