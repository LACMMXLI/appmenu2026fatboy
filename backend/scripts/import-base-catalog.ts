import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { PrismaClient, type CatalogStatus } from '@prisma/client';

type CsvRecord = Record<string, string | undefined>;

const baseDataDir = resolve(
  process.cwd(),
  process.env.BASE_DATA_DIR ?? (existsSync(resolve(process.cwd(), './base')) ? './base' : '../../base')
);
const importOnlyIfEmpty = process.argv.includes('--if-empty');

const files = {
  branches: 'branches_rows.csv',
  categories: 'categories_rows.csv',
  products: 'products_rows.csv',
};

const missingFiles = Object.values(files).filter((fileName) => !existsSync(resolve(baseDataDir, fileName)));

if (missingFiles.length > 0) {
  console.error(`No se encontraron archivos base en ${baseDataDir}: ${missingFiles.join(', ')}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL no está configurado. Crea apps/backend/.env antes de importar.');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  let shouldImport = true;

  if (importOnlyIfEmpty) {
    const productsCount = await prisma.product.count();

    if (productsCount > 0) {
      console.log(`Catálogo existente detectado (${productsCount} productos). Se omite importación base.`);
      shouldImport = false;
    }
  }

  if (shouldImport) {
  const [branches, categories, products] = await Promise.all([
    readCsv(files.branches),
    readCsv(files.categories),
    readCsv(files.products),
  ]);

  for (const row of branches) {
    const id = required(row, 'id');

    await prisma.branch.upsert({
      where: { id },
      update: {
        name: required(row, 'name'),
        phone: optional(row, 'phone'),
        createdAt: parseDate(row.created_at),
      },
      create: {
        id,
        name: required(row, 'name'),
        phone: optional(row, 'phone'),
        createdAt: parseDate(row.created_at),
      },
    });
  }

  for (const row of categories) {
    const id = required(row, 'id');

    await prisma.category.upsert({
      where: { id },
      update: {
        name: required(row, 'name'),
        order: parseIntValue(row.order, 999),
        status: parseStatus(row.status),
        createdAt: parseDate(row.created_at),
      },
      create: {
        id,
        name: required(row, 'name'),
        order: parseIntValue(row.order, 999),
        status: parseStatus(row.status),
        createdAt: parseDate(row.created_at),
      },
    });
  }

  for (const row of products) {
    const id = required(row, 'id');

    await prisma.product.upsert({
      where: { id },
      update: {
        name: required(row, 'name'),
        price: required(row, 'price'),
        categoryId: required(row, 'category_id'),
        status: parseStatus(row.status),
        description: optional(row, 'description'),
        shortDescription: optional(row, 'short_description'),
        imageUrl: optional(row, 'image_url'),
        order: parseIntValue(row.order, 999),
        isPromotion: parseBoolean(row.is_promotion),
        createdAt: parseDate(row.created_at),
      },
      create: {
        id,
        name: required(row, 'name'),
        price: required(row, 'price'),
        categoryId: required(row, 'category_id'),
        status: parseStatus(row.status),
        description: optional(row, 'description'),
        shortDescription: optional(row, 'short_description'),
        imageUrl: optional(row, 'image_url'),
        order: parseIntValue(row.order, 999),
        isPromotion: parseBoolean(row.is_promotion),
        createdAt: parseDate(row.created_at),
      },
    });
  }

  console.log(`Importación completada desde ${baseDataDir}.`);
  console.log(`Sucursales: ${branches.length}`);
  console.log(`Categorías: ${categories.length}`);
  console.log(`Productos: ${products.length}`);
  }
} finally {
  await prisma.$disconnect();
}

async function readCsv(fileName: string): Promise<CsvRecord[]> {
  const content = await readFile(resolve(baseDataDir, fileName), 'utf8');

  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRecord[];
}

function required(row: CsvRecord, key: string): string {
  const value = optional(row, key);

  if (!value) {
    throw new Error(`Campo requerido vacío: ${key}`);
  }

  return value;
}

function optional(row: CsvRecord, key: string): string | null {
  const value = row[key]?.trim();
  return value ? value : null;
}

function parseStatus(value: string | undefined): CatalogStatus {
  return value === 'inactive' ? 'inactive' : 'active';
}

function parseBoolean(value: string | undefined): boolean {
  return value?.toLowerCase() === 'true';
}

function parseIntValue(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDate(value: string | undefined): Date {
  if (!value) {
    return new Date();
  }

  const normalized = value
    .replace(' ', 'T')
    .replace(/\.(\d{3})\d+/, '.$1')
    .replace(/\+00$/, 'Z');

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}
