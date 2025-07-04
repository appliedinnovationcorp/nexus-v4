import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';

// Core modules
import { DataIngestionModule } from './data-ingestion/data-ingestion.module';
import { RealTimeProcessingModule } from './real-time-processing/real-time-processing.module';
import { BusinessIntelligenceModule } from './business-intelligence/business-intelligence.module';
import { ReportingEngineModule } from './reporting-engine/reporting-engine.module';
import { HealthModule } from './health/health.module';

// Shared modules
import { RedisModule } from './shared/redis/redis.module';
import { MetricsModule } from './shared/metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    
    // Redis for caching and queues
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    
    // Task scheduling
    ScheduleModule.forRoot(),
    
    // Health checks
    TerminusModule,
    
    // Core analytics modules
    DataIngestionModule,
    RealTimeProcessingModule,
    BusinessIntelligenceModule,
    ReportingEngineModule,
    HealthModule,
    
    // Shared utilities
    RedisModule,
    MetricsModule,
  ],
})
export class AnalyticsModule {}
