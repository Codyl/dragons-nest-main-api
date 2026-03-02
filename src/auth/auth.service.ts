import {
  ChallengeNameType,
  DeviceType,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDeviceVerifier } from 'cognito-srp-helper';
import { COGNITO_CLIENT_ID } from 'env.constants';
import { EnvironmentVariables } from 'env.config';
import { CognitoService } from 'src/cognito/cognito.service';
import { UsersService } from 'src/users/users.service';

export interface SetSessionBody {
  AccessToken?: string;
  IdToken?: string;
  RefreshToken?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly cognitoService: CognitoService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  async initiateSignup(email: string, password: string) {
    const response = await this.cognitoService.signUp(email, password);

    return response;
  }

  async confirmSignup(
    email: string,
    code: string,
    session: string,
    password: string,
  ) {
    await this.cognitoService.confirmSignUp(email, code, session);

    const adminGetUserResponse = await this.cognitoService.adminGetUser(email);

    if (!adminGetUserResponse || !adminGetUserResponse.UserAttributes) {
      throw new NotFoundException('User not found.');
    }

    const sub = adminGetUserResponse.UserAttributes.find(
      (a) => a.Name === 'sub',
    )?.Value;

    if (!sub) {
      throw new NotFoundException('User not found.');
    }

    const foundUser = await this.usersService.findOneByCognitoSub(sub);
    if (foundUser) {
      throw new ConflictException('User already exists.');
    }

    await this.usersService.createUser(sub, true);

    const authResponse = await this.cognitoService.authenticateWithSrp(
      email,
      password,
    );
    if (!authResponse) {
      throw new NotFoundException('User not found.');
    }

    if (!authResponse.AuthenticationResult) {
      throw new NotFoundException('User not found.');
    }

    if (!authResponse.AuthenticationResult.AccessToken) {
      throw new NotFoundException('User not found.');
    }

    return {
      AccessToken: authResponse.AuthenticationResult.AccessToken,
      IdToken: authResponse.AuthenticationResult.IdToken,
      RefreshToken: authResponse.AuthenticationResult.RefreshToken,
    };
  }

  async confirmSignupResendCode(email: string) {
    await this.cognitoService.resendConfirmationCode(email);
  }

  async mfa(email: string, session: string, softwareTokenMfaCode: string) {
    const response =
      await this.cognitoService.respondToSoftwareTokenMFAChallenge(
        email,
        softwareTokenMfaCode,
        session,
      );

    return response;
  }

  async generateAuthenticatorSecret(
    email: string,
    session: string,
    accessToken: string,
  ) {
    const response = await this.cognitoService.associateSoftwareToken(
      accessToken,
      session,
    );
    if (!response) {
      throw new NotFoundException('Secret not found.');
    }

    let usernameForQr = email;
    if (!usernameForQr && accessToken) {
      const userResponse = await this.cognitoService.getUser(accessToken);
      usernameForQr =
        userResponse?.UserAttributes?.find(
          (a) => a.Name === 'email' || a.Name === 'preferred_username',
        )?.Value ?? 'user';
    }

    const clientId = this.configService.getOrThrow(COGNITO_CLIENT_ID, {
      infer: true,
    });
    const qrString = `otpauth://totp/${clientId}:${usernameForQr ?? 'user'}?secret=${response.SecretCode}&issuer=${clientId}`;
    return {
      response,
      qrString,
    };
  }

  async connectAuthenticatorApp(
    session: string | undefined,
    userCode: string,
    friendlyDeviceName: string | undefined,
    accessToken: string | undefined,
    username: string | undefined,
    password: string | undefined,
  ) {
    const commandParams: {
      Session?: string;
      UserCode: string;
      FriendlyDeviceName?: string;
      AccessToken?: string;
    } = {
      UserCode: userCode,
      FriendlyDeviceName: friendlyDeviceName ?? 'Authenticator App',
    };
    if (accessToken) {
      commandParams.AccessToken = accessToken;
    } else {
      commandParams.Session = session ?? '';
    }

    await this.cognitoService.verifySoftwareToken(
      commandParams.Session ?? '',
      commandParams.UserCode,
      commandParams.FriendlyDeviceName ?? 'Authenticator App',
      commandParams.AccessToken ?? '',
    );

    const hasPassword = typeof password === 'string' && password.trim() !== '';
    const hasUsername = typeof username === 'string' && username.trim() !== '';

    if (accessToken && (!hasUsername || !hasPassword)) {
      await this.cognitoService.setUserMFAPreference(accessToken);
    }
  }

  async verifyUsername(email: string, password: string) {
    const response = await this.cognitoService.initiateAuth(email, password);
    if (!response) {
      throw new NotFoundException('User not found.');
    }

    return response;
  }

  async initiateLogin(
    email: string,
    password: string,
    session: string,
    deviceKey: string,
    deviceName: string,
  ) {
    let response = await this.cognitoService.authenticateWithSrp(
      email,
      password,
      deviceKey,
      session,
    );
    if (!response.AuthenticationResult) {
      throw new NotFoundException('User not found.');
    }

    if (!response.AuthenticationResult.AccessToken) {
      throw new NotFoundException('User not found.');
    }

    const newDeviceMetadata = response.AuthenticationResult?.NewDeviceMetadata;

    let device: DeviceType | undefined;
    let deviceRandomPassword: string | undefined;
    if (!response.ChallengeName && response.AuthenticationResult) {
      if (newDeviceMetadata?.DeviceKey && newDeviceMetadata?.DeviceGroupKey) {
        const deviceVerifier = createDeviceVerifier(
          newDeviceMetadata.DeviceKey,
          newDeviceMetadata.DeviceGroupKey,
        );
        deviceRandomPassword = deviceVerifier.DeviceRandomPassword;

        await this.cognitoService.confirmDevice(
          response.AuthenticationResult.AccessToken,
          newDeviceMetadata.DeviceKey,
          deviceName,
          deviceVerifier.DeviceSecretVerifierConfig,
        );

        try {
          const deviceResponse = await this.cognitoService.getDevice(
            response.AuthenticationResult.AccessToken,
            newDeviceMetadata.DeviceKey,
          );
          if (!deviceResponse?.Device) {
            throw new NotFoundException('Device not found.');
          }

          device = deviceResponse.Device;
        } catch {
          device = undefined;
        }
      }
    }

    if (
      response.ChallengeName === ChallengeNameType.DEVICE_SRP_AUTH &&
      deviceRandomPassword
    ) {
      if (!response.Session) {
        throw new NotFoundException('Session not found.');
      }

      const deviceSrpResponse =
        await this.cognitoService.respondToDeviceSRPAuthChallenge(
          email,
          deviceRandomPassword,
          response.Session,
        );
      if (!deviceSrpResponse) {
        throw new NotFoundException('Device not found.');
      }

      response = deviceSrpResponse;
    }

    return {
      response,
      device,
    };
  }

  async refreshToken(refreshToken: string) {
    const response = await this.cognitoService.refreshToken(refreshToken);

    return response;
  }

  /**
   * Session handoff: verifies AccessToken and/or IdToken from frontend (e.g. after SRP in browser),
   * then caller sets HttpOnly cookies. At least one of AccessToken or IdToken is required.
   */
  async verifyTokensForSetSession(body: SetSessionBody): Promise<void> {
    const { AccessToken, IdToken } = body;

    if (!AccessToken && !IdToken) {
      throw new BadRequestException('AccessToken or IdToken required');
    }

    try {
      await this.cognitoService.verifyTokensForSetSession(
        AccessToken ?? '',
        IdToken ?? '',
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async logout(accessToken: string): Promise<void> {
    await this.cognitoService.globalSignOut(accessToken);
  }

  async forgotPassword(email: string): Promise<void> {
    await this.cognitoService.forgotPassword(email);
  }

  async confirmForgotPassword(email: string, code: string, password: string) {
    const response = await this.cognitoService.confirmForgotPassword(
      email,
      code,
      password,
    );
    if (!response) {
      throw new NotFoundException('Password reset code not found.');
    }

    const adminGetUserResponse = await this.cognitoService.adminGetUser(email);
    const sub = adminGetUserResponse?.UserAttributes?.find(
      (a) => a.Name === 'sub',
    )?.Value;
    if (!sub) {
      throw new NotFoundException('User not found.');
    }

    if (sub) {
      await this.usersService.updateByCognitoSub(sub, {
        hasPassword: true,
      });
    }

    const authResponse = await this.cognitoService.authenticateWithSrp(
      email,
      password,
    );
    return authResponse;
  }
}
