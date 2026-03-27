import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PasskeyStoreService } from './passkey-store.service';
import { PasskeyService } from './passkey.service';
import { PasskeyController } from './passkey.controller';
import { PasskeyRepository } from './passkey.repository';
import { Passkey, PasskeySchema } from './entities/passkey.entity';
import { AuthGuard } from 'src/common/guards/auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Passkey.name, schema: PasskeySchema }]),
  ],
  providers: [
    PasskeyRepository,
    PasskeyStoreService,
    PasskeyService,
    AuthGuard,
  ],
  exports: [PasskeyService, PasskeyStoreService],
  controllers: [PasskeyController],
})
export class PasskeyModule {}
