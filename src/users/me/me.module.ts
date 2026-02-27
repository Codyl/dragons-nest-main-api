import { Module } from '@nestjs/common';
import { MeService } from './me.service';
import { MeController } from './me.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../entities/user.entity';
import { GoogleModule } from 'src/auth/google/google.module';
import { PasskeyModule } from './passkey/passkey.module';
import { UsersModule } from '../users.module';

@Module({
  controllers: [MeController],
  providers: [MeService],
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    GoogleModule,
    PasskeyModule,
    UsersModule,
  ],
})
export class MeModule {}
