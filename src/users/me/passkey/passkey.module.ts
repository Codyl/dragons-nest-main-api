import { Module } from '@nestjs/common';
import { PasskeyStoreService } from './passkey-store.service';
import { PasskeyService } from './passkey.service';

@Module({
  providers: [PasskeyStoreService, PasskeyService],
  exports: [PasskeyService],
})
export class PasskeyModule {}
