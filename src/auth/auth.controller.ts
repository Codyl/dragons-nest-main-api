import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Signup
  @Post('initiate-signup')
  initiateSignup(@Body() body: { email: string; password: string }) {
    return this.authService.initiateSignup(body);
  }

  @Post('confirm-signup')
  confirmSignup(@Body() body: { email: string; password: string }) {
    return this.authService.confirmSignup(body);
  }

  @Post('confirm-signup/resend-code')
  confirmSignupResendCode(@Body() body: { email: string; password: string }) {
    return this.authService.confirmSignupResendCode(body);
  }

  // MFA
  @Post('mfa')
  mfa(@Body() body: { email: string; password: string }) {
    return this.authService.mfa(body);
  }

  @Post('mfa/generate-authenticator-secret')
  generateAuthenticatorSecret(
    @Body() body: { email: string; password: string },
  ) {
    return this.authService.generateAuthenticatorSecret(body);
  }

  @Post('mfa/connect-authenticator-app')
  connectAuthenticatorApp(@Body() body: { email: string; password: string }) {
    return this.authService.connectAuthenticatorApp(body);
  }

  // Login
  @Post('verify-username')
  verifyUsername(@Body() body: { email: string; password: string }) {
    return this.authService.verifyUsername(body);
  }

  @Post('initiate-login')
  initiateLogin(@Body() body: { email: string; password: string }) {
    return this.authService.initiateLogin(body);
  }

  @Post('confirm-login')
  confirmLogin(@Body() body: { email: string; password: string }) {
    return this.authService.confirmLogin(body);
  }

  @Post('refresh-token')
  refreshToken(@Body() body: { email: string; password: string }) {
    return this.authService.refreshToken(body);
  }

  @Post('set-session')
  setSession(@Body() body: { email: string; password: string }) {
    return this.authService.setSession(body);
  }

  @Post('logout')
  logout(@Body() body: { email: string; password: string }) {
    return this.authService.logout(body);
  }

  // Forgot password
  @Post('forgot-password')
  forgotPassword(@Body() body: { email: string; password: string }) {
    return this.authService.forgotPassword(body);
  }

  @Post('confirm-forgot-password')
  confirmForgotPassword(@Body() body: { email: string; password: string }) {
    return this.authService.confirmForgotPassword(body);
  }
}
