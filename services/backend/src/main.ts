import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';
import { SentryService } from './common/sentry/sentry.service';
import { validateEnvironmentVariables } from './config/env.config';

async function bootstrap(): Promise<void> {
  // Validate environment variables before creating the app
  console.log('🔍 Validating environment variables...');
  const env = validateEnvironmentVariables();
  console.log('✅ Environment variables validated successfully');

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
  const port = env.PORT;
  const nodeEnv = env.NODE_ENV;

  // Log application startup with validated environment
  logger.logStartup('Starting Nexus Backend API', {
    port,
    environment: nodeEnv,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    sentryEnabled: sentryService.isReady(),
    databaseConfigured: !!env.DATABASE_URL,
    jwtConfigured: !!env.JWT_SECRET,
    redisConfigured: !!env.REDIS_URL,
    smtpConfigured: !!env.SMTP_HOST,
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
      configValidated: true,
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
  app.enableCors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix(env.API_PREFIX);

  // Swagger documentation
  if (env.ENABLE_SWAGGER && nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle(env.APP_NAME)
      .setDescription('NestJS backend service for Nexus workspace with structured logging and error tracking')
      .setVersion(env.APP_VERSION)
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management endpoints')
      .addTag('health', 'Health check endpoints')
      .addTag('protected', 'Protected endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${env.API_PREFIX}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    logger.info('Swagger documentation available', {
      url: `http://localhost:${port}/${env.API_PREFIX}/docs`,
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
      url: `http://localhost:${port}/${env.API_PREFIX}`,
    },
  );

  logger.logStartup('Nexus Backend API started successfully', {
    port,
    environment: nodeEnv,
    url: `http://localhost:${port}/${env.API_PREFIX}`,
    apiDocs: env.ENABLE_SWAGGER && nodeEnv !== 'production' ? `http://localhost:${port}/${env.API_PREFIX}/docs` : undefined,
    healthCheck: `http://localhost:${port}/${env.API_PREFIX}/health`,
    sentryEnabled: sentryService.isReady(),
    configurationValid: true,
  });
}

void bootstrap().catch(async (error) => {
  console.error('❌ Failed to start application:', error);
  
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
