import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Get logger service
  const logger = app.get(LoggerService);
  
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
  });

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
      .setDescription('NestJS backend service for Nexus workspace with structured logging')
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
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.logShutdown('Received SIGINT, shutting down gracefully', {
      signal: 'SIGINT',
    });
    await app.close();
    process.exit(0);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.fatal('Uncaught Exception', error, {
      operation: 'process.uncaughtException',
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal('Unhandled Rejection', new Error(String(reason)), {
      operation: 'process.unhandledRejection',
      metadata: { promise: String(promise) },
    });
    process.exit(1);
  });

  await app.listen(port);

  logger.logStartup('Nexus Backend API started successfully', {
    port,
    environment: nodeEnv,
    url: `http://localhost:${port}/${apiPrefix}`,
    apiDocs: nodeEnv !== 'production' ? `http://localhost:${port}/${apiPrefix}/docs` : undefined,
    healthCheck: `http://localhost:${port}/${apiPrefix}/health`,
  });
}

void bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
