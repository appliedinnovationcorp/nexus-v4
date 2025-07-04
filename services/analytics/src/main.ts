import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AnalyticsModule } from './analytics.module';

async function bootstrap() {
  // Create HTTP application
  const app = await NestFactory.create(AnalyticsModule);
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Enable CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Nexus Analytics Service')
    .setDescription('Real-time analytics and business intelligence API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Start HTTP server
  const httpPort = process.env.ANALYTICS_HTTP_PORT || 3003;
  await app.listen(httpPort);
  console.log(`🚀 Analytics HTTP Service running on port ${httpPort}`);

  // Create microservice for event processing
  const microservice = await NestFactory.createMicroservice<MicroserviceOptions>(
    AnalyticsModule,
    {
      transport: Transport.REDIS,
      options: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        retryAttempts: 5,
        retryDelay: 3000,
      },
    },
  );

  await microservice.listen();
  console.log('🔄 Analytics Microservice listening for events');
}

bootstrap().catch(console.error);
