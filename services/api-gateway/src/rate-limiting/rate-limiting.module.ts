import { Module } from '@nestjs/common';
import { RateLimitingService } from './rate-limiting.service';

@Module({
  providers: [RateLimitingService],
  exports: [RateLimitingService],
})
export class RateLimitingModule {}
