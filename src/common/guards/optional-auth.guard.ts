import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { COGNITO_CLIENT_ID, COGNITO_USER_POOL_ID } from 'src/env.constants';
import { EnvironmentVariables } from 'src/env.config';
import type { AuthenticatedRequest } from './auth.guard';

type CognitoAccessVerifier = {
  verify(jwt: string): Promise<Record<string, unknown> & { sub?: string }>;
};

/**
 * Attaches `request.user` when a valid ACCESS_TOKEN cookie is present;
 * otherwise leaves the request unauthenticated and still allows the handler to run.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
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
    const request = context
      .switchToHttp()
      .getRequest<Request & Partial<AuthenticatedRequest>>();

    const cognitoToken = (request.signedCookies?.['ACCESS_TOKEN'] ??
      request.cookies?.['ACCESS_TOKEN']) as string | undefined;

    if (cognitoToken) {
      try {
        const payload = await this.verifier.verify(cognitoToken);
        request.user = payload as Record<string, unknown> & { sub?: string };
        request.accessToken = cognitoToken;
        request.authType = 'cognito';
      } catch {
        // leave unauthenticated
      }
    }

    return true;
  }
}
