import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { COGNITO_CLIENT_ID, COGNITO_USER_POOL_ID } from 'src/env.constants';
import { EnvironmentVariables } from 'src/env.config';

export type AuthType = 'cognito';

export interface AuthenticatedRequest extends Request {
  user?: Record<string, unknown> & { sub?: string; email?: string };
  accessToken?: string;
  authType?: AuthType;
}

type CognitoAccessVerifier = {
  verify(jwt: string): Promise<Record<string, unknown> & { sub?: string }>;
};

/**
 * Guard that ensures the request is from a non-expired authenticated user (Cognito ACCESS_TOKEN cookie).
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

    const cognitoToken = (request.signedCookies?.['ACCESS_TOKEN'] ??
      request.cookies?.['ACCESS_TOKEN']) as string | undefined;

    if (cognitoToken) {
      try {
        const payload = await this.verifier.verify(cognitoToken);
        request.user = payload as Record<string, unknown> & { sub?: string };
        request.accessToken = cognitoToken;
        request.authType = 'cognito';
        return true;
      } catch {
        // invalid token
      }
    }

    throw new UnauthorizedException(
      'Not authenticated (missing or invalid session cookie)',
    );
  }
}
