import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SentryService } from './sentry.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SentryService,
      useFactory: (configService: ConfigService) => {
        return new SentryService(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [SentryService],
})
export class SentryModule {}
