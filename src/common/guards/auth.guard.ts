import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { COGNITO_CLIENT_ID, COGNITO_USER_POOL_ID } from 'env.constants';
import { EnvironmentVariables } from 'env.config';

export interface AuthenticatedRequest extends Request {
  user?: Record<string, unknown> & { sub?: string; email?: string };
  accessToken?: string;
}

type CognitoAccessVerifier = {
  verify(jwt: string): Promise<Record<string, unknown> & { sub?: string }>;
};

/**
 * Guard that ensures the request is from a non-expired authenticated user.
 * Reads the Cognito access token from the signed cookie, verifies it via
 * Cognito JWKS (issuer, audience, signature, expiration), and attaches
 * the payload and token to the request.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly verifier: CognitoAccessVerifier;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {
    this.verifier = CognitoJwtVerifier.create({
      userPoolId: this.configService.getOrThrow(COGNITO_USER_POOL_ID, {
        infer: true,
      }),
      tokenUse: 'access',
      clientId: this.configService.getOrThrow(COGNITO_CLIENT_ID, {
        infer: true,
      }),
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = (request.signedCookies?.['ACCESS_TOKEN'] ??
      request.cookies?.['ACCESS_TOKEN']) as string | undefined;

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
