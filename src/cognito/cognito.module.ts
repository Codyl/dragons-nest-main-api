import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

import { CognitoService } from './cognito.service';

@Global()
@Module({
  providers: [
    {
      provide: 'COGNITO_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new CognitoIdentityProviderClient({
          region: config.get<string>('AWS_REGION'),
          credentials: defaultProvider({ profile: 'member' }),
        });
      },
    },
    {
      provide: 'ACCESS_TOKEN_VERIFIER',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return CognitoJwtVerifier.create({
          userPoolId: config.get<string>('COGNITO_USER_POOL_ID')!,
          tokenUse: 'access',
          clientId: config.get<string>('COGNITO_CLIENT_ID')!,
        });
      },
    },
    {
      provide: 'ID_TOKEN_VERIFIER',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return CognitoJwtVerifier.create({
          userPoolId: config.get<string>('COGNITO_USER_POOL_ID')!,
          tokenUse: 'id',
          clientId: config.get<string>('COGNITO_CLIENT_ID')!,
        });
      },
    },
    CognitoService,
  ],
  exports: [
    'COGNITO_CLIENT',
    'ACCESS_TOKEN_VERIFIER',
    'ID_TOKEN_VERIFIER',
    CognitoService,
  ],
})
export class CognitoModule {}
