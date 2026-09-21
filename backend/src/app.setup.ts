import type { INestApplication } from '@nestjs/common';
import type { Environment } from './config/environment.js';

export function configureApp(
  app: INestApplication,
  environment: Pick<Environment, 'frontendUrl' | 'nodeEnv'>,
) {
  const allowedOrigins = new Set([environment.frontendUrl]);
  if (environment.nodeEnv !== 'production') {
    allowedOrigins.add('http://localhost:3000');
    allowedOrigins.add('http://127.0.0.1:3000');
  }
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: [...allowedOrigins],
    credentials: true,
  });
  app.enableShutdownHooks();
}
