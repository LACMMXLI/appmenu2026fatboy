import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const port = Number(process.env.PORT ?? 3000);

const app = await NestFactory.create(AppModule);

app.setGlobalPrefix('api');
app.enableCors({
  origin: true,
  credentials: true,
});

await app.listen(port, '0.0.0.0');

console.log(`Fatboy POS backend listo en http://localhost:${port}/api`);
