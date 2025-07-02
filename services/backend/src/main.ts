import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';
import { SentryService } from './common/sentry/sentry.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Get services
  const logger = app.get(LoggerService);
  const sentryService = app.get(SentryService);
  
  // Use Pino logger
  app.useLogger(app.get(Logger));
  app.flushLogs();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Log application startup
  logger.logStartup('Starting Nexus Backend API', {
    port,
    environment: nodeEnv,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    sentryEnabled: sentryService.isReady(),
  });

  // Add Sentry breadcrumb for startup
  sentryService.addBreadcrumb(
    'Application starting',
    'lifecycle',
    'info',
    {
      port,
      environment: nodeEnv,
      nodeVersion: process.version,
    },
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS configuration
  const corsOrigin = configService.get<string>('CORS_ORIGIN', '*');
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  // API prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'api');
  app.setGlobalPrefix(apiPrefix);

  // Swagger documentation
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Nexus Backend API')
      .setDescription('NestJS backend service for Nexus workspace with structured logging and error tracking')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management endpoints')
      .addTag('health', 'Health check endpoints')
      .addTag('protected', 'Protected endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    logger.info('Swagger documentation available', {
      url: `http://localhost:${port}/${apiPrefix}/docs`,
    });
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.logShutdown('Received SIGTERM, shutting down gracefully', {
      signal: 'SIGTERM',
    });

    sentryService.addBreadcrumb(
      'Application shutting down',
      'lifecycle',
      'info',
      { signal: 'SIGTERM' },
    );

    // Flush Sentry events before shutdown
    await sentryService.flush(5000);
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.logShutdown('Received SIGINT, shutting down gracefully', {
      signal: 'SIGINT',
    });

    sentryService.addBreadcrumb(
      'Application shutting down',
      'lifecycle',
      'info',
      { signal: 'SIGINT' },
    );

    // Flush Sentry events before shutdown
    await sentryService.flush(5000);
    await app.close();
    process.exit(0);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    logger.fatal('Uncaught Exception', error, {
      operation: 'process.uncaughtException',
    });

    // Report to Sentry
    sentryService.captureException(error, {
      operation: 'process.uncaughtException',
    }, undefined, {
      service: 'nexus-backend',
      errorType: 'uncaughtException',
      fatal: 'true',
    });

    // Flush Sentry and exit
    await sentryService.flush(2000);
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    const error = new Error(String(reason));
    logger.fatal('Unhandled Rejection', error, {
      operation: 'process.unhandledRejection',
      metadata: { promise: String(promise) },
    });

    // Report to Sentry
    sentryService.captureException(error, {
      operation: 'process.unhandledRejection',
    }, undefined, {
      service: 'nexus-backend',
      errorType: 'unhandledRejection',
      fatal: 'true',
    });

    // Flush Sentry and exit
    await sentryService.flush(2000);
    process.exit(1);
  });

  await app.listen(port);

  // Add startup breadcrumb
  sentryService.addBreadcrumb(
    'Application started successfully',
    'lifecycle',
    'info',
    {
      port,
      environment: nodeEnv,
      url: `http://localhost:${port}/${apiPrefix}`,
    },
  );

  logger.logStartup('Nexus Backend API started successfully', {
    port,
    environment: nodeEnv,
    url: `http://localhost:${port}/${apiPrefix}`,
    apiDocs: nodeEnv !== 'production' ? `http://localhost:${port}/${apiPrefix}/docs` : undefined,
    healthCheck: `http://localhost:${port}/${apiPrefix}/health`,
    sentryEnabled: sentryService.isReady(),
  });
}

void bootstrap().catch(async (error) => {
  console.error('Failed to start application:', error);
  
  // Try to report to Sentry if possible
  try {
    const { SentryService } = await import('./common/sentry/sentry.service');
    const { ConfigService } = await import('@nestjs/config');
    
    const configService = new ConfigService();
    const sentryService = new SentryService(configService);
    
    sentryService.captureException(error, {
      operation: 'bootstrap.failure',
    }, undefined, {
      service: 'nexus-backend',
      errorType: 'bootstrapFailure',
      fatal: 'true',
    });
    
    await sentryService.flush(2000);
  } catch (sentryError) {
    console.error('Failed to report bootstrap error to Sentry:', sentryError);
  }
  
  process.exit(1);
});
