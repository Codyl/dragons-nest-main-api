import { Global, Module } from '@nestjs/common';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

import { CognitoService } from './cognito.service';

@Global()
@Module({
  providers: [
    {
      provide: 'COGNITO_CLIENT',
      useFactory: () => {
        return new CognitoIdentityProviderClient({
          region: process.env.AWS_REGION,
          credentials: defaultProvider({ profile: 'member' }),
        });
      },
    },
    {
      provide: 'ACCESS_TOKEN_VERIFIER',
      useFactory: () => {
        return CognitoJwtVerifier.create({
          userPoolId: process.env.COGNITO_USER_POOL_ID,
          tokenUse: 'access',
          clientId: process.env.COGNITO_CLIENT_ID,
        });
      },
    },
    {
      provide: 'ID_TOKEN_VERIFIER',
      useFactory: () => {
        return CognitoJwtVerifier.create({
          userPoolId: process.env.COGNITO_USER_POOL_ID,
          tokenUse: 'id',
          clientId: process.env.COGNITO_CLIENT_ID,
        });
      },
    },
    CognitoService,
  ],
  exports: ['COGNITO_CLIENT', 'ACCESS_TOKEN_VERIFIER', 'ID_TOKEN_VERIFIER', CognitoService],
})
export class CognitoModule {}
