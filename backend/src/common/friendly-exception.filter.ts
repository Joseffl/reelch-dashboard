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
      if (exception.getStatus() === 503 && !response.hasHeader('Retry-After')) response.setHeader('Retry-After', '3');
      const payload = exception.getResponse();
      response.status(exception.getStatus()).json(typeof payload === 'string' ? { message: payload } : payload);
      return;
    }

    if (this.isConnectivityFailure(exception)) {
      this.logger.warn(`Temporary database connectivity failure on ${request.method} ${request.route?.path ?? 'unmatched'}`);
      response.setHeader('Retry-After', '3');
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Reelch is having trouble connecting right now. Please wait a moment and try again.',
        error: 'Service Unavailable',
      });
      return;
    }

    const code = this.databaseCode(exception);
    if (code === '23505') {
      response.status(409).json({ statusCode: 409, message: 'An account or record with these details already exists.' });
      return;
    }
    if (['53300', '53400', '57014', '57P01', '57P03', '55P03', '40001', '40P01'].includes(code)) {
      response.setHeader('Retry-After', '3');
      response.status(503).json({ statusCode: 503, message: 'Reelch is busy. Please try again shortly.' });
      return;
    }

    // Drizzle error stacks can include query values. Keep request identifiers and
    // database codes for correlation without recording submitted account details.
    this.logger.error(JSON.stringify({ event: 'request_error', requestId: response.getHeader('X-Request-Id'), method: request.method, route: request.route?.path ?? 'unmatched', code, error: exception instanceof Error ? exception.name : 'UnknownError' }));
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something did not work as expected. Please try again in a moment.',
      error: 'Unexpected Error',
    });
  }

  private databaseCode(exception: unknown): string {
    let current = exception;
    for (let depth = 0; current && depth < 6; depth += 1) {
      const value = current as { code?: string; cause?: unknown };
      if (value.code) return value.code;
      current = value.cause;
    }
    return '';
  }

  private isConnectivityFailure(exception: unknown) {
    let current: unknown = exception;
    for (let depth = 0; current && depth < 6; depth += 1) {
      const value = current as { message?: unknown; code?: unknown; cause?: unknown };
      const message = String(value.message ?? '').toLowerCase();
      const code = String(value.code ?? '').toUpperCase();
      if (['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code)) return true;
      if (/connection (terminated|timeout|timed out|refused)|connect timeout|timeout exceeded when trying to connect|query read timeout|network.*error|socket hang up/.test(message)) return true;
      current = value.cause;
    }
    return false;
  }
}
