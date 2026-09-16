import type { INestApplication } from '@nestjs/common';
import type { Environment } from './config/environment.js';

export function configureApp(
  app: INestApplication,
  environment: Pick<Environment, 'frontendUrl'>,
) {
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: environment.frontendUrl,
    credentials: true,
  });
  app.enableShutdownHooks();
}
