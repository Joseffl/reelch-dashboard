import type { Request, Response } from 'express';
import express from 'express';
import { ExpressAdapter } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { readEnvironment } from '../src/config/environment.js';

type Server = ReturnType<typeof express>;

let applicationPromise: Promise<Server> | undefined;

async function createApplication() {
  const environment = readEnvironment(process.env);
  const server = express();
  const app: INestApplication = await NestFactory.create(
    AppModule,
    new ExpressAdapter(server),
    { rawBody: true },
  );
  configureApp(app, environment);
  await app.init();
  return server;
}

function getApplication() {
  applicationPromise ??= createApplication().catch((error: unknown) => {
    applicationPromise = undefined;
    console.error('Unable to initialize Reelch API', error);
    throw error;
  });
  return applicationPromise;
}

export default async function handler(request: Request, response: Response) {
  const server = await getApplication();
  return server(request, response);
}
