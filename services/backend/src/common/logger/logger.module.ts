import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isDevelopment = configService.get('NODE_ENV') === 'development';
        const logLevel = configService.get('LOG_LEVEL', 'info');
        
        return {
          pinoHttp: {
            level: logLevel,
            transport: isDevelopment
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                    singleLine: false,
                    hideObject: false,
                  },
                }
              : undefined,
            formatters: {
              level: (label: string) => {
                return { level: label };
              },
            },
            timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
            base: {
              pid: process.pid,
              hostname: process.env.HOSTNAME || 'unknown',
              service: 'nexus-backend',
              version: process.env.npm_package_version || '1.0.0',
              environment: configService.get('NODE_ENV', 'development'),
            },
            customProps: (req: any) => ({
              requestId: req.id || req.headers['x-request-id'] || generateRequestId(),
              userAgent: req.headers['user-agent'],
              ip: req.ip || req.connection?.remoteAddress,
              method: req.method,
              url: req.url,
            }),
            serializers: {
              req: (req: any) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                query: req.query,
                params: req.params,
                headers: {
                  host: req.headers.host,
                  'user-agent': req.headers['user-agent'],
                  'content-type': req.headers['content-type'],
                  authorization: req.headers.authorization ? '[REDACTED]' : undefined,
                },
                remoteAddress: req.remoteAddress,
                remotePort: req.remotePort,
              }),
              res: (res: any) => ({
                statusCode: res.statusCode,
                headers: {
                  'content-type': res.getHeader('content-type'),
                  'content-length': res.getHeader('content-length'),
                },
              }),
              err: (err: any) => ({
                type: err.constructor.name,
                message: err.message,
                stack: err.stack,
                code: err.code,
                statusCode: err.statusCode,
              }),
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.confirmPassword',
                'req.body.token',
                'req.body.refreshToken',
                'password',
                'token',
                'refreshToken',
                'secret',
                'apiKey',
              ],
              censor: '[REDACTED]',
            },
            autoLogging: {
              ignore: (req: any) => {
                // Don't log health check requests in production
                return req.url === '/health' && !isDevelopment;
              },
            },
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}

function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}
