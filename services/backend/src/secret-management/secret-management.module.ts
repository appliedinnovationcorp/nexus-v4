import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecretManagementService } from './secret-management.service';
import { SecretManagementController } from './secret-management.controller';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [SecretManagementController],
  providers: [SecretManagementService],
  exports: [SecretManagementService],
})
export class SecretManagementModule {}
