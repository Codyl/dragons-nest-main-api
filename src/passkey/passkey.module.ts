import { Module } from '@nestjs/common';
import { PasskeyStoreService } from './passkey-store.service';
import { PasskeyService } from './passkey.service';
import { PasskeyController } from './passkey.controller';
import { AuthGuard } from 'src/common/guards/auth.guard';

@Module({
  providers: [PasskeyStoreService, PasskeyService, AuthGuard],
  exports: [PasskeyService],
  controllers: [PasskeyController],
})
export class PasskeyModule {}
