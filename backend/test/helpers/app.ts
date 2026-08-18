import 'reflect-metadata';
import 'dotenv/config';
import type { AddressInfo } from 'node:net';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../../src/app.module.js';

/**
 * Boots the real AppModule (same bootstrap shape as src/main.ts) on an
 * ephemeral port against the DATABASE_URL in .env — these are integration
 * tests against a real PostgreSQL, not mocks, matching how this whole
 * project has been manually verified throughout development.
 */
export async function bootstrapTestApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: false,
  });

  app.useBodyParser('json', { limit: '12mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });
  app.setGlobalPrefix('api');

  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  return { app, baseUrl };
}

export function uniqueSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
}

export async function json(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
