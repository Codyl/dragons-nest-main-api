import {
  Body,
  Controller,
  Delete,
  Get,
  Put,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type {
  ApiResponseDto,
  EmptyDataDto,
} from 'src/common/dto/api-response.dto';
import { ProfileService } from './profile.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AccessToken } from 'src/auth/decorators/access-token.decorator';
import { AuthType } from 'src/auth/decorators/auth-type.decorator';
import type { AuthType as AuthTypeValue } from 'src/common/guards/auth.guard';
import { UpdateAccountDto } from './dto/update-account.dto';
import { MfaPreferenceDto } from './dto/mfa-preference.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreatePasswordDto } from './dto/create-password.dto';
import { LinkGoogleDto } from './dto/link-google.dto';
import { DeleteMeDto } from './dto/delete-me.dto';
import type { GetMeResponseDto } from './dto/out/get-me-response.dto';
import type { KnownDeviceResponseDto } from './dto/out/known-device-response.dto';

@ApiCookieAuth('ACCESS_TOKEN')
@Controller('profile')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @ApiOperation({
    summary: "Gets the logged in user's profile information",
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired.',
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user is not allowed to access this profile.',
  })
  @ApiNotFoundResponse({
    description: 'Profile data could not be found for the authenticated user.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server/Cognito/database failure while fetching profile.',
  })
  @ApiBadRequestResponse({
    description: 'InvalidParameterException',
  })
  @ApiUnauthorizedResponse({
    description:
      'NotAuthorizedException or UserNotConfirmedException or PasswordResetRequiredException',
  })
  @ApiNotFoundResponse({
    description: 'UserNotFoundException or ResourceNotFoundException',
  })
  @ApiTooManyRequestsResponse({
    description: 'TooManyRequestsException',
  })
  @ApiInternalServerErrorResponse({
    description:
      'InternalErrorException or CognitoIdentityProviderServiceException',
  })
  @Get()
  async getMe(
    @AccessToken() accessToken: string,
    @AuthType() authType: AuthTypeValue,
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
  ): Promise<ApiResponseDto<GetMeResponseDto>> {
    const data = await this.profileService.getMe(accessToken, authType, user);

    return {
      message: 'User retrieved successfully',
      data: data as GetMeResponseDto,
    };
  }

  @ApiOperation({
    summary: "Updates the logged in user's cognito profile information",
  })
  @ApiBadRequestResponse({
    description:
      'Update payload is invalid or contains unsupported attributes.',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired.',
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user is not allowed to update this profile.',
  })
  @ApiNotFoundResponse({
    description: 'Target user/profile could not be found.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server/Cognito/database failure while updating profile.',
  })
  @ApiBadRequestResponse({
    description:
      'AliasExistsException, CodeDeliveryFailureException, CodeMismatchException, ExpiredCodeException, InvalidEmailRoleAccessPolicyException, InvalidLambdaResponseException, InvalidParameterException, InvalidSmsRoleAccessPolicyException, InvalidSmsRoleTrustRelationshipException, UnexpectedLambdaException, UserLambdaValidationException',
  })
  @ApiUnauthorizedResponse({
    description:
      'NotAuthorizedException, PasswordResetRequiredException, UserNotConfirmedException',
  })
  @ApiForbiddenResponse({
    description: 'ForbiddenException',
  })
  @ApiNotFoundResponse({
    description: 'UserNotFoundException, ResourceNotFoundException',
  })
  @ApiTooManyRequestsResponse({
    description: 'TooManyRequestsException',
  })
  @ApiInternalServerErrorResponse({
    description:
      'InternalErrorException, CognitoIdentityProviderServiceException',
  })
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

  @ApiOperation({
    summary:
      "Sets the logged in user's MFA preference to software token indicating that the user has setup and enabled TOTP MFA",
  })
  @ApiBadRequestResponse({
    description:
      'MFA preference payload is invalid or missing required fields.',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired.',
  })
  @ApiUnauthorizedResponse({
    description:
      'NotAuthorizedException, PasswordResetRequiredException, UserNotConfirmedException',
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user is not allowed to modify MFA preferences.',
  })
  @ApiNotFoundResponse({
    description: 'User or MFA configuration context was not found.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server/Cognito failure while updating MFA preference.',
  })
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

  @ApiOperation({
    summary: "Changes the logged in user's password",
  })
  @ApiBadRequestResponse({
    description:
      'Current/new password payload is invalid or fails password policy.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Access token is missing, invalid, expired, or user is unauthenticated.',
  })
  @ApiForbiddenResponse({
    description: 'Password change is forbidden by account policy/state.',
  })
  @ApiNotFoundResponse({
    description: 'Authenticated user account was not found.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server or Cognito failure while changing password.',
  })
  @ApiBadRequestResponse({
    description:
      'InvalidParameterException, InvalidPasswordException, PasswordHistoryPolicyViolationException, LimitExceededException',
  })
  @ApiUnauthorizedResponse({
    description:
      'NotAuthorizedException, PasswordResetRequiredException, UserNotConfirmedException',
  })
  @ApiForbiddenResponse({
    description: 'ForbiddenException',
  })
  @ApiNotFoundResponse({
    description: 'UserNotFoundException, ResourceNotFoundException',
  })
  @ApiTooManyRequestsResponse({
    description: 'TooManyRequestsException',
  })
  @ApiInternalServerErrorResponse({
    description:
      'InternalErrorException, CognitoIdentityProviderServiceException',
  })
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

  @ApiOperation({
    summary:
      'Sets an initial password for OAuth-only accounts (no current password required)',
  })
  @ApiBadRequestResponse({
    description:
      'Payload invalid, user already has a password, or username could not be resolved.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Access token is missing, invalid, expired, or user is unauthenticated.',
  })
  @ApiNotFoundResponse({
    description: 'User record was not found.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server or Cognito failure while setting password.',
  })
  @Post('create-password')
  async createPassword(
    @AccessToken() accessToken: string,
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
    @Body() dto: CreatePasswordDto,
  ): Promise<ApiResponseDto<EmptyDataDto>> {
    const cognitoSub = user?.sub;
    if (!cognitoSub || typeof cognitoSub !== 'string') {
      throw new Error('Not authenticated');
    }

    await this.profileService.createPassword(accessToken, cognitoSub, dto);
    return {
      message: 'Password created successfully',
      data: {},
    };
  }

  @ApiOperation({
    summary:
      "Links a Google account to the logged in user's cognito profile and user document in the database",
  })
  @ApiBadRequestResponse({
    description: 'Google credential payload is invalid or cannot be verified.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Access token is missing, invalid, expired, or user is unauthenticated.',
  })
  @ApiForbiddenResponse({
    description: 'Google account linking is forbidden by account policy/state.',
  })
  @ApiNotFoundResponse({
    description: 'Authenticated user account was not found.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server/Google/Cognito failure while linking account.',
  })
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

  @ApiOperation({
    summary:
      "Unlinks a Google account from the logged in user's cognito profile and user document in the database",
  })
  @ApiUnauthorizedResponse({
    description:
      'Access token is missing, invalid, expired, or user is unauthenticated.',
  })
  @ApiForbiddenResponse({
    description:
      'Google account unlinking is forbidden by account policy/state.',
  })
  @ApiNotFoundResponse({
    description: 'Linked Google provider or user account was not found.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server/Cognito/database failure while unlinking account.',
  })
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

  @ApiOperation({
    summary: "Deletes the logged in user's account and all associated data",
  })
  @ApiBadRequestResponse({
    description:
      'Deletion payload is invalid or password confirmation is incorrect.',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired.',
  })
  @ApiForbiddenResponse({
    description:
      'Account deletion is forbidden by policy or account constraints.',
  })
  @ApiNotFoundResponse({
    description: 'Authenticated user account was not found.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server/Cognito/database failure while deleting account.',
  })
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

  @ApiOperation({
    summary:
      "Gets the logged in user's known devices from cognito. This is used to remember the user's device and not require MFA when the user is on a known device.",
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired.',
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user is not allowed to read known devices.',
  })
  @ApiNotFoundResponse({
    description: 'No known-device context found for the authenticated user.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server or Cognito failure while loading devices.',
  })
  @ApiBadRequestResponse({
    description:
      'InvalidParameterException, InvalidUserPoolConfigurationException',
  })
  @ApiUnauthorizedResponse({
    description:
      'NotAuthorizedException, PasswordResetRequiredException, UserNotConfirmedException',
  })
  @ApiForbiddenResponse({
    description: 'ForbiddenException',
  })
  @ApiNotFoundResponse({
    description: 'UserNotFoundException, ResourceNotFoundException',
  })
  @ApiTooManyRequestsResponse({
    description: 'TooManyRequestsException',
  })
  @ApiInternalServerErrorResponse({
    description:
      'InternalErrorException, CognitoIdentityProviderServiceException',
  })
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
