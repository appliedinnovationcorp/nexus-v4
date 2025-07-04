import { Module } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { RoutingController } from './routing.controller';
import { LoadBalancerModule } from '../load-balancer/load-balancer.module';
import { ServiceDiscoveryModule } from '../service-discovery/service-discovery.module';
import { RateLimitingModule } from '../rate-limiting/rate-limiting.module';

@Module({
  imports: [
    LoadBalancerModule,
    ServiceDiscoveryModule,
    RateLimitingModule,
  ],
  controllers: [RoutingController],
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
