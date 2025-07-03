import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
