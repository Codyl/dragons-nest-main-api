/* eslint-disable @typescript-eslint/no-unsafe-call -- Nest DI types not fully resolved by ESLint */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Controller returns typed message/data */
import {
  Body,
  Controller,
  Delete,
  Get,
  Put,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import { MeService } from './me.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AccessToken } from 'src/auth/decorators/access-token.decorator';
import { UpdateAccountDto } from './dto/update-account.dto';
import { MfaPreferenceDto } from './dto/mfa-preference.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LinkGoogleDto } from './dto/link-google.dto';
import { DeleteMeDto } from './dto/delete-me.dto';
import { RememberDeviceDto } from './dto/remember-device.dto';
import { ForgetDeviceDto } from './dto/forget-device.dto';
import { PasskeyService } from './passkey/passkey.service';

interface MessageDataResponse<T = object> {
  message: string;
  data: T;
}

@ApiCookieAuth('ACCESS_TOKEN')
@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(
    private readonly meService: MeService,
    private readonly passkeyService: PasskeyService,
  ) {}

  @Get()
  async getMe(
    @AccessToken() accessToken: string,
  ): Promise<MessageDataResponse<Awaited<ReturnType<MeService['getMe']>>>> {
    const data = await this.meService.getMe(accessToken);
    return {
      message: 'User retrieved successfully',
      data,
    };
  }

  @Put('account')
  async updateAccount(
    @AccessToken() accessToken: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<MessageDataResponse<Record<string, never>>> {
    await this.meService.updateAccount(accessToken, dto);
    return {
      message: 'User settings updated successfully',
      data: {},
    };
  }

  @Post('mfa-preference')
  async setMfaPreference(
    @AccessToken() accessToken: string,
    @Body() dto: MfaPreferenceDto,
  ): Promise<MessageDataResponse<Record<string, never>>> {
    await this.meService.setMfaPreference(accessToken, dto);
    return {
      message: 'MFA preferences updated successfully',
      data: {},
    };
  }

  @Post('change-password')
  async changePassword(
    @AccessToken() accessToken: string,
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
    @Body() dto: ChangePasswordDto,
  ): Promise<MessageDataResponse<Record<string, never>>> {
    const cognitoSub = user?.sub;
    if (!cognitoSub || typeof cognitoSub !== 'string') {
      throw new Error('Not authenticated');
    }
    await this.meService.changePassword(accessToken, cognitoSub, dto);
    return {
      message: 'Password changed successfully',
      data: {},
    };
  }

  @Post('link-google')
  async linkGoogle(
    @AccessToken() accessToken: string,
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
    @Body() dto: LinkGoogleDto,
  ): Promise<MessageDataResponse<Record<string, never>>> {
    const cognitoSub = user?.sub;
    if (!cognitoSub || typeof cognitoSub !== 'string') {
      throw new Error('Not authenticated');
    }
    await this.meService.linkGoogle(accessToken, cognitoSub, dto.credential);
    return {
      message: 'Google account linked successfully',
      data: {},
    };
  }

  @Post('unlink-google')
  async unlinkGoogle(
    @AccessToken() accessToken: string,
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
  ): Promise<MessageDataResponse<Record<string, never>>> {
    const cognitoSub = user?.sub;
    if (!cognitoSub || typeof cognitoSub !== 'string') {
      throw new Error('Not authenticated');
    }
    await this.meService.unlinkGoogle(accessToken, cognitoSub);
    return {
      message: 'Google account disconnected successfully',
      data: {},
    };
  }

  @Delete()
  async deleteMe(
    @AccessToken() accessToken: string,
    @Body() dto: DeleteMeDto,
  ): Promise<MessageDataResponse<Record<string, never>>> {
    await this.meService.deleteMe(accessToken, dto.password);
    return {
      message: 'User deleted successfully',
      data: {},
    };
  }

  @Post('remember-device')
  async rememberDevice(
    @AccessToken() accessToken: string,
    @Body() dto: RememberDeviceDto,
  ): Promise<
    MessageDataResponse<Awaited<ReturnType<MeService['rememberDevice']>>>
  > {
    const data = await this.meService.rememberDevice(accessToken, dto);
    return {
      message: 'Device remembered successfully',
      data,
    };
  }

  @Post('forget-device')
  async forgetDevice(
    @AccessToken() accessToken: string,
    @Body() dto: ForgetDeviceDto,
  ): Promise<MessageDataResponse<Record<string, never>>> {
    await this.meService.forgetDevice(accessToken, dto);
    return {
      message: 'Device forgotten successfully',
      data: {},
    };
  }

  @Get('known-devices')
  async getKnownDevices(
    @AccessToken() accessToken: string,
  ): Promise<
    MessageDataResponse<Awaited<ReturnType<MeService['getKnownDevices']>>>
  > {
    const data = await this.meService.getKnownDevices(accessToken);
    return {
      message: 'Known devices retrieved successfully',
      data,
    };
  }

  @Post('passkey/register/options')
  async passkeyRegisterOptions(
    @AccessToken() accessToken: string,
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
  ): Promise<
    MessageDataResponse<
      Awaited<ReturnType<PasskeyService['getRegistrationOptions']>>
    >
  > {
    const sub = user?.sub;
    if (!sub || typeof sub !== 'string') {
      throw new Error('Not authenticated');
    }
    const options = await this.passkeyService.getRegistrationOptions(
      accessToken,
      sub,
    );
    return {
      message: 'Registration options',
      data: options,
    };
  }

  @Post('passkey/register/verify')
  async passkeyRegisterVerify(
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
    @Body() body: unknown,
  ): Promise<MessageDataResponse<{ verified: boolean }>> {
    const sub = user?.sub;
    if (!sub || typeof sub !== 'string') {
      throw new Error('Not authenticated');
    }
    const result = await this.passkeyService.verifyRegistration(sub, body);
    return {
      message: result.verified
        ? 'Passkey registered successfully'
        : 'Passkey verification failed',
      data: { verified: result.verified },
    };
  }
}
