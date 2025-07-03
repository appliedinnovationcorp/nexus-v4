import { Controller, Get, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { MonitoringService } from './monitoring.service';

@Controller()
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('health')
  async health(@Res() res: Response) {
    try {
      const healthStatus = await this.monitoringService.getHealthStatus();
      const statusCode = healthStatus.status === 'healthy' ? HttpStatus.OK : 
                        healthStatus.status === 'degraded' ? HttpStatus.OK : 
                        HttpStatus.SERVICE_UNAVAILABLE;
      
      res.status(statusCode).json(healthStatus);
    } catch (error) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Get('metrics')
  async metrics(@Res() res: Response) {
    try {
      const metrics = this.monitoringService.getMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve metrics',
        message: error.message,
      });
    }
  }

  @Post('api/logs')
  async receiveLogs(@Body() logData: any, @Res() res: Response) {
    try {
      // Process frontend logs
      const { level, message, ...context } = logData;
      
      switch (level) {
        case 'error':
          this.monitoringService.logError(`Frontend: ${message}`, context);
          break;
        case 'warn':
          this.monitoringService.logWarn(`Frontend: ${message}`, context);
          break;
        case 'info':
          this.monitoringService.logInfo(`Frontend: ${message}`, context);
          break;
        case 'debug':
          this.monitoringService.logDebug(`Frontend: ${message}`, context);
          break;
        default:
          this.monitoringService.logInfo(`Frontend: ${message}`, context);
      }

      res.status(HttpStatus.OK).json({ success: true });
    } catch (error) {
      this.monitoringService.logError('Failed to process frontend log', { error: error.message });
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to process log',
        message: error.message,
      });
    }
  }

  @Get('ready')
  async readiness(@Res() res: Response) {
    try {
      const healthStatus = await this.monitoringService.getHealthStatus();
      
      // Service is ready if critical checks pass
      const criticalChecks = ['database'];
      const isReady = criticalChecks.every(checkName => 
        healthStatus.checks[checkName]?.status === 'pass'
      );
      
      const statusCode = isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
      
      res.status(statusCode).json({
        status: isReady ? 'ready' : 'not ready',
        checks: healthStatus.checks,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'not ready',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Get('live')
  async liveness(@Res() res: Response) {
    try {
      const healthStatus = await this.monitoringService.getHealthStatus();
      
      // Service is alive if it's not completely unhealthy
      const isAlive = healthStatus.status !== 'unhealthy';
      const statusCode = isAlive ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
      
      res.status(statusCode).json({
        status: isAlive ? 'alive' : 'dead',
        uptime: healthStatus.uptime,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'dead',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
