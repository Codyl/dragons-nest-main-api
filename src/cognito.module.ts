import { Global, Module } from '@nestjs/common';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

@Global()
@Module({
  providers: [
    {
      provide: 'COGNITO_CLIENT',
      useFactory: () => {
        return new CognitoIdentityProviderClient({
          region: process.env.AWS_REGION!,
          credentials: defaultProvider({ profile: 'member' }),
        });
      },
    },
  ],
  exports: ['COGNITO_CLIENT'],
})
export class CognitoModule {}
