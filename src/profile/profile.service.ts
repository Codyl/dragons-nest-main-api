import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DeviceRememberedStatusType } from '@aws-sdk/client-cognito-identity-provider';
import { CognitoService } from 'src/cognito/cognito.service';
import { UsersService } from 'src/users/users.service';
import { GoogleService } from 'src/google/google.service';
import { User } from 'src/users/entities/user.entity';
import { UpdateAccountDto } from './dto/update-account.dto';
import { MfaPreferenceDto } from './dto/mfa-preference.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RememberDeviceDto } from './dto/remember-device.dto';
import { ForgetDeviceDto } from './dto/forget-device.dto';
import { MaxmindService } from 'src/maxmind/maxmind.service';

export interface GetMeData {
  [key: string]: string | string[] | boolean | undefined;
  loginMethods: string[];
  hasPassword: boolean;
  softwareTokenMfaEnabled?: boolean;
  preferredMfa?: string;
}

@Injectable()
export class ProfileService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly cognitoService: CognitoService,
    private readonly usersService: UsersService,
    private readonly googleService: GoogleService,
    private readonly maxmindService: MaxmindService,
    private readonly configService: ConfigService,
  ) {}

  async getMe(accessToken: string): Promise<GetMeData> {
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
    const sub = attributes.sub as string | undefined;
    if (!sub || typeof sub !== 'string') {
      throw new UnauthorizedException('Not authenticated');
    }

    const user = await this.usersService.findOneByCognitoSub(sub);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const loginMethods = user.linkedProviders ?? [];
    const hasPassword = user.hasPassword ?? true;
    const softwareTokenMfaEnabled =
      response.UserMFASettingList?.includes('SOFTWARE_TOKEN_MFA') ?? false;
    const preferredMfa = response.PreferredMfaSetting ?? undefined;
    return {
      ...attributes,
      loginMethods,
      hasPassword,
      softwareTokenMfaEnabled,
      preferredMfa,
    };
  }

  async updateAccount(
    accessToken: string,
    dto: UpdateAccountDto,
  ): Promise<void> {
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

    await this.cognitoService.updateUserAttributes(accessToken, attributes);
  }

  async setMfaPreference(
    accessToken: string,
    dto: MfaPreferenceDto,
  ): Promise<void> {
    await this.cognitoService.setUserMFAPreferenceWithSettings(accessToken, {
      smsMfaEnabled: dto.smsMfaEnabled,
      smsPreferred: dto.preferredMfa === 'sms',
      softwareTokenMfaEnabled: dto.softwareTokenMfaEnabled,
      softwareTokenPreferred: dto.preferredMfa === 'softwareToken',
    });
  }

  async changePassword(
    accessToken: string,
    cognitoSub: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    await this.cognitoService.changePassword(
      accessToken,
      dto.currentPassword,
      dto.newPassword,
    );
    await this.usersService.updateByCognitoSub(cognitoSub, {
      hasPassword: true,
    });
  }

  async linkGoogle(
    accessToken: string,
    cognitoSub: string,
    credential: string,
  ): Promise<void> {
    const { email: googleEmail, sub: googleSub } =
      await this.googleService.verifyCredential(credential);
    const userResponse = await this.cognitoService.getUser(accessToken);
    const cognitoEmail = userResponse?.UserAttributes?.find(
      (a) => a.Name === 'email' || a.Name === 'preferred_username',
    )?.Value;
    if (cognitoEmail && cognitoEmail !== googleEmail) {
      throw new BadRequestException(
        'Google account email must match your account email.',
      );
    }

    await this.cognitoService.adminLinkProviderForUser(
      cognitoSub,
      googleSub,
      'Google',
    );
    await this.usersService.addLinkGoogle(cognitoSub, googleSub);
  }

  async unlinkGoogle(accessToken: string, cognitoSub: string): Promise<void> {
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

    await this.cognitoService.adminDisableProviderForUser('Google', googleSub);
    await this.usersService.removeLinkGoogle(cognitoSub);
  }

  async deleteMe(accessToken: string, password: string): Promise<void> {
    const payload = await this.cognitoService.getUser(accessToken);
    const username = payload?.UserAttributes?.find(
      (a) => a.Name === 'email' || a.Name === 'preferred_username',
    )?.Value;
    if (!username) {
      throw new UnauthorizedException('Invalid password');
    }

    const authResponse = await this.cognitoService.authenticateWithSrp(
      username,
      password,
    );
    if (!authResponse?.AuthenticationResult) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.cognitoService.deleteUser(accessToken);
    const sub = payload?.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
    if (sub) {
      await this.userModel.deleteOne({ cognitoSub: sub });
    }
  }

  async rememberDevice(accessToken: string, dto: RememberDeviceDto) {
    const response = await this.cognitoService.updateDeviceStatus(
      accessToken,
      dto.deviceKey,
      dto.shouldRememberDevice
        ? DeviceRememberedStatusType.REMEMBERED
        : DeviceRememberedStatusType.NOT_REMEMBERED,
    );
    return response;
  }

  async forgetDevice(accessToken: string, dto: ForgetDeviceDto): Promise<void> {
    await this.cognitoService.forgetDevice(accessToken, dto.deviceKey);
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
    const maxmindKey = this.configService.get<string>('MAXMIND_KEY');
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
