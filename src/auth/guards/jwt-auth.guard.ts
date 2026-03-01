import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

export interface AuthenticatedRequest extends Request {
  user?: Record<string, unknown> & { sub?: string };
  accessToken?: string;
}

/** Verifier type: has verify(jwt) returning payload with optional sub */
type CognitoAccessVerifier = {
  verify(jwt: string): Promise<Record<string, unknown> & { sub?: string }>;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly verifier: CognitoAccessVerifier;

  constructor(private readonly configService: ConfigService) {
    this.verifier = CognitoJwtVerifier.create({
      userPoolId: this.configService.get<string>('COGNITO_USER_POOL_ID')!,
      tokenUse: 'access',
      clientId: this.configService.get<string>('COGNITO_CLIENT_ID')!,
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = (request.signedCookies?.['ACCESS_TOKEN'] ??
      request.cookies?.['ACCESS_TOKEN'])! as string;

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
