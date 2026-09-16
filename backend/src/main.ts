import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { readEnvironment } from './config/environment.js';

async function bootstrap() {
  const environment = readEnvironment(process.env);
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app, environment);
  await app.listen(environment.port);
}
await bootstrap();
