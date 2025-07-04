import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ReportingEngineService } from './reporting-engine.service';
import { ReportingEngineController } from './reporting-engine.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [ReportingEngineController],
  providers: [ReportingEngineService],
  exports: [ReportingEngineService],
})
export class ReportingEngineModule {}
