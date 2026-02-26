import {
  AdminGetUserCommand,
  AssociateSoftwareTokenCommand,
  AuthFlowType,
  ChallengeNameType,
  CognitoIdentityProviderClient,
  ConfirmDeviceCommand,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  DeviceSecretVerifierConfigType,
  ForgotPasswordCommand,
  GetDeviceCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createSrpSession,
  signSrpSession,
  wrapAuthChallenge,
  wrapInitiateAuth,
} from 'cognito-srp-helper';

@Injectable()
export class CognitoService {
  constructor(
    @Inject('COGNITO_CLIENT')
    private readonly cognitoClient: CognitoIdentityProviderClient,
  ) {}

  async authenticateWithSrp(
    username: string,
    password: string,
    deviceKey?: string,
    session?: string,
  ) {
    const clientId = process.env.COGNITO_CLIENT_ID;
    const poolId = process.env.COGNITO_USER_POOL_ID;

    const srpSession = createSrpSession(username, password, poolId, false);
    const initiateInput = wrapInitiateAuth(srpSession, {
      AuthFlow: AuthFlowType.USER_SRP_AUTH,
      ClientId: clientId,
      AuthParameters: {
        USERNAME: username,
        ...(deviceKey ? { DEVICE_KEY: deviceKey } : {}),
      },
      ...(session ? { Session: session } : {}),
    });

    const initiateResponse = await this.cognitoClient.send(
      new InitiateAuthCommand(initiateInput),
    );

    if (
      initiateResponse.ChallengeName !== ChallengeNameType.PASSWORD_VERIFIER
    ) {
      return initiateResponse;
    }

    const signedSrpSession = signSrpSession(srpSession, initiateResponse);
    const challengeInput = wrapAuthChallenge(signedSrpSession, {
      ClientId: clientId,
      ChallengeName: ChallengeNameType.PASSWORD_VERIFIER,
      ChallengeResponses: {
        USERNAME: username,
        ...(deviceKey ? { DEVICE_KEY: deviceKey } : {}),
      },
      Session: initiateResponse.Session!,
    });
    return this.cognitoClient.send(
      new RespondToAuthChallengeCommand(challengeInput),
    );
  }

  async signUp(email: string, password: string) {
    try {
      const command = new SignUpCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
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

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'UsernameExistsException') {
          throw new ConflictException('This email is already registered.');
        }
        if (error.name === 'InvalidPasswordException') {
          throw new BadRequestException(
            'Password does not meet complexity requirements.',
          );
        }
      }

      // Fallback for unexpected errors
      throw new InternalServerErrorException('Authentication service failed');
    }
  }

  async confirmSignUp(email: string, code: string, session: string) {
    try {
      const command = new ConfirmSignUpCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
        Username: email,
        ConfirmationCode: code,
        Session: session,
      });

      const response = await this.cognitoClient.send(command);

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'UserNotFoundException') {
          throw new NotFoundException('User not found.');
        }
      }
    }
  }

  async adminGetUser(email: string) {
    try {
      const command = new AdminGetUserCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: email,
      });

      const response = await this.cognitoClient.send(command);

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'UserNotFoundException') {
          throw new NotFoundException('User not found.');
        }
      }
    }
  }

  async resendConfirmationCode(email: string) {
    try {
      const command = new ResendConfirmationCodeCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
        Username: email,
      });

      const response = await this.cognitoClient.send(command);

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'UserNotFoundException') {
          throw new NotFoundException('User not found.');
        }
      }
    }
  }

  async confirmDevice(
    accessToken: string,
    deviceKey: string,
    deviceName: string,
    deviceSecretVerifierConfig: DeviceSecretVerifierConfigType,
  ) {
    try {
      const command = new ConfirmDeviceCommand({
        AccessToken: accessToken,
        DeviceKey: deviceKey,
        DeviceSecretVerifierConfig: deviceSecretVerifierConfig,
        DeviceName: deviceName,
      });

      const response = await this.cognitoClient.send(command);

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'DeviceNotFoundException') {
          throw new NotFoundException('Device not found.');
        }
      }
    }
  }

  async getDevice(accessToken: string, deviceKey: string) {
    try {
      const command = new GetDeviceCommand({
        AccessToken: accessToken,
        DeviceKey: deviceKey,
      });

      const response = await this.cognitoClient.send(command);

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'DeviceNotFoundException') {
          throw new NotFoundException('Device not found.');
        }
      }
    }
  }

  async respondToDeviceSRPAuthChallenge(
    username: string,
    deviceRandomPassword: string,
    session: string,
  ) {
    try {
      const command = new RespondToAuthChallengeCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
        ChallengeName: ChallengeNameType.DEVICE_SRP_AUTH,
        ChallengeResponses: {
          USERNAME: username,
          DEVICE_PASSWORD: deviceRandomPassword,
        },
        Session: session,
      });

      const response = await this.cognitoClient.send(command);

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAuthorizedException') {
          throw new UnauthorizedException('Not authorized.');
        }
      }
    }
  }

  async respondToSoftwareTokenMFAChallenge(
    username: string,
    softwareTokenMfaCode: string,
    session: string,
  ) {
    try {
      const command = new RespondToAuthChallengeCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
        ChallengeName: ChallengeNameType.SOFTWARE_TOKEN_MFA,
        ChallengeResponses: {
          USERNAME: username,
          SOFTWARE_TOKEN_MFA_CODE: softwareTokenMfaCode,
        },
        Session: session,
      });

      const response = await this.cognitoClient.send(command);

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAuthorizedException') {
          throw new UnauthorizedException('Not authorized.');
        }
      }
    }
  }

  async associateSoftwareToken(accessToken: string, session: string) {
    try {
      const command = new AssociateSoftwareTokenCommand({
        Session: session,
        AccessToken: accessToken,
      });

      const response = await this.cognitoClient.send(command);

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAuthorizedException') {
          throw new UnauthorizedException('Not authorized.');
        }
      }
    }
  }

  async getUser(accessToken: string) {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await this.cognitoClient.send(command);

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'UserNotFoundException') {
          throw new NotFoundException('User not found.');
        }
      }
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        ClientId: process.env.COGNITO_CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      const response = await this.cognitoClient.send(command);

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAuthorizedException') {
          throw new UnauthorizedException('Not authorized.');
        }
      }
    }
  }

  async globalSignOut(accessToken: string) {
    try {
      const command = new GlobalSignOutCommand({ AccessToken: accessToken });
      const response = await this.cognitoClient.send(command);
      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAuthorizedException') {
          throw new UnauthorizedException('Not authorized.');
        }
      }
      throw new InternalServerErrorException('Authentication service failed');
    }
  }

  async initiateAuth(email: string, session: string) {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_AUTH,
        ClientId: process.env.COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
        },
        Session: session,
      });

      const response = await this.cognitoClient.send(command);

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAuthorizedException') {
          throw new UnauthorizedException('Not authorized.');
        }
      }
      throw new InternalServerErrorException('Authentication service failed');
    }
  }

  async forgotPassword(email: string) {
    try {
      const command = new ForgotPasswordCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
        Username: email,
      });

      const response = await this.cognitoClient.send(command);

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'UserNotFoundException') {
          throw new NotFoundException('User not found.');
        }
      }
      throw new InternalServerErrorException('Authentication service failed');
    }
  }

  async confirmForgotPassword(email: string, code: string, password: string) {
    try {
      const command = new ConfirmForgotPasswordCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
        Username: email,
        ConfirmationCode: code,
        Password: password,
      });

      const response = await this.cognitoClient.send(command);

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'UserNotFoundException') {
          throw new NotFoundException('User not found.');
        }
        if (error.name === 'ExpiredCodeException') {
          throw new BadRequestException('Code expired.');
        }
        if (error.name === 'InvalidPasswordException') {
          throw new BadRequestException(
            'Password does not meet complexity requirements.',
          );
        }
      }
      throw new InternalServerErrorException('Authentication service failed');
    }
  }
}
