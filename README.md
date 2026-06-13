# Fatboy POS Web

Monorepo para la aplicacion menu web de Fatboy.

## Estructura

```text
apps/
  frontend/   React + Vite + TypeScript + Tailwind
  backend/    API NestJS + Prisma
base/         Respaldos CSV y contexto de Supabase
```

## Comandos

```bash
npm run dev:frontend
npm run dev:backend
npm run build
npm run lint
npm run prisma:generate
npm run prisma:migrate
npm run import:base
```

El backend expone endpoints de catalogo en `/api/branches`, `/api/categories` y `/api/products`.

Para cargar los CSV de `base/`:

1. Copia `apps/backend/.env.example` a `apps/backend/.env`.
2. Ajusta `DATABASE_URL`.
3. Ejecuta `npm run prisma:migrate`.
4. Ejecuta `npm run import:base`.

En Docker/Coolify, el backend ejecuta `prisma migrate deploy` al iniciar y carga el catálogo base solo cuando la tabla `products` está vacía.
