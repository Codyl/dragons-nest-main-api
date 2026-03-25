import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CognitoModule } from 'src/cognito/cognito.module';
import { EnvironmentVariables } from 'src/env.config';
import { MailslurpVerificationCodeResolver } from 'src/test-support/mailslurp-verification-code.resolver';
import { UsersModule } from 'src/users/users.module';
import { GoogleModule } from '../google/google.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  DefaultVerificationCodeResolver,
  VERIFICATION_CODE_RESOLVER,
} from './verification-code.resolver';

@Module({
  providers: [
    AuthService,
    {
      provide: VERIFICATION_CODE_RESOLVER,
      useFactory: (config: ConfigService<EnvironmentVariables>) => {
        const nodeEnv = config.get('NODE_ENV', { infer: true });
        const appEnv = config.get('APP_ENV', { infer: true });
        const apiKey = config.get('MAILSLURP_API_KEY', { infer: true });
        const inboxId = config.get('MAILSLURP_INBOX_ID', { infer: true });
        if (nodeEnv === 'test' && appEnv === 'test' && apiKey && inboxId) {
          return new MailslurpVerificationCodeResolver(config);
        }

        return new DefaultVerificationCodeResolver();
      },
      inject: [ConfigService],
    },
  ],
  controllers: [AuthController],
  imports: [GoogleModule, CognitoModule, UsersModule],
})
export class AuthModule {}
