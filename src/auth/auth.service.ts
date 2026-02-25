import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { Body, Inject, Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  constructor(
    @Inject('COGNITO_CLIENT')
    private readonly cognitoClient: CognitoIdentityProviderClient,
  ) {}

  async initiateSignup(@Body() body: { email: string; password: string }) {
    const { password, email } = body;

    const command = new SignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID!,
      Username: email,
      Password: password,
      UserAttributes: [
        {
          Name: 'email',
          Value: email,
        },
        {
          Name: 'updated_at',
          Value: Date.now().toString(),
        },
      ],
    });

    const response = await this.cognitoClient.send(command);

    return {
      message: 'Signup initiated successfully',
      data: {
        Session: response.CodeDeliveryDetails?.Destination ?? undefined,
      },
    };
  }

  async confirmSignup(@Body() body: { email: string; password: string }) {
    await Promise.resolve();
    return {
      message: 'Signup confirmed successfully',
      data: body,
    };
  }

  async confirmSignupResendCode(
    @Body() body: { email: string; password: string },
  ) {
    await Promise.resolve();
    return {
      message: 'Signup confirmation code resent successfully',
      data: body,
    };
  }

  async mfa(@Body() body: { email: string; password: string }) {
    await Promise.resolve();
    return {
      message: 'MFA initiated successfully',
      data: body,
    };
  }

  async generateAuthenticatorSecret(
    @Body() body: { email: string; password: string },
  ) {
    await Promise.resolve();
    return {
      message: 'Authenticator secret generated successfully',
      data: body,
    };
  }

  async connectAuthenticatorApp(
    @Body() body: { email: string; password: string },
  ) {
    await Promise.resolve();
    return {
      message: 'Authenticator app connected successfully',
      data: body,
    };
  }

  async verifyUsername(@Body() body: { email: string; password: string }) {
    await Promise.resolve();
    return {
      message: 'Username verified successfully',
      data: body,
    };
  }

  async initiateLogin(@Body() body: { email: string; password: string }) {
    await Promise.resolve();
    return {
      message: 'Login initiated successfully',
      data: body,
    };
  }

  async confirmLogin(@Body() body: { email: string; password: string }) {
    await Promise.resolve();
    return {
      message: 'Login confirmed successfully',
      data: body,
    };
  }

  async refreshToken(@Body() body: { email: string; password: string }) {
    await Promise.resolve();
    return {
      message: 'Token refreshed successfully',
      data: body,
    };
  }

  async setSession(@Body() body: { email: string; password: string }) {
    await Promise.resolve();
    return {
      message: 'Session set successfully',
      data: body,
    };
  }

  async logout(@Body() body: { email: string; password: string }) {
    await Promise.resolve();
    return {
      message: 'Logged out successfully',
      data: body,
    };
  }

  async forgotPassword(@Body() body: { email: string; password: string }) {
    await Promise.resolve();
    return {
      message: 'Forgot password successfully',
      data: body,
    };
  }

  async confirmForgotPassword(
    @Body() body: { email: string; password: string },
  ) {
    await Promise.resolve();
    return {
      message: 'Forgot password confirmed successfully',
      data: body,
    };
  }
}
