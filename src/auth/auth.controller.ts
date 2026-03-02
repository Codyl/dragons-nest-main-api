import { Body, Controller, NotFoundException, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ApiCookieAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { setAuthCookies } from 'src/common/utils/cookies';
import { Cookies } from 'src/common/decorators/cookies.decorator';
import { NODE_ENV } from 'env.constants';
import { EnvironmentVariables } from 'env.config';
import { InitiateSignupDto } from './dto/initiate-signup.dto';
import { ConfirmSignupDto } from './dto/confirm-signup.dto';
import { ConfirmSignupResendCodeDto } from './dto/confirm-signup-resend-code.dto';
import { MfaDto } from './dto/mfa.dto';
import { GenerateAuthenticatorSecretDto } from './dto/generate-authenticator-secret.dto';
import { ConnectAuthenticatorAppDto } from './dto/connect-authenticator-app.dto';
import { VerifyUsernameDto } from './dto/verify-username.dto';
import { InitiateLoginDto } from './dto/initiate-login.dto';
import { SetSessionDto } from './dto/set-session.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ConfirmForgotPasswordDto } from './dto/confirm-forgot-password.dto';

@ApiCookieAuth('ACCESS_TOKEN')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  private get cookieOptions() {
    return {
      secure:
        this.configService.getOrThrow(NODE_ENV, { infer: true }) ===
        'production',
    };
  }

  // Signup
  @Post('initiate-signup')
  async initiateSignup(@Body() body: InitiateSignupDto) {
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
    @Body() body: ConfirmSignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.confirmSignup(
      body.email,
      body.code,
      body.session,
      body.password,
    );
    if (tokens.AccessToken && tokens.IdToken && tokens.RefreshToken) {
      setAuthCookies(
        res,
        {
          AccessToken: tokens.AccessToken,
          IdToken: tokens.IdToken,
          RefreshToken: tokens.RefreshToken,
        },
        this.cookieOptions,
      );
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
  confirmSignupResendCode(@Body() body: ConfirmSignupResendCodeDto) {
    return this.authService.confirmSignupResendCode(body.email);
  }

  // MFA
  @Post('mfa')
  async mfa(@Body() body: MfaDto, @Res({ passthrough: true }) res: Response) {
    const response = await this.authService.mfa(
      body.email,
      body.session,
      body.softwareTokenMfaCode,
    );

    if (!response) {
      throw new NotFoundException('MFA not found.');
    }

    if (response.AuthenticationResult) {
      setAuthCookies(res, response.AuthenticationResult, this.cookieOptions);
    }

    return response;
  }

  @Post('mfa/generate-authenticator-secret')
  async generateAuthenticatorSecret(
    @Body() body: GenerateAuthenticatorSecretDto,
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
    @Body() body: ConnectAuthenticatorAppDto,
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
  async verifyUsername(@Body() body: VerifyUsernameDto) {
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
    @Body() body: InitiateLoginDto,
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
      setAuthCookies(
        res,
        response.response.AuthenticationResult,
        this.cookieOptions,
      );
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
      setAuthCookies(res, result.AuthenticationResult, this.cookieOptions);
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
    @Body() body: SetSessionDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.verifyTokensForSetSession(body);

    setAuthCookies(
      res,
      {
        ...(body.AccessToken && { AccessToken: body.AccessToken }),
        ...(body.IdToken && { IdToken: body.IdToken }),
        ...(body.RefreshToken && { RefreshToken: body.RefreshToken }),
      },
      this.cookieOptions,
    );

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
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.authService.forgotPassword(body.username);
    return {
      message: 'Password reset code sent successfully',
      data: {},
    };
  }

  @Post('confirm-forgot-password')
  async confirmForgotPassword(
    @Body() body: ConfirmForgotPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.confirmForgotPassword(
      body.username,
      body.code,
      body.password,
    );
    if (response.AuthenticationResult) {
      setAuthCookies(res, response.AuthenticationResult, this.cookieOptions);
    }

    return {
      message: 'Password reset confirmed successfully',
      data: {
        AuthenticationResult: response.AuthenticationResult ? {} : undefined,
      },
    };
  }
}
