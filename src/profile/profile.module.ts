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
import { AuthGuard } from 'src/common/guards/auth.guard';

@Module({
  controllers: [ProfileController],
  providers: [ProfileService, AuthGuard],
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    GoogleModule,
    PasskeyModule,
    UsersModule,
    MaxmindModule,
  ],
})
export class ProfileModule {}
