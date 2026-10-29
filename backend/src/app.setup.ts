import type { INestApplication } from '@nestjs/common';
import type { Environment } from './config/environment.js';
import { FriendlyExceptionFilter } from './common/friendly-exception.filter.js';
import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { DatabaseService } from './database/database.service.js';

export function configureApp(
  app: INestApplication,
  environment: Pick<Environment, 'frontendUrl' | 'nodeEnv'>,
) {
  const server = app.getHttpAdapter().getInstance();
  // Set only proxy IPs/CIDRs that are controlled by the hosting platform.
  const trustedProxies = process.env.TRUSTED_PROXY_CIDRS?.split(',').map(value => value.trim()).filter(Boolean);
  if (trustedProxies?.some(value => value === 'true' || /^\d+$/.test(value))) throw new Error('TRUSTED_PROXY_CIDRS must contain proxy addresses or CIDRs, not blanket trust');
  server.set('trust proxy', trustedProxies?.length ? trustedProxies : false);
  server.disable('x-powered-by');
  const logger = new Logger('HTTP');
  const database = app.get(DatabaseService);
  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestId = randomUUID();
    const start = performance.now();
    response.setHeader('X-Request-Id', requestId);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.on('finish', () => {
      // Route patterns avoid recording invitation tokens, query strings or PII.
      logger.log(JSON.stringify({ event: 'http_request', requestId, method: request.method,
        route: request.route?.path ?? 'unmatched', status: response.statusCode,
        durationMs: Math.round(performance.now() - start), pool: database.poolStats() }));
    });
    next();
  });
  const allowedOrigins = new Set([environment.frontendUrl]);
  if (environment.nodeEnv !== 'production') {
    allowedOrigins.add('http://localhost:3000');
    allowedOrigins.add('http://127.0.0.1:3000');
  }
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new FriendlyExceptionFilter());
  app.enableCors({
    origin: [...allowedOrigins],
    credentials: true,
  });
  app.enableShutdownHooks();
}
