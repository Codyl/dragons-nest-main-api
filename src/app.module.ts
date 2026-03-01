import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CognitoModule } from './cognito/cognito.module';
import Joi from 'joi';
import { ProfileModule } from './profile/profile.module';
import { PasskeyModule } from './passkey/passkey.module';
import { GoogleModule } from './google/google.module';
import { MaxmindModule } from './maxmind/maxmind.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env.development.local',
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .required(),
        MONGODB_URI: Joi.string().required(),
        COGNITO_CLIENT_ID: Joi.string().required(),
        COGNITO_USER_POOL_ID: Joi.string().required(),
        COGNITO_CALLBACK_URL: Joi.string().required(),
        IPSTACK_KEY: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),
        GOOGLE_CLIENT_ID: Joi.string().required(),
        FRONTEND_URL: Joi.string().required(),
      }),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
      }),
    }),
    AuthModule,
    UsersModule,
    CognitoModule,
    ProfileModule,
    PasskeyModule,
    GoogleModule,
    MaxmindModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
