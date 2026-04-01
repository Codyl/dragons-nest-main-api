import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CognitoService } from 'src/cognito/cognito.service';
import { UsersService, type UserDoc } from 'src/users/users.service';
import { GoogleService } from 'src/google/google.service';
import { UpdateAccountDto } from './dto/update-account.dto';
import { MfaPreferenceDto } from './dto/mfa-preference.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreatePasswordDto } from './dto/create-password.dto';
import { MaxmindService } from 'src/maxmind/maxmind.service';
import { resolveCognitoWebAuthnCredentialDisplay } from 'src/profile/webauthn-credential-display';
import type { WebAuthnCredentialListItemDto } from 'src/profile/dto/out/webauthn-credential-list-item.dto';
import { MAXMIND_KEY } from 'src/env.constants';
import { EnvironmentVariables } from 'src/env.config';
import { DeleteMeDto } from './dto/delete-me.dto';
import { AccountSetupDto } from './dto/account-setup.dto';

export interface GetMeData {
  [key: string]: string | string[] | boolean | number | null | undefined;
  loginMethods: string[];
  hasPassword: boolean;
  hasPasskey: boolean;
  passkeyCount: number;
  softwareTokenMfaEnabled?: boolean;
  preferredMfa?: string;
  firstLoggedInAt?: string | null;
  completedAt?: string | null;
}

function firstLoggedInAtToIso(value: Date | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  return value instanceof Date
    ? value.toISOString()
    : new Date(value as string | number).toISOString();
}

/** Normalize optional Mongoose date paths for ESLint-safe handling. */
function mongoDateOrNull(value: unknown): Date | null {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }

  return null;
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly cognitoService: CognitoService,
    private readonly usersService: UsersService,
    private readonly googleService: GoogleService,
    private readonly maxmindService: MaxmindService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  async getMe(
    accessToken: string,
    currentUser: Record<string, unknown> & { sub?: string },
  ): Promise<GetMeData> {
    const sub = currentUser?.sub;
    if (!sub || typeof sub !== 'string') {
      throw new UnauthorizedException('Not authenticated');
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

    const row = await this.usersService.findOneByCognitoSub(attrsSub);
    if (!row || row.deleted) {
      throw new NotFoundException('User not found');
    }

    const user: UserDoc = row;

    const loginMethods = user.linkedProviders ?? [];
    const hasPassword = user.hasPassword ?? true;
    let passkeyCount = 0;
    try {
      const listRes =
        await this.cognitoService.listWebAuthnCredentials(accessToken);
      passkeyCount = listRes?.Credentials?.length ?? 0;
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        passkeyCount = 0;
      } else {
        throw e;
      }
    }
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
      firstLoggedInAt: firstLoggedInAtToIso(
        mongoDateOrNull(Reflect.get(user, 'firstLoggedInAt')),
      ),
      completedAt: firstLoggedInAtToIso(
        mongoDateOrNull(Reflect.get(user, 'completedAt')),
      ),
    };
  }

  async startWebAuthnRegistration(accessToken: string) {
    const res =
      await this.cognitoService.startWebAuthnRegistration(accessToken);
    if (!res?.CredentialCreationOptions) {
      throw new InternalServerErrorException(
        'Could not start passkey registration',
      );
    }

    return res.CredentialCreationOptions as Record<string, unknown>;
  }

  async completeWebAuthnRegistration(
    accessToken: string,
    credential: Record<string, unknown>,
  ) {
    await this.cognitoService.completeWebAuthnRegistration(
      accessToken,
      credential,
    );
  }

  async listWebAuthnCredentialsForSettings(
    accessToken: string,
  ): Promise<WebAuthnCredentialListItemDto[]> {
    try {
      return await this.listWebAuthnCredentialsForSettingsInner(accessToken);
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        return [];
      }

      throw e;
    }
  }

  private async listWebAuthnCredentialsForSettingsInner(
    accessToken: string,
  ): Promise<WebAuthnCredentialListItemDto[]> {
    const res = await this.cognitoService.listWebAuthnCredentials(accessToken);
    const rows = res?.Credentials ?? [];
    return rows.map((c) => {
      const { displayName, provider } = resolveCognitoWebAuthnCredentialDisplay(
        {
          FriendlyCredentialName: c.FriendlyCredentialName,
          AuthenticatorAttachment: c.AuthenticatorAttachment,
          AuthenticatorTransports: c.AuthenticatorTransports,
        },
      );
      return {
        credentialId: c.CredentialId ?? '',
        displayName,
        provider,
        createdAt: c.CreatedAt
          ? new Date(c.CreatedAt).toISOString()
          : new Date(0).toISOString(),
        lastUsedAt: null,
      };
    });
  }

  async deleteWebAuthnCredential(
    accessToken: string,
    credentialId: string,
  ): Promise<void> {
    await this.cognitoService.deleteWebAuthnCredential(
      accessToken,
      credentialId,
    );
  }

  /**
   * Persists onboarding wizard data and sets Cognito given_name. Does not set
   * firstLoggedInAt (that remains POST /profile/first-login after welcome).
   */
  async saveAccountSetup(
    accessToken: string,
    cognitoSub: string,
    dto: AccountSetupDto,
  ): Promise<{ completedAt: string }> {
    const row = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!row || row.deleted) {
      throw new NotFoundException('User not found');
    }

    const name = dto.name.trim();
    const cognitoResponse = await this.cognitoService.updateUserAttributes(
      accessToken,
      [{ Name: 'given_name', Value: name }],
    );
    if (!cognitoResponse) {
      throw new InternalServerErrorException(
        'Failed to update profile name in Cognito',
      );
    }

    const updated = await this.usersService.updateByCognitoSub(cognitoSub, {
      age: dto.age,
      avatar_id: dto.avatar,
      interests: dto.interests,
      shortTermGoal: dto.shortTermGoal,
      longTermGoal: dto.longTermGoal,
      learningStyles: dto.learningStyles,
      completedAt: new Date(),
    });

    if (!updated) {
      throw new InternalServerErrorException('Failed to save account setup');
    }

    const ts = mongoDateOrNull(Reflect.get(updated, 'completedAt'));
    if (!ts) {
      throw new InternalServerErrorException('Failed to save account setup');
    }

    return { completedAt: firstLoggedInAtToIso(ts)! };
  }

  /**
   * Records first in-app login (welcome completion). Idempotent if already set.
   */
  async recordFirstLoginAt(
    cognitoSub: string,
  ): Promise<{ firstLoggedInAt: string }> {
    const row = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!row || row.deleted) {
      throw new NotFoundException('User not found');
    }

    const user: UserDoc = row;

    const existing = mongoDateOrNull(Reflect.get(user, 'firstLoggedInAt'));
    if (existing) {
      return {
        firstLoggedInAt: firstLoggedInAtToIso(existing)!,
      };
    }

    const updated = await this.usersService.updateByCognitoSub(cognitoSub, {
      firstLoggedInAt: new Date(),
    });

    if (!updated) {
      throw new InternalServerErrorException('Failed to record first login');
    }

    const ts = mongoDateOrNull(Reflect.get(updated, 'firstLoggedInAt'));
    if (!ts) {
      throw new InternalServerErrorException('Failed to record first login');
    }

    return { firstLoggedInAt: firstLoggedInAtToIso(ts)! };
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

  async deleteMe(accessToken: string, dto: DeleteMeDto) {
    const payload = await this.cognitoService.getUser(accessToken);
    const username = payload?.UserAttributes?.find(
      (a) => a.Name === 'email' || a.Name === 'preferred_username',
    )?.Value;
    const cognitoSub = payload?.UserAttributes?.find(
      (a) => a.Name === 'sub',
    )?.Value;

    if (!username || !cognitoSub) {
      throw new UnauthorizedException('Invalid session');
    }

    const row = await this.usersService.findOneByCognitoSub(cognitoSub);
    if (!row || row.deleted) {
      throw new NotFoundException('User not found');
    }

    const hasPassword = row.hasPassword ?? true;

    if (!hasPassword) {
      const cred = dto.googleCredential?.trim();
      if (!cred) {
        throw new BadRequestException(
          'Sign in with Google to confirm deleting your account.',
        );
      }

      if (!row.linkedProviders?.includes('GOOGLE')) {
        throw new BadRequestException(
          'Your account cannot be verified for deletion. Contact support.',
        );
      }

      const { email: googleEmail, sub: googleSub } =
        await this.googleService.verifyCredential(cred);
      const linkedGoogleSub = row.linkedProviderSubjects?.GOOGLE;
      if (linkedGoogleSub && linkedGoogleSub !== googleSub) {
        throw new BadRequestException(
          'That Google account is not linked to this profile.',
        );
      }

      if (username !== googleEmail) {
        throw new BadRequestException(
          'Google account email must match your account email.',
        );
      }
    } else {
      const password = dto.password?.trim();
      if (!password || password.length < 8) {
        throw new BadRequestException('Password must be at least 8 characters');
      }

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

        const code = dto.mfaCode?.trim();
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
      } else if (
        !srpAuthenticated &&
        authResponse?.ChallengeName === 'SMS_MFA'
      ) {
        throw new BadRequestException(
          'Account deletion is not supported with SMS two-factor authentication. Use an authenticator app or contact support.',
        );
      } else if (!srpAuthenticated) {
        throw new UnauthorizedException('Invalid password');
      }
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
