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
import type {
  ApiResponseDto,
  EmptyDataDto,
} from 'src/common/dto/api-response.dto';
import { ProfileService } from './profile.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AccessToken } from 'src/auth/decorators/access-token.decorator';
import { UpdateAccountDto } from './dto/update-account.dto';
import { MfaPreferenceDto } from './dto/mfa-preference.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LinkGoogleDto } from './dto/link-google.dto';
import { DeleteMeDto } from './dto/delete-me.dto';
import type { GetMeResponseDto } from './dto/out/get-me-response.dto';
import type { KnownDeviceResponseDto } from './dto/out/known-device-response.dto';

@ApiCookieAuth('ACCESS_TOKEN')
@Controller('profile')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  async getMe(
    @AccessToken() accessToken: string,
  ): Promise<ApiResponseDto<GetMeResponseDto>> {
    const data = await this.profileService.getMe(accessToken);

    return {
      message: 'User retrieved successfully',
      data: data as GetMeResponseDto,
    };
  }

  @Put('account')
  async updateAccount(
    @AccessToken() accessToken: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<ApiResponseDto<EmptyDataDto>> {
    await this.profileService.updateAccount(accessToken, dto);
    return {
      message: 'User settings updated successfully',
      data: {},
    };
  }

  @Post('mfa-preference')
  async setMfaPreference(
    @AccessToken() accessToken: string,
    @Body() dto: MfaPreferenceDto,
  ): Promise<ApiResponseDto<EmptyDataDto>> {
    await this.profileService.setMfaPreference(accessToken, dto);
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
  ): Promise<ApiResponseDto<EmptyDataDto>> {
    const cognitoSub = user?.sub;
    if (!cognitoSub || typeof cognitoSub !== 'string') {
      throw new Error('Not authenticated');
    }

    await this.profileService.changePassword(accessToken, cognitoSub, dto);
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
  ): Promise<ApiResponseDto<EmptyDataDto>> {
    const cognitoSub = user?.sub;
    if (!cognitoSub || typeof cognitoSub !== 'string') {
      throw new Error('Not authenticated');
    }

    await this.profileService.linkGoogle(
      accessToken,
      cognitoSub,
      dto.credential,
    );
    return {
      message: 'Google account linked successfully',
      data: {},
    };
  }

  @Post('unlink-google')
  async unlinkGoogle(
    @AccessToken() accessToken: string,
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
  ): Promise<ApiResponseDto<EmptyDataDto>> {
    const cognitoSub = user?.sub;
    if (!cognitoSub || typeof cognitoSub !== 'string') {
      throw new Error('Not authenticated');
    }

    await this.profileService.unlinkGoogle(accessToken, cognitoSub);
    return {
      message: 'Google account disconnected successfully',
      data: {},
    };
  }

  @Delete()
  async deleteMe(
    @AccessToken() accessToken: string,
    @Body() dto: DeleteMeDto,
  ): Promise<ApiResponseDto<EmptyDataDto>> {
    await this.profileService.deleteMe(accessToken, dto.password);
    return {
      message: 'User deleted successfully',
      data: {},
    };
  }

  @Get('known-devices')
  async getKnownDevices(
    @AccessToken() accessToken: string,
  ): Promise<ApiResponseDto<KnownDeviceResponseDto[]>> {
    const data = await this.profileService.getKnownDevices(accessToken);
    return {
      message: 'Known devices retrieved successfully',
      data: data as KnownDeviceResponseDto[],
    };
  }
}
