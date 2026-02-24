import { Body, Controller, Post } from '@nestjs/common';
import { GoogleService } from './google.service';

@Controller('google')
export class GoogleController {
  constructor(private readonly googleService: GoogleService) {}

  @Post('signup')
  googleSSOSignup(@Body() body: { credential: string }) {
    return this.googleService.googleSSOSignup(body);
  }

  @Post('token-exchange')
  googleTokenExchange(@Body() body: { credential: string }) {
    return this.googleService.googleTokenExchange(body);
  }
}
