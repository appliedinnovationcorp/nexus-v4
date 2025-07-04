/**
 * @fileoverview Tests for monitoring functionality
 */

import {
  createLogger,
  createApplicationMetrics,
  createHealthCheck,
  commonHealthChecks
} from '../index';

describe('Monitoring', () => {
  describe('Logger', () => {
    test('should create logger instance', () => {
      const logger = createLogger('test-service');
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    test('should log messages with correct format', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const logger = createLogger('test-service');
      
      logger.info('Test message', { key: 'value' });
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Application Metrics', () => {
    test('should create metrics collector', () => {
      const metrics = createApplicationMetrics({
        serviceName: 'test-service',
        version: '1.0.0'
      });

      expect(metrics).toBeDefined();
      expect(typeof metrics.incrementCounter).toBe('function');
      expect(typeof metrics.recordHistogram).toBe('function');
      expect(typeof metrics.setGauge).toBe('function');
    });

    test('should track metrics correctly', () => {
      const metrics = createApplicationMetrics({
        serviceName: 'test-service',
        version: '1.0.0'
      });

      expect(() => {
        metrics.incrementCounter('test.counter', 1, { label: 'test' });
        metrics.recordHistogram('test.histogram', 100);
        metrics.setGauge('test.gauge', 50);
      }).not.toThrow();
    });
  });

  describe('Health Checks', () => {
    test('should create health check', async () => {
      const healthCheck = createHealthCheck({
        name: 'test-check',
        check: async () => ({ status: 'healthy', message: 'OK' })
      });

      expect(healthCheck).toBeDefined();
      expect(typeof healthCheck.execute).toBe('function');
    });

    test('should execute health check', async () => {
      const healthCheck = createHealthCheck({
        name: 'test-check',
        check: async () => ({ status: 'healthy', message: 'OK' })
      });

      const result = await healthCheck.execute();
      expect(result.status).toBe('healthy');
      expect(result.message).toBe('OK');
    });

    test('should handle failed health checks', async () => {
      const healthCheck = createHealthCheck({
        name: 'failing-check',
        check: async () => {
          throw new Error('Health check failed');
        }
      });

      const result = await healthCheck.execute();
      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('Health check failed');
    });
  });

  describe('Common Health Checks', () => {
    test('should have database health check', () => {
      expect(commonHealthChecks.database).toBeDefined();
      expect(typeof commonHealthChecks.database).toBe('function');
    });

    test('should have redis health check', () => {
      expect(commonHealthChecks.redis).toBeDefined();
      expect(typeof commonHealthChecks.redis).toBe('function');
    });

    test('should have memory health check', () => {
      expect(commonHealthChecks.memory).toBeDefined();
      expect(typeof commonHealthChecks.memory).toBe('function');
    });

    test('should execute memory health check', async () => {
      const memoryCheck = commonHealthChecks.memory();
      const result = await memoryCheck.execute();
      
      expect(result.status).toBeDefined();
      expect(['healthy', 'unhealthy', 'degraded'].includes(result.status)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle logger creation errors', () => {
      expect(() => {
        createLogger('');
      }).toThrow();
    });

    test('should handle metrics creation errors', () => {
      expect(() => {
        createApplicationMetrics({
          serviceName: '',
          version: '1.0.0'
        });
      }).toThrow();
    });
  });
});
