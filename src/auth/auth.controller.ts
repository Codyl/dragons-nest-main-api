import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ApiCookieAuth, ApiOperation } from '@nestjs/swagger';
import {
  ApiNotFoundResponse,
  ApiResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
  ApiInternalServerErrorResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
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

  @ApiOperation({
    summary:
      'Initiates signup process with cognito sending a code to the users email',
  })
  @ApiResponse({
    status: 200,
    description: 'Signup initiated successfully',
    type: InitiateSignupResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input or Cognito validation error',
  })
  @ApiUnauthorizedResponse({ description: 'Not authorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Resource not found' })
  @ApiTooManyRequestsResponse({ description: 'Too many requests' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  @ApiBadRequestResponse({
    description: 'Cognito validation errors',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication failure',
  })
  @ApiForbiddenResponse({
    description: 'Access denied',
  })
  @ApiNotFoundResponse({
    description: 'Resource not found',
  })
  @ApiTooManyRequestsResponse({
    description: 'Rate limited',
  })
  @ApiInternalServerErrorResponse({
    description: 'Cognito service error',
  })
  @HttpCode(200)
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

  @ApiOperation({
    summary:
      'Confirms signup process with cognito verifying the code from the email and signing in the user',
  })
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

  @ApiOperation({
    summary: 'Resends the signup confirmation code to the users email',
  })
  @Post('confirm-signup/resend-code')
  async confirmSignupResendCode(
    @Body() body: ConfirmSignupResendCodeDto,
  ): Promise<ApiResponseDto<EmptyDataDto>> {
    await this.authService.confirmSignupResendCode(body.username);
    return {
      message: 'Verification code resent successfully',
      data: {},
    };
  }

  @ApiOperation({
    summary:
      'Verifies the TOTP MFA code and signs in the user when the user has enabled MFA prior to signing in',
  })
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

  @ApiOperation({
    summary:
      'Generates a TOTP authenticator secret for the user to later scan and add to their authenticator app',
  })
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

  @ApiOperation({
    summary:
      'Connects the authenticator app to the user by adding the code to the users authenticator app',
  })
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

  @ApiOperation({
    summary:
      'Verifies the username and returns the available challenges. If the email is not found the response will still be successful.',
  })
  @HttpCode(200)
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

  @ApiOperation({
    summary:
      'Initiates the login process with cognito verifying the username and password.',
  })
  @Post('initiate-login')
  @HttpCode(200)
  async initiateLogin(
    @Body() body: InitiateLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponseDto<InitiateLoginResponseDto>> {
    const response = await this.authService.initiateLogin(
      body.username,
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

  @ApiOperation({
    summary: 'Refreshes the access token when the access token is expired',
  })
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

  @ApiOperation({
    summary:
      'Frontend performs SRP with Cognito (password never leaves browser), then sends tokens here. Backend verifies tokens and sets HttpOnly cookies.',
  })
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

  @ApiOperation({
    summary: 'Logs out the user by clearing the auth cookies',
  })
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

  @ApiOperation({
    summary:
      'Initiates the forgot password process with cognito sending a code to the users email',
  })
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(
    @Body() body: ForgotPasswordDto,
  ): Promise<ApiResponseDto<EmptyDataDto>> {
    await this.authService.forgotPassword(body.username);
    return {
      message: 'Password reset code sent successfully',
      data: {},
    };
  }

  @ApiOperation({
    summary:
      'Confirms the forgot password process with cognito verifying the code from the email and setting the new password',
  })
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
