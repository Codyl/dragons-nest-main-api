import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { PasskeyService } from './passkey.service';
import { AccessToken } from 'src/auth/decorators/access-token.decorator';
import { PasskeyVerifyRegistrationDto } from 'src/passkey/dto/passkey-verify-registration.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { PasskeyVerifyAuthDto } from 'src/auth/dto/passkey-verify-auth.dto';
import { setPasskeySessionCookie } from 'src/common/utils/cookies';
import { EnvironmentVariables } from 'src/env.config';
import { JWT_SECRET, NODE_ENV } from 'src/env.constants';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PasskeyDeleteBodyDto } from 'src/passkey/dto/passkey-delete-body.dto';
import { PasskeyListItemDto } from 'src/passkey/dto/out/passkey-list-item.dto';

interface MessageDataResponse<T = object> {
  message: string;
  data: T;
}

@ApiCookieAuth('ACCESS_TOKEN')
@Controller()
export class PasskeyController {
  constructor(
    private readonly passkeyService: PasskeyService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  private get cookieOptions() {
    return {
      secure:
        this.configService.getOrThrow(NODE_ENV, { infer: true }) ===
        'production',
    };
  }

  @ApiOperation({
    summary:
      'Returns WebAuthn authentication options for passkey (passwordless) sign-in',
  })
  @ApiBadRequestResponse({
    description: 'Passkey options could not be generated.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected failure while generating authentication options.',
  })
  @Post('auth/passkey/options')
  async passkeyAuthOptions(): Promise<
    MessageDataResponse<Record<string, unknown>>
  > {
    const options = await this.passkeyService.getAuthenticationOptions();
    return {
      message: 'Passkey authentication options',
      data: options,
    };
  }

  @ApiOperation({
    summary:
      'Verifies passkey assertion and sets passkey session cookie on success',
  })
  @ApiBadRequestResponse({
    description: 'Assertion payload is invalid or verification failed.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected failure during passkey verification.',
  })
  @Post('auth/passkey/verify')
  async passkeyVerify(
    @Body() body: PasskeyVerifyAuthDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageDataResponse<{ verified: boolean }>> {
    const result = await this.passkeyService.verifyAuthentication(body);
    if (result.verified && result.sub) {
      const jwtSecret = this.configService.getOrThrow(JWT_SECRET, {
        infer: true,
      });
      setPasskeySessionCookie(res, result.sub, {
        secure: this.cookieOptions.secure,
        jwtSecret,
      });
    }

    return {
      message: result.verified
        ? 'Passkey authentication successful'
        : 'Passkey authentication failed',
      data: { verified: result.verified },
    };
  }

  @ApiOperation({
    summary: 'Gets the passkey registration options for the logged in user',
  })
  @ApiUnauthorizedResponse({
    description:
      'Access token is missing, invalid, expired, or user is unauthenticated.',
  })
  @ApiForbiddenResponse({
    description: 'Passkey registration is forbidden by account policy/state.',
  })
  @ApiNotFoundResponse({
    description:
      'Authenticated user/passkey registration context was not found.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server/WebAuthn failure while building registration options.',
  })
  @UseGuards(AuthGuard)
  @Post('profile/passkey/register/options')
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

  @ApiOperation({
    summary: 'Verifies the passkey registration for the logged in user',
    description:
      "Verifies the passkey registration for the logged in user by verifying the passkey and returning the result. This is used to register the passkey with the user's account.",
  })
  @ApiBadRequestResponse({
    description:
      'Registration attestation payload is invalid, malformed, or fails verification checks.',
  })
  @ApiUnauthorizedResponse({
    description: 'User is not authenticated for passkey verification.',
  })
  @ApiForbiddenResponse({
    description:
      'Passkey registration verification is forbidden by policy/state.',
  })
  @ApiNotFoundResponse({
    description: 'Pending passkey challenge or user context was not found.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server/WebAuthn failure during registration verification.',
  })
  @ApiOperation({
    summary: 'Lists passkeys for the signed-in user (metadata for settings UI)',
  })
  @ApiUnauthorizedResponse({
    description:
      'Access token is missing, invalid, expired, or user is unauthenticated.',
  })
  @ApiOkResponse({ description: 'Passkey rows with display hints and dates' })
  @UseGuards(AuthGuard)
  @Get('profile/passkeys')
  async listPasskeys(
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
  ): Promise<MessageDataResponse<{ passkeys: PasskeyListItemDto[] }>> {
    const sub = user?.sub;
    if (!sub || typeof sub !== 'string') {
      throw new Error('Not authenticated');
    }

    const passkeys = await this.passkeyService.listPasskeysForSettings(sub);
    return {
      message: 'Passkeys',
      data: { passkeys },
    };
  }

  @ApiOperation({
    summary: 'Removes a passkey credential from the user account',
  })
  @ApiUnauthorizedResponse({
    description:
      'Access token is missing, invalid, expired, or user is unauthenticated.',
  })
  @ApiNotFoundResponse({ description: 'Credential id not found for this user' })
  @ApiBadRequestResponse({ description: 'Invalid body' })
  @UseGuards(AuthGuard)
  @Delete('profile/passkeys')
  async deletePasskey(
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
    @Body() body: PasskeyDeleteBodyDto,
  ): Promise<MessageDataResponse<Record<string, never>>> {
    const sub = user?.sub;
    if (!sub || typeof sub !== 'string') {
      throw new Error('Not authenticated');
    }

    await this.passkeyService.deletePasskey(sub, body.credentialId);
    return {
      message: 'Passkey removed',
      data: {},
    };
  }

  @UseGuards(AuthGuard)
  @Post('profile/passkey/register/verify')
  async passkeyRegisterVerify(
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
    @Body() dto: PasskeyVerifyRegistrationDto,
  ): Promise<MessageDataResponse<{ verified: boolean }>> {
    const sub = user?.sub;
    if (!sub || typeof sub !== 'string') {
      throw new Error('Not authenticated');
    }

    const result = await this.passkeyService.verifyRegistration(sub, dto);
    return {
      message: result.verified
        ? 'Passkey registered successfully'
        : 'Passkey verification failed',
      data: { verified: result.verified },
    };
  }
}
