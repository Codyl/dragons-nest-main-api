import { Body, Controller, NotFoundException, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiCookieAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import type { SetSessionBody } from './auth.service';
import { setAuthCookies } from 'src/common/utils/cookies';
import { Cookies } from 'src/common/decorators/cookies.decorator';

@ApiCookieAuth('ACCESS_TOKEN')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Signup
  @Post('initiate-signup')
  async initiateSignup(@Body() body: { email: string; password: string }) {
    const response = await this.authService.initiateSignup(
      body.email,
      body.password,
    );

    return {
      message: 'Signup initiated successfully',
      data: {
        Session: response.CodeDeliveryDetails ? response.Session : undefined,
      },
    };
  }

  @Post('confirm-signup')
  async confirmSignup(
    @Body()
    body: {
      email: string;
      code: string;
      session: string;
      password: string;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.confirmSignup(
      body.email,
      body.code,
      body.session,
      body.password,
    );
    if (tokens.AccessToken && tokens.IdToken && tokens.RefreshToken) {
      setAuthCookies(res, {
        AccessToken: tokens.AccessToken,
        IdToken: tokens.IdToken,
        RefreshToken: tokens.RefreshToken,
      });
    }
    return {
      message: 'Signup confirmed successfully',
      data: {
        Session: undefined,
        challengeName: undefined,
        AuthenticationResult: tokens.AccessToken ? {} : undefined,
      },
    };
  }

  @Post('confirm-signup/resend-code')
  confirmSignupResendCode(@Body() body: { email: string; password: string }) {
    return this.authService.confirmSignupResendCode(body.email);
  }

  // MFA
  @Post('mfa')
  async mfa(
    @Body()
    body: {
      email: string;
      session: string;
      softwareTokenMfaCode: string;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.mfa(
      body.email,
      body.session,
      body.softwareTokenMfaCode,
    );

    if (!response) {
      throw new NotFoundException('MFA not found.');
    }

    if (response.AuthenticationResult) {
      setAuthCookies(res, response.AuthenticationResult);
    }
    return response;
  }

  @Post('mfa/generate-authenticator-secret')
  async generateAuthenticatorSecret(
    @Body() body: { username: string; session: string; accessToken: string },
    @Cookies('ACCESS_TOKEN') cookieAccessToken: string,
  ) {
    const response = await this.authService.generateAuthenticatorSecret(
      body.username,
      body.session,
      body.accessToken || cookieAccessToken,
    );
    if (!response) {
      throw new NotFoundException('Secret not found.');
    }
    return {
      message: 'Authenticator secret generated successfully',
      data: {
        session: response.response.Session,
        qrString: response.qrString,
      },
    };
  }

  @Post('mfa/connect-authenticator-app')
  async connectAuthenticatorApp(
    @Body()
    body: {
      session: string;
      userCode: string;
      friendlyDeviceName: string;
      accessToken: string;
      username: string;
      password: string;
    },
    @Res({ passthrough: true }) res: Response,
    @Cookies('ACCESS_TOKEN') cookieAccessToken: string,
  ) {
    await this.authService.connectAuthenticatorApp(
      body.session,
      body.userCode,
      body.friendlyDeviceName,
      body.accessToken || cookieAccessToken,
      body.username,
      body.password,
    );

    return {
      message: 'Authenticator app connected successfully',
      data: {},
    };
  }

  // Login
  @Post('verify-username')
  async verifyUsername(@Body() body: { email: string; password: string }) {
    const data = await this.authService.verifyUsername(
      body.email,
      body.password,
    );
    return {
      message: 'Username verified successfully',
      data: {
        Session: data.Session,
        AvailableChallenges: data.AvailableChallenges,
      },
    };
  }

  @Post('initiate-login')
  async initiateLogin(
    @Body()
    body: {
      email: string;
      password: string;
      session: string;
      deviceKey: string;
      deviceName: string;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.initiateLogin(
      body.email,
      body.password,
      body.session,
      body.deviceKey,
      body.deviceName,
    );

    if (response.response.AuthenticationResult) {
      setAuthCookies(res, response.response.AuthenticationResult);
    }

    return {
      message: 'Login initiated successfully',
      data: {
        session: response.response.Session,
        challengeName: response.response.ChallengeName,
        device: response.device,
      },
    };
  }

  @Post('refresh-token')
  async refreshToken(
    @Cookies('REFRESH_TOKEN') refreshToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refreshToken(refreshToken);

    if (result?.AuthenticationResult) {
      setAuthCookies(res, result.AuthenticationResult);
    }

    return {
      message: 'Token refreshed successfully',
      data: {},
    };
  }

  /**
   * Session handoff: frontend performs SRP with Cognito (password never leaves browser),
   * then sends tokens here. Backend verifies tokens and sets HttpOnly cookies.
   */
  @Post('set-session')
  async setSession(
    @Body() body: SetSessionBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.verifyTokensForSetSession(body);

    setAuthCookies(res, {
      ...(body.AccessToken && { AccessToken: body.AccessToken }),
      ...(body.IdToken && { IdToken: body.IdToken }),
      ...(body.RefreshToken && { RefreshToken: body.RefreshToken }),
    });

    return {
      message: 'Session set successfully',
      data: {},
    };
  }

  @Post('logout')
  async logout(
    @Cookies('ACCESS_TOKEN') accessToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (accessToken) {
      await this.authService.logout(accessToken);
    }

    // Clear auth cookies regardless of Cognito logout result
    res.clearCookie('ACCESS_TOKEN');
    res.clearCookie('ID_TOKEN');
    res.clearCookie('REFRESH_TOKEN');

    return {
      message: 'Logged out successfully',
      data: {},
    };
  }

  // Forgot password
  @Post('forgot-password')
  async forgotPassword(@Body() body: { username: string }) {
    await this.authService.forgotPassword(body.username);
    return {
      message: 'Password reset code sent successfully',
      data: {},
    };
  }

  @Post('confirm-forgot-password')
  async confirmForgotPassword(
    @Body() body: { username: string; code: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.confirmForgotPassword(
      body.username,
      body.code,
      body.password,
    );
    if (response.AuthenticationResult) {
      setAuthCookies(res, response.AuthenticationResult);
    }

    return {
      message: 'Password reset confirmed successfully',
      data: {
        AuthenticationResult: response.AuthenticationResult ? {} : undefined,
      },
    };
  }
}
