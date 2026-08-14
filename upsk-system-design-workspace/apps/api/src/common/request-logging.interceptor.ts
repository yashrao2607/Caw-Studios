import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpRequest');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = performance.now();
    const req = context.switchToHttp().getRequest<Request & { requestId?: string }>();
    const res = context.switchToHttp().getResponse<Response>();
    const requestId = req.requestId ?? 'unknown';
    const route = `${req.method} ${req.originalUrl ?? req.url}`;

    return next.handle().pipe(
      tap({
        next: () => this.log(route, requestId, res.statusCode, startedAt),
        error: () => this.log(route, requestId, res.statusCode ?? 500, startedAt),
      }),
    );
  }

  private log(route: string, requestId: string, statusCode: number, startedAt: number): void {
    const latencyMs = Math.round((performance.now() - startedAt) * 100) / 100;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'log';
    this.logger[level]({ requestId, route, statusCode, latencyMs }, 'request handled');
  }
}
