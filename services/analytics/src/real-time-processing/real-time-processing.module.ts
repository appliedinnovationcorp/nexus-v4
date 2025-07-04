import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { RealTimeProcessingService } from './real-time-processing.service';
import { RealTimeProcessingController } from './real-time-processing.controller';
import { StreamProcessor } from './processors/stream.processor';
import { AggregationProcessor } from './processors/aggregation.processor';
import { AlertProcessor } from './processors/alert.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'stream-processing' },
      { name: 'aggregation' },
      { name: 'alerts' },
    ),
  ],
  controllers: [RealTimeProcessingController],
  providers: [
    RealTimeProcessingService,
    StreamProcessor,
    AggregationProcessor,
    AlertProcessor,
  ],
  exports: [RealTimeProcessingService],
})
export class RealTimeProcessingModule {}
