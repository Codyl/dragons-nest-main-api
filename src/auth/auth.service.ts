import {
  ChallengeNameType,
  DeviceType,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createDeviceVerifier } from 'cognito-srp-helper';
import { CognitoService } from 'src/cognito/cognito.service';
import { UsersService } from 'src/users/users.service';
import type { Response } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private readonly cognitoService: CognitoService,
    private readonly usersService: UsersService,
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
      email,
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
    const qrString = `otpauth://totp/${process.env.COGNITO_CLIENT_ID}:${usernameForQr ?? 'user'}?secret=${response.SecretCode}&issuer=${process.env.COGNITO_CLIENT_ID}`;
    return {
      response,
      qrString,
    };
  }

  async connectAuthenticatorApp(
    session,
    userCode,
    friendlyDeviceName,
    accessToken,
    username,
    password,
  ) {
    const commandParams: {
      Session?: string;
      UserCode: string;
      FriendlyDeviceName?: string;
      AccessToken?: string;
    } = {
      UserCode: userCode as string,
      FriendlyDeviceName: (friendlyDeviceName as string) ?? 'Authenticator App',
    };
    if (accessToken) {
      commandParams.AccessToken = accessToken;
    } else {
      commandParams.Session = sessionStr;
    }

    await this.cognitoService.verifySoftwareToken(commandParams);

    const hasPassword = typeof password === 'string' && password.trim() !== '';
    const hasUsername = typeof username === 'string' && username.trim() !== '';

    if (accessToken && (!hasUsername || !hasPassword)) {
      await this.cognitoService.setUserMFAPreference(accessToken);
    }

    return await this.cognitoService.authenticateWithSrp(
      username as string,
      password as string,
    );
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

  // async setSession(email: string, password: string) {
  //   await Promise.resolve();
  //   return null;
  // }

  async logout(accessToken: string) {
    await this.cognitoService.globalSignOut(accessToken);

    return {
      message: 'Logged out successfully',
      data: {},
    };
  }

  async forgotPassword(email: string, password: string) {
    await this.cognitoService.forgotPassword(email);
  }

  async confirmForgotPassword(email: string, code: string, password: string) {
    await this.cognitoService.confirmForgotPassword(email, code, password);
    return null;
  }
}
