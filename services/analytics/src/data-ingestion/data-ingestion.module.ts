import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DataIngestionService } from './data-ingestion.service';
import { DataIngestionController } from './data-ingestion.controller';
import { EventProcessor } from './processors/event.processor';
import { UserActivityProcessor } from './processors/user-activity.processor';
import { SystemMetricsProcessor } from './processors/system-metrics.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'event-processing' },
      { name: 'user-activity' },
      { name: 'system-metrics' },
    ),
  ],
  controllers: [DataIngestionController],
  providers: [
    DataIngestionService,
    EventProcessor,
    UserActivityProcessor,
    SystemMetricsProcessor,
  ],
  exports: [DataIngestionService],
})
export class DataIngestionModule {}
