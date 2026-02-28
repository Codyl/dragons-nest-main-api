import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User } from 'src/users/entities/user.entity';
import { UserSchema } from 'src/users/entities/user.entity';
import { GoogleModule } from 'src/google/google.module';
import { PasskeyModule } from 'src/passkey/passkey.module';
import { UsersModule } from 'src/users/users.module';
import { MaxmindModule } from 'src/maxmind/maxmind.module';

@Module({
  controllers: [ProfileController],
  providers: [ProfileService],
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    GoogleModule,
    PasskeyModule,
    UsersModule,
    MaxmindModule,
  ],
})
export class ProfileModule {}
