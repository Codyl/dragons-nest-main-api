import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedRequest,
  AuthType as AuthTypeGuard,
} from 'src/common/guards/auth.guard';

export const AuthType = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthTypeGuard | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    return request.authType;
  },
);
