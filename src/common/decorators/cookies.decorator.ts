import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const Cookies = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return data ? request.cookies?.[data] : request.cookies;
  },
);
