import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { LoadBalancerModule } from '../load-balancer/load-balancer.module';
import { ServiceDiscoveryModule } from '../service-discovery/service-discovery.module';

@Module({
  imports: [
    TerminusModule,
    LoadBalancerModule,
    ServiceDiscoveryModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
