import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CognitoService } from 'src/cognito/cognito.service';
import { UsersService } from 'src/users/users.service';
import { GoogleService } from 'src/google/google.service';
import { UpdateAccountDto } from './dto/update-account.dto';
import { MfaPreferenceDto } from './dto/mfa-preference.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreatePasswordDto } from './dto/create-password.dto';
import { MaxmindService } from 'src/maxmind/maxmind.service';
import { PasskeyStoreService } from 'src/passkey/passkey-store.service';
import type { AuthType } from 'src/common/guards/auth.guard';
import { MAXMIND_KEY } from 'src/env.constants';
import { EnvironmentVariables } from 'src/env.config';

export interface GetMeData {
  [key: string]: string | string[] | boolean | number | undefined;
  loginMethods: string[];
  hasPassword: boolean;
  hasPasskey: boolean;
  passkeyCount: number;
  softwareTokenMfaEnabled?: boolean;
  preferredMfa?: string;
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly cognitoService: CognitoService,
    private readonly usersService: UsersService,
    private readonly googleService: GoogleService,
    private readonly maxmindService: MaxmindService,
    private readonly passkeyStore: PasskeyStoreService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  async getMe(
    accessToken: string,
    authType: AuthType,
    currentUser: Record<string, unknown> & { sub?: string },
  ): Promise<GetMeData> {
    const sub = currentUser?.sub;
    if (!sub || typeof sub !== 'string') {
      throw new UnauthorizedException('Not authenticated');
    }

    if (authType === 'passkey') {
      const user = await this.usersService.findOneByCognitoSub(sub);
      if (!user || user.deleted) {
        throw new NotFoundException('User not found');
      }

      const loginMethods = user.linkedProviders ?? [];
      const hasPassword = user.hasPassword ?? true;
      const passkeyCount = await this.passkeyStore.countPasskeys(sub);

      return {
        sub,
        email: user.email,
        loginMethods,
        hasPassword,
        hasPasskey: passkeyCount > 0,
        passkeyCount,
      };
    }

    const response = await this.cognitoService.getUser(accessToken);
    if (!response?.UserAttributes) {
      throw new UnauthorizedException('Not authenticated');
    }

    const attributes = (response.UserAttributes ?? []).reduce(
      (acc, a) => {
        if (a.Name != null && a.Value != null) acc[a.Name] = a.Value;

        return acc;
      },
      {} as Record<string, string>,
    );
    const attrsSub = attributes.sub as string | undefined;
    if (!attrsSub || typeof attrsSub !== 'string') {
      throw new UnauthorizedException('Not authenticated');
    }

    const user = await this.usersService.findOneByCognitoSub(attrsSub);
    if (!user || user.deleted) {
      throw new NotFoundException('User not found');
    }

    const loginMethods = user.linkedProviders ?? [];
    const hasPassword = user.hasPassword ?? true;
    const passkeyCount = await this.passkeyStore.countPasskeys(attrsSub);
    const softwareTokenMfaEnabled =
      response.UserMFASettingList?.includes('SOFTWARE_TOKEN_MFA') ?? false;
    const preferredMfa = response.PreferredMfaSetting ?? undefined;

    return {
      ...attributes,
      loginMethods,
      hasPassword,
      hasPasskey: passkeyCount > 0,
      passkeyCount,
      softwareTokenMfaEnabled,
      preferredMfa,
    };
  }

  async updateAccount(accessToken: string, dto: UpdateAccountDto) {
    const attributes: { Name: string; Value: string }[] = [];
    if (dto.email !== undefined)
      attributes.push({ Name: 'email', Value: dto.email });

    if (dto.given_name !== undefined)
      attributes.push({ Name: 'given_name', Value: dto.given_name });

    if (dto.family_name !== undefined)
      attributes.push({ Name: 'family_name', Value: dto.family_name });

    if (dto.middle_name !== undefined)
      attributes.push({ Name: 'middle_name', Value: dto.middle_name });

    if (dto.phone_number !== undefined)
      attributes.push({ Name: 'phone_number', Value: dto.phone_number });

    if (attributes.length === 0) return;

    const response = await this.cognitoService.updateUserAttributes(
      accessToken,
      attributes,
    );
    if (!response) {
      throw new InternalServerErrorException(
        'Failed to update user attributes',
      );
    }

    return response;
  }

  async setMfaPreference(accessToken: string, dto: MfaPreferenceDto) {
    const response = await this.cognitoService.setUserMFAPreferenceWithSettings(
      accessToken,
      {
        softwareTokenMfaEnabled: dto.softwareTokenMfaEnabled,
        softwareTokenPreferred: dto.preferredMfa === 'softwareToken',
      },
    );

    if (!response) {
      throw new InternalServerErrorException('Failed to set MFA preference');
    }

    return response;
  }

  async changePassword(
    accessToken: string,
    cognitoSub: string,
    dto: ChangePasswordDto,
  ) {
    const cognitoResponse = await this.cognitoService.changePassword(
      accessToken,
      dto.currentPassword,
      dto.newPassword,
    );

    const userResponse = await this.usersService.updateByCognitoSub(
      cognitoSub,
      {
        hasPassword: true,
      },
    );

    return {
      cognitoResponse,
      userResponse,
    };
  }

  /**
   * Sets an initial password for users who authenticated via OAuth and have no password.
   */
  async createPassword(
    accessToken: string,
    cognitoSub: string,
    dto: CreatePasswordDto,
  ) {
    const user = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!user || user.deleted) {
      throw new NotFoundException('User not found');
    }

    if (user.hasPassword) {
      throw new BadRequestException(
        'Account already has a password. Use change password instead.',
      );
    }

    const cognitoUser = await this.cognitoService.getUser(accessToken);
    const username = cognitoUser?.UserAttributes?.find(
      (a) => a.Name === 'email' || a.Name === 'preferred_username',
    )?.Value;
    if (!username) {
      throw new BadRequestException('Could not resolve account username.');
    }

    await this.cognitoService.adminSetUserPassword(username, dto.newPassword);

    const userResponse = await this.usersService.updateByCognitoSub(
      cognitoSub,
      { hasPassword: true },
    );

    return { userResponse };
  }

  async linkGoogle(
    accessToken: string,
    cognitoSub: string,
    credential: string,
  ) {
    const { email: googleEmail, sub: googleSub } =
      await this.googleService.verifyCredential(credential);
    const cognitoUser = await this.cognitoService.getUser(accessToken);
    const cognitoEmail = cognitoUser?.UserAttributes?.find(
      (a) => a.Name === 'email' || a.Name === 'preferred_username',
    )?.Value;
    if (cognitoEmail && cognitoEmail !== googleEmail) {
      throw new BadRequestException(
        'Google account email must match your account email.',
      );
    }

    const cognitoResponse = await this.cognitoService.adminLinkProviderForUser(
      cognitoSub,
      googleSub,
      'Google',
    );
    const userResponse = await this.usersService.addLinkGoogle(
      cognitoSub,
      googleSub,
    );

    return {
      cognitoResponse,
      userResponse,
    };
  }

  async unlinkGoogle(accessToken: string, cognitoSub: string) {
    const user = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.linkedProviders?.includes('GOOGLE')) {
      throw new BadRequestException('Google account is not linked');
    }

    if (!user.hasPassword) {
      throw new BadRequestException(
        'You must create a password before you can disconnect your Google account.',
      );
    }

    const googleSub = user.linkedProviderSubjects?.GOOGLE;
    if (!googleSub) {
      throw new BadRequestException(
        'Unable to unlink Google (missing provider subject).',
      );
    }

    const cognitoResponse =
      await this.cognitoService.adminDisableProviderForUser(
        'Google',
        googleSub,
      );
    const userResponse = await this.usersService.removeLinkGoogle(cognitoSub);
    if (!cognitoResponse || !userResponse) {
      throw new InternalServerErrorException('Failed to unlink Google account');
    }

    return {
      cognitoResponse,
      userResponse,
    };
  }

  async deleteMe(accessToken: string, password: string, mfaCode?: string) {
    const payload = await this.cognitoService.getUser(accessToken);
    const username = payload?.UserAttributes?.find(
      (a) => a.Name === 'email' || a.Name === 'preferred_username',
    )?.Value;
    if (!username) {
      throw new UnauthorizedException('Invalid password');
    }

    // verify user has authorization to delete their account
    const authResponse = await this.cognitoService.authenticateWithSrp(
      username,
      password,
    );
    const srpAuthenticated = Boolean(authResponse?.AuthenticationResult);
    if (
      !srpAuthenticated &&
      authResponse?.ChallengeName === 'SOFTWARE_TOKEN_MFA'
    ) {
      const session = authResponse.Session;
      if (!session) {
        throw new InternalServerErrorException(
          'Could not complete account verification.',
        );
      }

      const code = mfaCode?.trim();
      if (!code) {
        throw new BadRequestException(
          'Enter the code from your authenticator app to delete your account.',
        );
      }

      const mfaResponse =
        await this.cognitoService.respondToSoftwareTokenMFAChallenge(
          username,
          code,
          session,
        );
      if (!mfaResponse?.AuthenticationResult) {
        throw new UnauthorizedException(
          'Invalid authenticator code or password.',
        );
      }
    } else if (!srpAuthenticated && authResponse?.ChallengeName === 'SMS_MFA') {
      throw new BadRequestException(
        'Account deletion is not supported with SMS two-factor authentication. Use an authenticator app or contact support.',
      );
    } else if (!srpAuthenticated) {
      throw new UnauthorizedException('Invalid password');
    }

    const cognitoResponse = await this.cognitoService.deleteUser(accessToken);
    if (!cognitoResponse) {
      throw new InternalServerErrorException('Failed to delete user');
    }

    const userResponse: { deleted: boolean; result: number } | null = null;

    const sub = payload?.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
    if (sub) {
      const deleteResult = await this.usersService.updateByCognitoSub(sub, {
        deleted: true,
      });
      if (!deleteResult) {
        throw new InternalServerErrorException('Failed to delete user');
      }
    }

    return {
      cognitoResponse,
      userResponse,
    };
  }

  async getKnownDevices(accessToken: string): Promise<
    {
      DeviceKey?: string;
      DeviceName?: string;
      DeviceLastIPUsed?: string;
      DeviceCreateDate?: Date;
      DeviceLastAuthenticatedDate?: Date;
      DeviceLastModifiedDate?: Date;
      City?: string;
      Region?: string;
      Country?: string;
    }[]
  > {
    const response = await this.cognitoService.listDevices(accessToken);
    const devices = response.Devices ?? [];
    const maxmindKey = this.configService.getOrThrow(MAXMIND_KEY, {
      infer: true,
    });
    const deviceData = await Promise.all(
      devices.map(async (device) => {
        const lastIPUsed = device.DeviceAttributes?.find(
          (a) => a.Name === 'last_ip_used',
        )?.Value;

        let city: string | undefined;
        let region: string | undefined;
        let country: string | undefined;
        if (lastIPUsed && maxmindKey) {
          try {
            const location = await this.maxmindService.getLocation(lastIPUsed);
            city = location.city?.names?.en;
            region = location.subdivisions?.[0]?.names?.en;
            country = location.country?.names?.en;
          } catch (error) {
            console.error('Error getting location from Maxmind', error);
          }
        }

        const DeviceName = device.DeviceAttributes?.find(
          (a) => a.Name === 'device_name',
        )?.Value;
        return {
          DeviceKey: device.DeviceKey,
          DeviceName,
          DeviceLastIPUsed: lastIPUsed,
          DeviceCreateDate: device.DeviceCreateDate,
          DeviceLastAuthenticatedDate: device.DeviceLastAuthenticatedDate,
          DeviceLastModifiedDate: device.DeviceLastModifiedDate,
          City: city,
          Region: region,
          Country: country,
        };
      }),
    );

    return deviceData;
  }
}
