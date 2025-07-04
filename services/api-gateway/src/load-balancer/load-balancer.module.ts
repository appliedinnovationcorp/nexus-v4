import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LoadBalancerService } from './load-balancer.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [LoadBalancerService],
  exports: [LoadBalancerService],
})
export class LoadBalancerModule {}
