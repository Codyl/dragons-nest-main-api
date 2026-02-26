// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom'; // Or use a custom guard
import { CognitoJwtVerifier } from 'aws-jwt-verify';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'cognito-jwt') {
  private verifier;

  constructor() {
    super();
    this.verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID!,
      tokenUse: 'access',
      clientId: process.env.COGNITO_CLIENT_ID!,
    });
  }

  async validate(req: Request) {
    const token = req.cookies?.['access_token']; // Using your cookie logic!
    if (!token) throw new UnauthorizedException();

    try {
      const payload = await this.verifier.verify(token);
      return payload; // This becomes req.user
    } catch {
      throw new UnauthorizedException();
    }
  }
}
