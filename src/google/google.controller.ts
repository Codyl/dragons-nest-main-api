import { Body, Controller, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { GoogleService } from './google.service';
import { GoogleCredentialDto } from './dto/google-credential.dto';
import { setAuthCookies } from 'src/common/utils/cookies';
import { NODE_ENV } from 'src/env.constants';
import { EnvironmentVariables } from 'src/env.config';

@Controller('auth')
export class GoogleController {
  constructor(
    private readonly googleService: GoogleService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  private get cookieOptions() {
    return {
      secure:
        this.configService.getOrThrow(NODE_ENV, { infer: true }) ===
        'production',
    };
  }

  @Post('google-sso-signup')
  async googleSSOSignup(
    @Body() body: GoogleCredentialDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.googleService.googleSSOSignup(body);

    if (result.AuthenticationResult) {
      setAuthCookies(
        res,
        {
          AccessToken: result.AuthenticationResult.AccessToken,
          IdToken: result.AuthenticationResult.IdToken,
          RefreshToken: result.AuthenticationResult.RefreshToken,
        },
        this.cookieOptions,
      );
    }

    return {
      message: 'Google signup successful',
      data: {
        AuthenticationResult: result.AuthenticationResult?.ExpiresIn
          ? { ExpiresIn: result.AuthenticationResult.ExpiresIn }
          : undefined,
      },
    };
  }

  @Post('google-token-exchange')
  async googleTokenExchange(
    @Body() body: GoogleCredentialDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.googleService.googleTokenExchange(body);

    if (result.AuthenticationResult) {
      setAuthCookies(
        res,
        {
          AccessToken: result.AuthenticationResult.AccessToken,
          IdToken: result.AuthenticationResult.IdToken,
          RefreshToken: result.AuthenticationResult.RefreshToken,
        },
        this.cookieOptions,
      );
    }

    return {
      message: 'Google token exchange successful',
      data: {
        AuthenticationResult: result.AuthenticationResult?.ExpiresIn
          ? { ExpiresIn: result.AuthenticationResult.ExpiresIn }
          : undefined,
        loginProvider: 'google',
      },
    };
  }
}
