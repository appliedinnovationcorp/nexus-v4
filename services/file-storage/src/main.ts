import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { FileStorageModule } from './file-storage.module';

async function bootstrap() {
  const app = await NestFactory.create(FileStorageModule);

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
    .setTitle('Nexus File Storage Service')
    .setDescription('File storage and media management API with CDN integration')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.FILE_STORAGE_PORT || 3006;
  await app.listen(port);
  console.log(`🗄️ File Storage Service running on port ${port}`);
}

bootstrap().catch(console.error);
