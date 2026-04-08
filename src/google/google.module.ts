import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleService } from './google.service';
import { GoogleController } from './google.controller';
import { OAuth2Client } from 'google-auth-library';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/users/entities/user.schema';
import { GOOGLE_CLIENT_ID } from 'src/env.constants';
import { EnvironmentVariables } from 'src/env.config';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [
    GoogleService,
    {
      provide: 'GOOGLE_OAUTH2_CLIENT',
      inject: [ConfigService<EnvironmentVariables>],
      useFactory: (config: ConfigService<EnvironmentVariables>) => {
        return new OAuth2Client(
          config.getOrThrow(GOOGLE_CLIENT_ID, { infer: true }),
        );
      },
    },
  ],
  controllers: [GoogleController],
  exports: [GoogleService],
})
export class GoogleModule {}
