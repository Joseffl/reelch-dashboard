import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { readEnvironment } from './config/environment.js';
import express, { type Request, type Response } from 'express';
import { ExpressAdapter } from '@nestjs/platform-express';

export async function createApplication() {
  const environment = readEnvironment(process.env);
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), { rawBody: true });
  configureApp(app, environment);
  await app.init();
  return app;
}

// Keep NestFactory in the detected entrypoint. Requests share cold-start setup.
let application: ReturnType<typeof createApplication> | undefined;
export function getApplication() {
  application ??= createApplication().catch((error: unknown) => {
    application = undefined;
    throw error;
  });
  return application;
}

export default async function handler(request: Request, response: Response) {
  const app = await getApplication();
  return app.getHttpAdapter().getInstance()(request, response);
}

if (!process.env.VERCEL) {
  const app = await createApplication();
  await app.listen(readEnvironment(process.env).port, '0.0.0.0');
}
