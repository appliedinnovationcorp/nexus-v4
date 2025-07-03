import { MonitoringConfig, HealthCheck, HealthCheckResult } from './types';

export function createHealthCheck(config: MonitoringConfig, checks: HealthCheck[] = []): () => Promise<HealthCheckResult> {
  const startTime = Date.now();

  // Default health checks
  const defaultChecks: HealthCheck[] = [
    {
      name: 'memory',
      check: async () => {
        const memUsage = process.memoryUsage();
        const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        
        if (memUsagePercent > 90) {
          return { status: 'fail', message: `Memory usage critical: ${memUsagePercent.toFixed(2)}%` };
        } else if (memUsagePercent > 75) {
          return { status: 'warn', message: `Memory usage high: ${memUsagePercent.toFixed(2)}%` };
        }
        
        return { status: 'pass', message: `Memory usage: ${memUsagePercent.toFixed(2)}%` };
      },
      timeout: 1000,
    },
    {
      name: 'uptime',
      check: async () => {
        const uptime = Date.now() - startTime;
        return { status: 'pass', message: `Uptime: ${Math.floor(uptime / 1000)}s` };
      },
      timeout: 100,
    },
  ];

  const allChecks = [...defaultChecks, ...checks];

  return async (): Promise<HealthCheckResult> => {
    const checkResults: HealthCheckResult['checks'] = {};
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    // Run all health checks
    await Promise.all(
      allChecks.map(async (healthCheck) => {
        const checkStartTime = Date.now();
        
        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Health check timeout')), healthCheck.timeout || 5000);
          });

          const result = await Promise.race([
            healthCheck.check(),
            timeoutPromise,
          ]);

          const duration = Date.now() - checkStartTime;

          checkResults[healthCheck.name] = {
            status: result.status,
            message: result.message,
            duration,
            timestamp: new Date().toISOString(),
          };

          // Update overall status
          if (result.status === 'fail') {
            overallStatus = 'unhealthy';
          } else if (result.status === 'warn' && overallStatus === 'healthy') {
            overallStatus = 'degraded';
          }
        } catch (error) {
          const duration = Date.now() - checkStartTime;
          
          checkResults[healthCheck.name] = {
            status: 'fail',
            message: error instanceof Error ? error.message : 'Unknown error',
            duration,
            timestamp: new Date().toISOString(),
          };
          
          overallStatus = 'unhealthy';
        }
      })
    );

    return {
      status: overallStatus,
      checks: checkResults,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - startTime,
      version: config.version,
    };
  };
}

// Common health check implementations
export const commonHealthChecks = {
  // Database health check
  database: (connectionTest: () => Promise<boolean>): HealthCheck => ({
    name: 'database',
    check: async () => {
      try {
        const isConnected = await connectionTest();
        return isConnected 
          ? { status: 'pass', message: 'Database connection successful' }
          : { status: 'fail', message: 'Database connection failed' };
      } catch (error) {
        return { 
          status: 'fail', 
          message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }
    },
    timeout: 5000,
  }),

  // Redis health check
  redis: (redisClient: any): HealthCheck => ({
    name: 'redis',
    check: async () => {
      try {
        await redisClient.ping();
        return { status: 'pass', message: 'Redis connection successful' };
      } catch (error) {
        return { 
          status: 'fail', 
          message: `Redis error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }
    },
    timeout: 3000,
  }),

  // External API health check
  externalApi: (url: string, timeout: number = 5000): HealthCheck => ({
    name: `external_api_${url.replace(/[^a-zA-Z0-9]/g, '_')}`,
    check: async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
          signal: controller.signal,
          method: 'HEAD',
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          return { status: 'pass', message: `External API ${url} is reachable` };
        } else {
          return { status: 'warn', message: `External API ${url} returned ${response.status}` };
        }
      } catch (error) {
        return { 
          status: 'fail', 
          message: `External API ${url} error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }
    },
    timeout: timeout + 1000,
  }),

  // Disk space health check
  diskSpace: (threshold: number = 90): HealthCheck => ({
    name: 'disk_space',
    check: async () => {
      try {
        const fs = require('fs');
        const stats = fs.statSync('/');
        const total = stats.size;
        const free = stats.free;
        const used = ((total - free) / total) * 100;
        
        if (used > threshold) {
          return { status: 'fail', message: `Disk usage critical: ${used.toFixed(2)}%` };
        } else if (used > threshold * 0.8) {
          return { status: 'warn', message: `Disk usage high: ${used.toFixed(2)}%` };
        }
        
        return { status: 'pass', message: `Disk usage: ${used.toFixed(2)}%` };
      } catch (error) {
        return { 
          status: 'fail', 
          message: `Disk space check error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }
    },
    timeout: 2000,
  }),

  // Custom health check
  custom: (name: string, checkFunction: () => Promise<{ status: 'pass' | 'fail' | 'warn'; message?: string }>, timeout: number = 5000): HealthCheck => ({
    name,
    check: checkFunction,
    timeout,
  }),
};

// Health check middleware for Express
export function createHealthMiddleware(healthCheck: () => Promise<HealthCheckResult>) {
  return async (req: any, res: any) => {
    try {
      const result = await healthCheck();
      
      const statusCode = result.status === 'healthy' ? 200 : 
                        result.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(result);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  };
}

// Readiness check (for Kubernetes)
export function createReadinessCheck(criticalChecks: string[] = ['database']): (healthResult: HealthCheckResult) => boolean {
  return (healthResult: HealthCheckResult): boolean => {
    // Service is ready if all critical checks pass
    return criticalChecks.every(checkName => 
      healthResult.checks[checkName]?.status === 'pass'
    );
  };
}

// Liveness check (for Kubernetes)
export function createLivenessCheck(): (healthResult: HealthCheckResult) => boolean {
  return (healthResult: HealthCheckResult): boolean => {
    // Service is alive if it's not completely unhealthy
    return healthResult.status !== 'unhealthy';
  };
}
