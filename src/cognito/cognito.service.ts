import {
  AdminDisableProviderForUserCommand,
  AdminGetUserCommand,
  AdminLinkProviderForUserCommand,
  AssociateSoftwareTokenCommand,
  AuthFlowType,
  ChallengeNameType,
  CognitoIdentityProviderClient,
  ChangePasswordCommand,
  ConfirmDeviceCommand,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  DeleteUserCommand,
  DeviceRememberedStatusType,
  DeviceSecretVerifierConfigType,
  ForgetDeviceCommand,
  ForgotPasswordCommand,
  GetDeviceCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  ListDevicesCommand,
  ResendConfirmationCodeCommand,
  RespondToAuthChallengeCommand,
  SetUserMFAPreferenceCommand,
  SignUpCommand,
  UpdateDeviceStatusCommand,
  UpdateUserAttributesCommand,
  VerifySoftwareTokenCommand,
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
import { ConfigService } from '@nestjs/config';
import {
  createSrpSession,
  signSrpSession,
  wrapAuthChallenge,
  wrapInitiateAuth,
} from 'cognito-srp-helper';
import {
  ACCESS_TOKEN_VERIFIER,
  COGNITO_CLIENT,
  ID_TOKEN_VERIFIER,
} from './cognito.constants';
import { COGNITO_CLIENT_ID, COGNITO_USER_POOL_ID } from 'env.constants';

interface JwtVerifier {
  verify(token: string): Promise<unknown>;
}

/** Narrow type for getUser result; avoids exposing full AWS SDK shape to callers and tests. */
export interface GetUserResult {
  UserAttributes?: Array<{ Name?: string; Value?: string }>;
  UserMFASettingList?: string[];
  PreferredMfaSetting?: string;
}

@Injectable()
export class CognitoService {
  constructor(
    @Inject(COGNITO_CLIENT)
    private readonly cognitoClient: CognitoIdentityProviderClient,
    @Inject(ACCESS_TOKEN_VERIFIER)
    private readonly accessTokenVerifier: JwtVerifier,
    @Inject(ID_TOKEN_VERIFIER)
    private readonly idTokenVerifier: JwtVerifier,
    private readonly configService: ConfigService,
  ) {}

  async authenticateWithSrp(
    username: string,
    password: string,
    deviceKey?: string,
    session?: string,
  ) {
    const clientId = this.configService.get<string>(COGNITO_CLIENT_ID)!;
    const poolId = this.configService.get<string>(COGNITO_USER_POOL_ID)!;

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
        ClientId: this.configService.get<string>(COGNITO_CLIENT_ID)!,
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
        ClientId: this.configService.get<string>(COGNITO_CLIENT_ID)!,
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
        UserPoolId: this.configService.get<string>(COGNITO_USER_POOL_ID)!,
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
        ClientId: this.configService.get<string>(COGNITO_CLIENT_ID)!,
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
        ClientId: this.configService.get<string>(COGNITO_CLIENT_ID)!,
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
        ClientId: this.configService.get<string>(COGNITO_CLIENT_ID)!,
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
        Session: session ? session : undefined,
        AccessToken: accessToken ? accessToken : undefined,
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

  async getUser(accessToken: string): Promise<GetUserResult | undefined> {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await this.cognitoClient.send(command);

      const result: GetUserResult = {
        UserAttributes: response.UserAttributes,
        UserMFASettingList: response.UserMFASettingList,
        PreferredMfaSetting: response.PreferredMfaSetting,
      };
      return result;
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
        ClientId: this.configService.get<string>(COGNITO_CLIENT_ID)!,
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
        ClientId: this.configService.get<string>(COGNITO_CLIENT_ID)!,
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
        ClientId: this.configService.get<string>(COGNITO_CLIENT_ID)!,
        Username: email,
      });

      const response = await this.cognitoClient.send(command);

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'UserNotFoundException') {
          throw new NotFoundException('User not found.');
        }

        if (error.name === 'LimitExceededException') {
          throw new BadRequestException(error.message);
        }
      }

      throw new InternalServerErrorException('Authentication service failed');
    }
  }

  async confirmForgotPassword(email: string, code: string, password: string) {
    try {
      const command = new ConfirmForgotPasswordCommand({
        ClientId: this.configService.get<string>(COGNITO_CLIENT_ID)!,
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

  async verifySoftwareToken(
    session: string,
    userCode: string,
    friendlyDeviceName: string,
    accessToken: string,
  ) {
    try {
      const command = new VerifySoftwareTokenCommand({
        Session: session ? session : undefined,
        UserCode: userCode,
        FriendlyDeviceName: friendlyDeviceName,
        AccessToken: accessToken,
      });

      const response = await this.cognitoClient.send(command);

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAuthorizedException') {
          throw new UnauthorizedException('Not authorized.');
        }

        if (error.name === 'ExpiredSessionException') {
          throw new BadRequestException('Session expired.');
        }

        if (error.name === 'EnableSoftwareTokenMFAException') {
          throw new BadRequestException('Software token MFA is not enabled.');
        }

        throw new InternalServerErrorException(error.message);
      }

      throw new InternalServerErrorException('Authentication service failed');
    }
  }

  async setUserMFAPreference(accessToken: string) {
    try {
      const command = new SetUserMFAPreferenceCommand({
        AccessToken: accessToken,
        SoftwareTokenMfaSettings: {
          Enabled: true,
          PreferredMfa: true,
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

      throw new InternalServerErrorException('Authentication service failed');
    }
  }

  async setUserMFAPreferenceWithSettings(
    accessToken: string,
    options: {
      smsMfaEnabled?: boolean;
      smsPreferred?: boolean;
      softwareTokenMfaEnabled?: boolean;
      softwareTokenPreferred?: boolean;
    },
  ) {
    try {
      const command = new SetUserMFAPreferenceCommand({
        AccessToken: accessToken,
        SoftwareTokenMfaSettings:
          options.softwareTokenMfaEnabled !== undefined
            ? {
                Enabled: options.softwareTokenMfaEnabled,
                PreferredMfa: options.softwareTokenPreferred ?? false,
              }
            : undefined,
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

  async updateUserAttributes(
    accessToken: string,
    attributes: { Name: string; Value: string }[],
  ) {
    try {
      const command = new UpdateUserAttributesCommand({
        AccessToken: accessToken,
        UserAttributes: attributes,
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

  async changePassword(
    accessToken: string,
    previousPassword: string,
    proposedPassword: string,
  ) {
    try {
      const command = new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: previousPassword,
        ProposedPassword: proposedPassword,
      });

      await this.cognitoClient.send(command);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAuthorizedException') {
          throw new UnauthorizedException('Not authorized.');
        }
      }

      throw new InternalServerErrorException('Authentication service failed');
    }
  }

  async deleteUser(accessToken: string) {
    try {
      const command = new DeleteUserCommand({
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

      throw new InternalServerErrorException('Authentication service failed');
    }
  }

  async updateDeviceStatus(
    accessToken: string,
    deviceKey: string,
    deviceRememberedStatus: DeviceRememberedStatusType,
  ) {
    try {
      const command = new UpdateDeviceStatusCommand({
        AccessToken: accessToken,
        DeviceKey: deviceKey,
        DeviceRememberedStatus: deviceRememberedStatus,
      });

      const response = await this.cognitoClient.send(command);

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'DeviceNotFoundException') {
          throw new NotFoundException('Device not found.');
        }
      }

      throw new InternalServerErrorException('Authentication service failed');
    }
  }

  async forgetDevice(accessToken: string, deviceKey: string) {
    try {
      const command = new ForgetDeviceCommand({
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

      throw new InternalServerErrorException('Authentication service failed');
    }
  }

  async listDevices(accessToken: string) {
    try {
      const command = new ListDevicesCommand({
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

      throw new InternalServerErrorException('Authentication service failed');
    }
  }

  async adminDisableProviderForUser(
    providerName: string,
    providerAttributeValue: string,
  ) {
    try {
      const command = new AdminDisableProviderForUserCommand({
        UserPoolId: this.configService.get<string>(COGNITO_USER_POOL_ID)!,
        User: {
          ProviderName: providerName,
          ProviderAttributeName: 'Cognito_Subject',
          ProviderAttributeValue: providerAttributeValue,
        },
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

  async adminLinkProviderForUser(
    cognitoSub: string,
    sourceProviderSub: string,
    sourceProviderName: string,
  ) {
    try {
      const command = new AdminLinkProviderForUserCommand({
        UserPoolId: this.configService.get<string>(COGNITO_USER_POOL_ID)!,
        DestinationUser: {
          ProviderName: 'Cognito',
          ProviderAttributeName: 'Cognito_Subject',
          ProviderAttributeValue: cognitoSub,
        },
        SourceUser: {
          ProviderName: sourceProviderName,
          ProviderAttributeName: 'Cognito_Subject',
          ProviderAttributeValue: sourceProviderSub,
        },
      });

      await this.cognitoClient.send(command);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'UserNotFoundException') {
          throw new NotFoundException('User not found.');
        }
      }

      throw new InternalServerErrorException('Authentication service failed');
    }
  }

  async verifyTokensForSetSession(AccessToken: string, IdToken: string) {
    try {
      if (AccessToken) await this.accessTokenVerifier.verify(AccessToken);

      if (IdToken) await this.idTokenVerifier.verify(IdToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
