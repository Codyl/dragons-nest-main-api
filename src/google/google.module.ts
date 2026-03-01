import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleService } from './google.service';
import { GoogleController } from './google.controller';
import { OAuth2Client } from 'google-auth-library';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/users/entities/user.entity';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [
    GoogleService,
    {
      provide: 'GOOGLE_OAUTH2_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new OAuth2Client(config.get<string>('GOOGLE_CLIENT_ID'));
      },
    },
  ],
  controllers: [GoogleController],
  exports: [GoogleService],
})
export class GoogleModule {}
