import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ServiceDiscoveryService } from './service-discovery.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [ServiceDiscoveryService],
  exports: [ServiceDiscoveryService],
})
export class ServiceDiscoveryModule {}
