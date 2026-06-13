import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const port = Number(process.env.PORT ?? 8372);
const corsOrigin = parseCorsOrigin(process.env.CORS_ORIGIN);

const app = await NestFactory.create(AppModule);

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

function parseCorsOrigin(value?: string): boolean | string[] {
  if (!value) {
    return [
      'http://localhost:8371',
      'http://127.0.0.1:8371',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ];
  }

  if (value.trim() === '*') {
    return true;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
