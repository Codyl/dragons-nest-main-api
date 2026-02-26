import { Body, Controller, NotFoundException, Post, Res } from '@nestjs/common';
import type { Response, Request } from 'express';
import { ApiCookieAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { setAuthCookies } from 'src/common/utils/cookies';
import { Cookies } from 'src/common/decorators/cookies.decorator';

@ApiCookieAuth('ACCESS_TOKEN')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Signup
  @Post('initiate-signup')
  initiateSignup(@Body() body: { email: string; password: string }) {
    return this.authService.initiateSignup(body.email, body.password);
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
    const response = await this.authService.confirmSignup(
      body.email,
      body.code,
      body.session,
      body.password,
    );
    if (response.AccessToken && response.IdToken && response.RefreshToken) {
      setAuthCookies(res, {
        AccessToken: response.AccessToken,
        IdToken: response.IdToken,
        RefreshToken: response.RefreshToken,
      });
    }
    return response;
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
    @Body() body: { email: string; session: string; accessToken: string },
  ) {
    const response = await this.authService.generateAuthenticatorSecret(
      body.email,
      body.session,
      body.accessToken,
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
  connectAuthenticatorApp(@Body() body: { email: string; password: string }) {
    return this.authService.connectAuthenticatorApp(
      body.session,
      body.userCode,
      body.friendlyDeviceName,
      body.accessToken,
      body.username,
      body.password,
    );
  }

  // Login
  @Post('verify-username')
  verifyUsername(@Body() body: { email: string; password: string }) {
    return this.authService.verifyUsername(body.email, body.password);
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
  refreshToken(@Cookies('REFRESH_TOKEN') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('set-session')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setSession(@Body() body: { email: string; password: string }) {
    // return this.authService.setSession(body.email, body.password);
  }

  @Post('logout')
  logout(@Cookies('ACCESS_TOKEN') accessToken: string) {
    return this.authService.logout(accessToken);
  }

  // Forgot password
  @Post('forgot-password')
  forgotPassword(@Body() body: { email: string; password: string }) {
    return this.authService.forgotPassword(body.email, body.password);
  }

  @Post('confirm-forgot-password')
  confirmForgotPassword(
    @Body() body: { email: string; code: string; password: string },
  ) {
    return this.authService.confirmForgotPassword(
      body.email,
      body.code,
      body.password,
    );
  }
}
