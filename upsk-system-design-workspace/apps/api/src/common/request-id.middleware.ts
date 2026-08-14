import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { requestId?: string }, _res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    req.requestId = (Array.isArray(incoming) ? incoming[0] : incoming) ?? randomUUID();
    next();
  }
}
