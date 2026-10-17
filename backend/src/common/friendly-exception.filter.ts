import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class FriendlyExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(FriendlyExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      response.status(exception.getStatus()).json(typeof payload === 'string' ? { message: payload } : payload);
      return;
    }

    if (this.isConnectivityFailure(exception)) {
      this.logger.warn(`Temporary database connectivity failure on ${request.method} ${request.url}`);
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Reelch is having trouble connecting right now. Please wait a moment and try again.',
        error: 'Service Unavailable',
      });
      return;
    }

    this.logger.error(`Unexpected error on ${request.method} ${request.url}`, exception instanceof Error ? exception.stack : String(exception));
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something did not work as expected. Please try again in a moment.',
      error: 'Unexpected Error',
    });
  }

  private isConnectivityFailure(exception: unknown) {
    let current: unknown = exception;
    for (let depth = 0; current && depth < 6; depth += 1) {
      const value = current as { message?: unknown; code?: unknown; cause?: unknown };
      const message = String(value.message ?? '').toLowerCase();
      const code = String(value.code ?? '').toUpperCase();
      if (['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code)) return true;
      if (/connection (terminated|timeout|timed out|refused)|connect timeout|network.*error|socket hang up/.test(message)) return true;
      current = value.cause;
    }
    return false;
  }
}
