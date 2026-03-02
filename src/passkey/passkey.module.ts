import { Module } from '@nestjs/common';
import { PasskeyStoreService } from './passkey-store.service';
import { PasskeyService } from './passkey.service';
import { PasskeyController } from './passkey.controller';

@Module({
  providers: [PasskeyStoreService, PasskeyService],
  exports: [PasskeyService],
  controllers: [PasskeyController],
})
export class PasskeyModule {}
