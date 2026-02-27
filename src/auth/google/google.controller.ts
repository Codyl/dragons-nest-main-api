import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GoogleService } from './google.service';
import { GoogleCredentialDto } from './dto/google-credential.dto';
import { setAuthCookies } from 'src/common/utils/cookies';

@Controller('auth')
export class GoogleController {
  constructor(private readonly googleService: GoogleService) {}

  @Post('google-sso-signup')
  async googleSSOSignup(
    @Body() body: GoogleCredentialDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.googleService.googleSSOSignup(body);

    if (result.AuthenticationResult) {
      setAuthCookies(res, {
        AccessToken: result.AuthenticationResult.AccessToken,
        IdToken: result.AuthenticationResult.IdToken,
        RefreshToken: result.AuthenticationResult.RefreshToken,
      });
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
      setAuthCookies(res, {
        AccessToken: result.AuthenticationResult.AccessToken,
        IdToken: result.AuthenticationResult.IdToken,
        RefreshToken: result.AuthenticationResult.RefreshToken,
      });
    }

    return {
      message: 'Google token exchange successful',
      data: {
        AuthenticationResult: result.AuthenticationResult?.ExpiresIn
          ? { ExpiresIn: result.AuthenticationResult.ExpiresIn }
          : undefined,
      },
    };
  }
}
