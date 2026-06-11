import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
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
import { VerifyAccountRecoveryCodeDto } from './dto/verify-account-recovery-code.dto';
import { InitiateSignupResponseDto } from './dto/out/initiate-signup-response.dto';
import { ConfirmSignupResponseDto } from './dto/out/confirm-signup-response.dto';
import { MfaResponseDto } from './dto/out/mfa-response.dto';
import { GenerateAuthenticatorSecretResponseDto } from './dto/out/generate-authenticator-secret-response.dto';
import { VerifyUsernameResponseDto } from './dto/out/verify-username-response.dto';
import { InitiateLoginResponseDto } from './dto/out/initiate-login-response.dto';
import { ConfirmForgotPasswordResponseDto } from './dto/out/confirm-forgot-password-response.dto';
import { ApiResponseDto, EmptyDataDto } from 'src/common/dto/api-response.dto';
import { WebAuthnSignInBeginDto } from './dto/webauthn-sign-in-begin.dto';
import { WebAuthnSignInCompleteDto } from './dto/webauthn-sign-in-complete.dto';
import { WebAuthnSignInChallengeResponseDto } from './dto/out/webauthn-sign-in-challenge-response.dto';

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
    description:
      'Email/password payload is invalid or Cognito rejects signup parameters (e.g. password policy).',
  })
  @ApiUnauthorizedResponse({
    description: 'Signup flow is blocked by an upstream authorization failure.',
  })
  @ApiForbiddenResponse({
    description:
      'Signup action is forbidden by configured policy or guard rules.',
  })
  @ApiNotFoundResponse({
    description:
      'Required identity resource (such as user pool config) was not found.',
  })
  @ApiTooManyRequestsResponse({
    description:
      'Too many signup attempts triggered Cognito/API rate limiting.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server or Cognito integration failure while initiating signup.',
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
  @ApiBadRequestResponse({
    description:
      'Confirmation code, username, password, or session is invalid/expired.',
  })
  @ApiUnauthorizedResponse({
    description:
      'User is not authorized to complete signup for this challenge.',
  })
  @ApiForbiddenResponse({
    description: 'Signup confirmation is forbidden for the current user state.',
  })
  @ApiNotFoundResponse({
    description: 'Expected signup challenge/session could not be found.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many confirmation attempts triggered rate limiting.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server or Cognito failure during signup confirmation.',
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
      {
        accountType: body.accountType,
        givenName: body.givenName,
        familyName: body.familyName,
        coppaConsent: body.coppaConsent,
      },
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
  @ApiBadRequestResponse({
    description: 'Username is missing/invalid or resend request is malformed.',
  })
  @ApiUnauthorizedResponse({
    description: 'Caller is not authorized to request a new signup code.',
  })
  @ApiForbiddenResponse({
    description: 'Resending signup code is forbidden for this user state.',
  })
  @ApiNotFoundResponse({
    description: 'No user/challenge found for the provided username.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many resend-code requests were made in a short period.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server or Cognito failure while resending code.',
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
  @ApiBadRequestResponse({
    description:
      'Session or MFA code format is invalid, expired, or incorrect.',
  })
  @ApiUnauthorizedResponse({
    description: 'Caller is not authorized to complete the MFA challenge.',
  })
  @ApiForbiddenResponse({
    description: 'MFA verification is forbidden for the current account state.',
  })
  @ApiNotFoundResponse({
    description: 'No matching MFA challenge/session exists for the user.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many MFA attempts triggered temporary rate limiting.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server or Cognito failure while verifying MFA.',
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
  @ApiBadRequestResponse({
    description:
      'Request body is invalid or required session/token details are missing.',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired.',
  })
  @ApiForbiddenResponse({
    description: 'User is not allowed to generate an authenticator secret.',
  })
  @ApiNotFoundResponse({
    description: 'Requested MFA setup context or user session was not found.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Secret generation requests were throttled due to volume.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server or Cognito failure while generating secret.',
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
  @ApiBadRequestResponse({
    description:
      'Provided authenticator code, session, username, or password is invalid.',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token or credentials are invalid/expired.',
  })
  @ApiForbiddenResponse({
    description: 'Authenticator app connection is forbidden for this account.',
  })
  @ApiNotFoundResponse({
    description: 'MFA setup session or user challenge context was not found.',
  })
  @ApiTooManyRequestsResponse({
    description:
      'Too many authenticator-connection attempts triggered throttling.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server or Cognito failure while connecting MFA app.',
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
  @ApiBadRequestResponse({
    description: 'Email payload is invalid or cannot be processed.',
  })
  @ApiUnauthorizedResponse({
    description: 'Caller is not authorized to perform username verification.',
  })
  @ApiForbiddenResponse({
    description: 'Username verification is forbidden by policy.',
  })
  @ApiTooManyRequestsResponse({
    description:
      'Too many verification attempts triggered temporary throttling.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server or Cognito failure while verifying username.',
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
      'Starts Cognito USER_AUTH passkey sign-in after verify-username (returns WEB_AUTHN challenge parameters).',
  })
  @ApiBadRequestResponse({
    description: 'Username or session is invalid for this challenge.',
  })
  @ApiUnauthorizedResponse({
    description: 'Caller is not authorized to continue passkey sign-in.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many attempts triggered temporary throttling.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server or Cognito failure.',
  })
  @HttpCode(200)
  @Post('webauthn/sign-in/begin')
  async webAuthnSignInBegin(
    @Body() body: WebAuthnSignInBeginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponseDto<WebAuthnSignInChallengeResponseDto>> {
    const result = await this.authService.beginWebAuthnSignIn(
      body.username,
      body.session,
    );

    if (result.AuthenticationResult) {
      setAuthCookies(res, result.AuthenticationResult, this.cookieOptions);
    }

    return {
      message: 'WebAuthn sign-in challenge ready',
      data: {
        session: result.Session,
        challengeName: result.ChallengeName,
        challengeParameters: result.ChallengeParameters as
          | Record<string, string>
          | undefined,
        availableChallenges: result.AvailableChallenges,
        authenticationResult: result.AuthenticationResult ? {} : undefined,
      },
    };
  }

  @ApiOperation({
    summary:
      'Completes Cognito WEB_AUTHN challenge with the browser assertion; sets Cognito cookies when tokens are issued.',
  })
  @ApiBadRequestResponse({
    description: 'Credential or session is invalid or malformed.',
  })
  @ApiUnauthorizedResponse({
    description: 'Passkey verification failed or session is not authorized.',
  })
  @ApiNotFoundResponse({
    description: 'Expected auth challenge or session was not found.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many attempts triggered temporary throttling.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server or Cognito failure.',
  })
  @HttpCode(200)
  @Post('webauthn/sign-in/complete')
  async webAuthnSignInComplete(
    @Body() body: WebAuthnSignInCompleteDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponseDto<InitiateLoginResponseDto>> {
    const deviceName = body.deviceName?.trim() || 'Trusted device';
    const { response, device } = await this.authService.completeWebAuthnSignIn(
      body.username,
      body.session,
      body.credential,
      deviceName,
    );

    if (response.AuthenticationResult) {
      setAuthCookies(res, response.AuthenticationResult, this.cookieOptions);
    }

    const data: InitiateLoginResponseDto = {
      session: response.Session,
      challengeName: response.ChallengeName,
      device,
    };
    return {
      message: 'WebAuthn sign-in step completed',
      data,
    };
  }

  @ApiOperation({
    summary:
      'Initiates the login process with cognito verifying the username and password.',
  })
  @ApiBadRequestResponse({
    description:
      'Username/password or optional device/session values are invalid or malformed.',
  })
  @ApiUnauthorizedResponse({
    description: 'Credentials are invalid or user cannot be authenticated.',
  })
  @ApiForbiddenResponse({
    description: 'Login is forbidden due to account policy/state restrictions.',
  })
  @ApiNotFoundResponse({
    description:
      'Expected auth challenge/session or user context was not found.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many login attempts triggered temporary rate limiting.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server or Cognito failure while initiating login.',
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
  @ApiBadRequestResponse({
    description: 'Refresh token is missing or malformed.',
  })
  @ApiUnauthorizedResponse({
    description: 'Refresh token is invalid, revoked, or expired.',
  })
  @ApiForbiddenResponse({
    description:
      'Token refresh is forbidden for the current session/user state.',
  })
  @ApiNotFoundResponse({
    description: 'Referenced refresh-token session was not found.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many refresh requests triggered temporary throttling.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server or Cognito failure while refreshing token.',
  })
  @Post('refresh-token')
  async refreshToken(
    @Cookies('REFRESH_TOKEN') refreshToken: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponseDto<EmptyDataDto>> {
    if (!refreshToken) {
      throw new UnauthorizedException(
        'Missing refresh token cookie. Re-authenticate to start a new session.',
      );
    }

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
  @ApiBadRequestResponse({
    description:
      'Token payload is invalid, incomplete, or fails request validation.',
  })
  @ApiUnauthorizedResponse({
    description: 'Provided Access/ID token is invalid or expired.',
  })
  @ApiForbiddenResponse({
    description: 'Setting session cookies is forbidden for this token context.',
  })
  @ApiNotFoundResponse({
    description: 'Referenced session/token subject could not be resolved.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many session set requests were made in a short period.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server error while verifying tokens or setting session.',
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
  @ApiUnauthorizedResponse({
    description: 'Caller is not authenticated or access token is invalid.',
  })
  @ApiForbiddenResponse({
    description: 'Logout operation is forbidden for the current auth context.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many logout requests triggered temporary throttling.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server or Cognito failure while logging out.',
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
  @ApiBadRequestResponse({
    description: 'Username/email is invalid or request payload is malformed.',
  })
  @ApiUnauthorizedResponse({
    description: 'Caller is not authorized to trigger forgot-password flow.',
  })
  @ApiForbiddenResponse({
    description: 'Forgot-password action is forbidden for this user state.',
  })
  @ApiNotFoundResponse({
    description:
      'No account/challenge context found for the provided username.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many forgot-password attempts triggered throttling.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server or Cognito failure during forgot-password.',
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
  @ApiBadRequestResponse({
    description: 'Reset code, username, or new password is invalid/expired.',
  })
  @ApiUnauthorizedResponse({
    description: 'Caller is not authorized to confirm password reset.',
  })
  @ApiForbiddenResponse({
    description:
      'Password reset confirmation is forbidden for this account state.',
  })
  @ApiNotFoundResponse({
    description: 'Password reset challenge/session could not be found.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many password-reset confirmations triggered throttling.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server or Cognito failure confirming password reset.',
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

  @ApiOperation({
    summary:
      'Verifies a temporary account recovery code and restores account access by setting a new password',
  })
  @ApiBadRequestResponse({
    description:
      'Temporary recovery code, username, or new password is invalid/expired.',
  })
  @ApiUnauthorizedResponse({
    description: 'Caller is not authorized to complete account recovery.',
  })
  @ApiForbiddenResponse({
    description:
      'Account recovery confirmation is forbidden for this account state.',
  })
  @ApiNotFoundResponse({
    description: 'Account recovery challenge/session could not be found.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many account recovery attempts triggered throttling.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server or Cognito failure while verifying recovery code.',
  })
  @Post('account-recovery/verify-code')
  async verifyAccountRecoveryCode(
    @Body() body: VerifyAccountRecoveryCodeDto,
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
      message: 'Account recovered successfully',
      data,
    };
  }
}
