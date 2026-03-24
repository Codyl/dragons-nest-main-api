import { Body, Controller, NotFoundException, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ApiCookieAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { setAuthCookies } from 'src/common/utils/cookies';
import { Cookies } from 'src/common/decorators/cookies.decorator';
import { NODE_ENV } from 'src/env.constants';
import { EnvironmentVariables } from 'src/env.config';
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
import { InitiateSignupResponseDto } from './dto/out/initiate-signup-response.dto';
import { ConfirmSignupResponseDto } from './dto/out/confirm-signup-response.dto';
import { MfaResponseDto } from './dto/out/mfa-response.dto';
import { GenerateAuthenticatorSecretResponseDto } from './dto/out/generate-authenticator-secret-response.dto';
import { VerifyUsernameResponseDto } from './dto/out/verify-username-response.dto';
import { InitiateLoginResponseDto } from './dto/out/initiate-login-response.dto';
import { ConfirmForgotPasswordResponseDto } from './dto/out/confirm-forgot-password-response.dto';
import { ApiResponseDto, EmptyDataDto } from 'src/common/dto/api-response.dto';

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
  async initiateSignup(
    @Body() body: InitiateSignupDto,
  ): Promise<ApiResponseDto<InitiateSignupResponseDto>> {
    const response = await this.authService.initiateSignup(
      body.email,
      body.password,
    );

    const data: InitiateSignupResponseDto = {
      Session: response.CodeDeliveryDetails ? response.Session : undefined,
    };
    return {
      message: 'Signup initiated successfully',
      data,
    };
  }

  @Post('confirm-signup')
  async confirmSignup(
    @Body() body: ConfirmSignupDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponseDto<ConfirmSignupResponseDto>> {
    const tokens = await this.authService.confirmSignup(
      body.username,
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

    const data: ConfirmSignupResponseDto = {
      Session: undefined,
      challengeName: undefined,
      AuthenticationResult: tokens.AccessToken ? {} : undefined,
    };
    return {
      message: 'Signup confirmed successfully',
      data,
    };
  }

  @Post('confirm-signup/resend-code')
  async confirmSignupResendCode(
    @Body() body: ConfirmSignupResendCodeDto,
  ): Promise<ApiResponseDto<EmptyDataDto>> {
    await this.authService.confirmSignupResendCode(body.email);
    return {
      message: 'Verification code resent successfully',
      data: {},
    };
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

    const data: MfaResponseDto = {
      Session: response.Session,
      ChallengeName: response.ChallengeName,
      AuthenticationResult: response.AuthenticationResult ? {} : undefined,
    };
    return {
      message: 'MFA verified successfully',
      data,
    };
  }

  @Post('mfa/generate-authenticator-secret')
  async generateAuthenticatorSecret(
    @Body() body: GenerateAuthenticatorSecretDto,
    @Cookies('ACCESS_TOKEN') cookieAccessToken: string,
  ): Promise<ApiResponseDto<GenerateAuthenticatorSecretResponseDto>> {
    const response = await this.authService.generateAuthenticatorSecret(
      body.username,
      body.session,
      body.accessToken || cookieAccessToken,
    );
    if (!response) {
      throw new NotFoundException('Secret not found.');
    }

    const data: GenerateAuthenticatorSecretResponseDto = {
      session: response.response.Session ?? '',
      qrString: response.qrString,
    };
    return {
      message: 'Authenticator secret generated successfully',
      data,
    };
  }

  @Post('mfa/connect-authenticator-app')
  async connectAuthenticatorApp(
    @Body() body: ConnectAuthenticatorAppDto,
    @Res({ passthrough: true }) res: Response,
    @Cookies('ACCESS_TOKEN') cookieAccessToken: string,
  ): Promise<ApiResponseDto<EmptyDataDto>> {
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
  async verifyUsername(
    @Body() body: VerifyUsernameDto,
  ): Promise<ApiResponseDto<VerifyUsernameResponseDto>> {
    const result = await this.authService.verifyUsername(body.email);
    const data: VerifyUsernameResponseDto = {
      Session: result.Session,
      AvailableChallenges: result.AvailableChallenges,
    };
    return {
      message: 'Username verified successfully',
      data,
    };
  }

  @Post('initiate-login')
  async initiateLogin(
    @Body() body: InitiateLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponseDto<InitiateLoginResponseDto>> {
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

    const data: InitiateLoginResponseDto = {
      session: response.response.Session,
      challengeName: response.response.ChallengeName,
      device: response.device,
    };
    return {
      message: 'Login initiated successfully',
      data,
    };
  }

  @Post('refresh-token')
  async refreshToken(
    @Cookies('REFRESH_TOKEN') refreshToken: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponseDto<EmptyDataDto>> {
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
  ): Promise<ApiResponseDto<EmptyDataDto>> {
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
  ): Promise<ApiResponseDto<EmptyDataDto>> {
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
  async forgotPassword(
    @Body() body: ForgotPasswordDto,
  ): Promise<ApiResponseDto<EmptyDataDto>> {
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
  ): Promise<ApiResponseDto<ConfirmForgotPasswordResponseDto>> {
    const response = await this.authService.confirmForgotPassword(
      body.username,
      body.code,
      body.password,
    );
    if (response.AuthenticationResult) {
      setAuthCookies(res, response.AuthenticationResult, this.cookieOptions);
    }

    const data: ConfirmForgotPasswordResponseDto = {
      AuthenticationResult: response.AuthenticationResult ? {} : undefined,
    };
    return {
      message: 'Password reset confirmed successfully',
      data,
    };
  }
}
