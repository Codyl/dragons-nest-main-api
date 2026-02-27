import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

export interface AuthenticatedRequest extends Request {
  user?: Record<string, unknown> & { sub?: string };
  accessToken?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    tokenUse: 'access',
    clientId: process.env.COGNITO_CLIENT_ID,
  });

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token =
      (request.signedCookies as Record<string, string> | undefined)?.[
        'ACCESS_TOKEN'
      ] ?? request.cookies?.['ACCESS_TOKEN'];

    if (!token) {
      throw new UnauthorizedException(
        'Not authenticated (missing session cookie)',
      );
    }

    try {
      const payload = await this.verifier.verify(token);
      request.user = payload as Record<string, unknown> & { sub?: string };
      request.accessToken = token;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
