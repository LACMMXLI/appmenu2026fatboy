import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { resolveCorsOrigin } from './lib/cors.js';

const port = Number(process.env.PORT ?? 8372);
const corsOrigin = resolveCorsOrigin();

const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

app.useBodyParser('json', { limit: '12mb' });
app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

app.getHttpAdapter().getInstance().set('trust proxy', 1);

app.setGlobalPrefix('api');
app.use((req: any, res: any, next: () => void) => {
  if (req.path?.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }

  next();
});
app.enableCors({
  origin: corsOrigin,
  credentials: true,
});

await app.listen(port, '0.0.0.0');

console.log(`Fatboy POS backend listo en http://localhost:${port}/api`);
