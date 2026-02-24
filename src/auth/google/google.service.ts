import { Body, Injectable } from '@nestjs/common';

@Injectable()
export class GoogleService {
  async googleSSOSignup(@Body() body: { credential: string }) {
    await Promise.resolve();
    return {
      message: 'Google SSO signup successfully',
      data: body,
    };
  }

  async googleTokenExchange(@Body() body: { credential: string }) {
    await Promise.resolve();
    return {
      message: 'Google token exchange successfully',
      data: body,
    };
  }
}
