import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BusinessIntelligenceService } from './business-intelligence.service';
import { BusinessIntelligenceController } from './business-intelligence.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [BusinessIntelligenceController],
  providers: [BusinessIntelligenceService],
  exports: [BusinessIntelligenceService],
})
export class BusinessIntelligenceModule {}
