import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { randomUUID } from 'node:crypto';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  requestId: string;
  path: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const requestId = (request.requestId as string) ?? randomUUID();
    const path = request.originalUrl ?? request.url ?? '/';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const candidate = (body as { message?: string | string[] }).message;
        if (typeof candidate === 'string' || Array.isArray(candidate)) {
          message = candidate;
        }
        error = (body as { error?: string }).error ?? exception.name;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'database request failed';
      error = 'DatabaseError';
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'invalid database query';
      error = 'DatabaseError';
    }

    if (status >= 500) {
      this.logger.error(
        {
          err: exception instanceof Error ? { name: exception.name, message: exception.message, stack: exception.stack } : exception,
          requestId,
          path,
        },
        'Unhandled exception',
      );
    } else {
      this.logger.warn({ requestId, path, status, message }, 'Request failed');
    }

    const body: ErrorBody = {
      statusCode: status,
      error,
      message: status >= 500 && process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
      requestId,
      path,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }
}
