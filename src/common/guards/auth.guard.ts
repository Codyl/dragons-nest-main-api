import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  COGNITO_CLIENT_ID,
  COGNITO_USER_POOL_ID,
  JWT_SECRET,
} from 'src/env.constants';
import { EnvironmentVariables } from 'src/env.config';
import {
  PASSKEY_SESSION_COOKIE_NAME,
  verifyPasskeySession,
} from 'src/common/utils/passkey-jwt';

export type AuthType = 'cognito' | 'passkey';

export interface AuthenticatedRequest extends Request {
  user?: Record<string, unknown> & { sub?: string; email?: string };
  accessToken?: string;
  authType?: AuthType;
}

type CognitoAccessVerifier = {
  verify(jwt: string): Promise<Record<string, unknown> & { sub?: string }>;
};

/**
 * Guard that ensures the request is from a non-expired authenticated user.
 * Accepts either Cognito ACCESS_TOKEN or passkey session cookie (PASSKEY_SESSION).
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
    const passkeyToken = (request.signedCookies?.[
      PASSKEY_SESSION_COOKIE_NAME
    ] ?? request.cookies?.[PASSKEY_SESSION_COOKIE_NAME]) as string | undefined;

    if (cognitoToken) {
      try {
        const payload = await this.verifier.verify(cognitoToken);
        request.user = payload as Record<string, unknown> & { sub?: string };
        request.accessToken = cognitoToken;
        request.authType = 'cognito';
        return true;
      } catch {
        // Fall through to try passkey
      }
    }

    if (passkeyToken) {
      const secret = this.configService.getOrThrow(JWT_SECRET, {
        infer: true,
      });
      const payload = verifyPasskeySession(passkeyToken, secret);
      if (payload) {
        request.user = { sub: payload.sub };
        request.accessToken = passkeyToken;
        request.authType = 'passkey';
        return true;
      }
    }

    throw new UnauthorizedException(
      'Not authenticated (missing or invalid session cookie)',
    );
  }
}
