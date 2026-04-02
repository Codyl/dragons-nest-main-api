import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CognitoModule } from './cognito/cognito.module';
import Joi from 'joi';
import { ProfileModule } from './profile/profile.module';
import { GoogleModule } from './google/google.module';
import { MaxmindModule } from './maxmind/maxmind.module';
import { MONGODB_URI } from 'src/env.constants';
import { EnvironmentVariables } from 'src/env.config';
import { HealthModule } from './health/health.module';
import { TestSupportModule } from './test-support/test-support.module';
import { TopicsModule } from './topics/topics.module';

const testOnlyImports =
  process.env.NODE_ENV === 'test' ? [TestSupportModule] : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath:
        process.env.NODE_ENV === 'test'
          ? '.env.test.local'
          : '.env.development.local',
      isGlobal: true,
      validationSchema: Joi.object({
        // Environment
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        APP_ENV: Joi.string()
          .valid('development', 'production', 'staging', 'test')
          .default('development'),

        PORT: Joi.number().port().default(3000),

        // Auth & Security
        COOKIE_SECRET: Joi.string().min(32).required(),
        JWT_SECRET: Joi.string().min(32).required(),

        // Cognito
        COGNITO_CLIENT_ID: Joi.string().required(),
        COGNITO_USER_POOL_ID: Joi.string().required(),
        COGNITO_CALLBACK_URL: Joi.string().uri().required(),
        AWS_REGION: Joi.string().default('us-east-1'),

        // Third Party
        IPSTACK_KEY: Joi.string().required(),
        MAXMIND_ACCOUNT_ID: Joi.string().required(),
        MAXMIND_KEY: Joi.string().required(),

        GOOGLE_CLIENT_ID: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),

        // Database
        MONGODB_URI: Joi.string()
          .uri({ scheme: [/mongodb(\+srv)?/] })
          .required(),

        FRONTEND_URL: Joi.string().uri().required(),

        PREEXISTING_USER_EMAIL: Joi.string().email().when('NODE_ENV', {
          is: 'test',
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),

        MAILSLURP_API_KEY: Joi.string().optional(),
        MAILSLURP_INBOX_ID: Joi.string().optional(),
        MAILSLURP_EMAIL: Joi.string().email().optional(),
      }),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables>) => ({
        uri: config.getOrThrow(MONGODB_URI, { infer: true }),
      }),
    }),
    AuthModule,
    UsersModule,
    CognitoModule,
    ProfileModule,
    GoogleModule,
    MaxmindModule,
    HealthModule,
    ...testOnlyImports,
    TopicsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
