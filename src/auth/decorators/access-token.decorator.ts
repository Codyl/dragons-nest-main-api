import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from 'src/common/guards/auth.guard';

export const AccessToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.accessToken;
  },
);
