import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url } = req;
    const now = Date.now();

    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          `${method} ${url} ${res.statusCode} - ${Date.now() - now}ms`,
        );
      }),
      catchError((err: unknown) => {
        const error = err as {
          status?: number;
          statusCode?: number;
          stack?: string;
        };
        const status = error?.status || error?.statusCode || 500;

        this.logger.error(
          `${method} ${url} ${status} - ${Date.now() - now}ms`,
          error?.stack,
        );

        return throwError(() => err);
      }),
    );
  }
}
