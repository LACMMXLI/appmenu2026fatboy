# Fatboy POS Backend

Backend de la aplicacion web.

Estructura inicial:

- `src/`: API NestJS y logica de negocio.
- `prisma/`: schema, migraciones y configuracion de base de datos.
- `scripts/`: tareas operativas, como importaciones desde los CSV de `../../base`.

Regla del proyecto: el backend debe ser la fuente de verdad. El frontend no debe duplicar reglas de negocio ni calculos que pertenezcan al servidor.

Endpoints iniciales:

- `GET /api/health`
- `GET /api/branches`
- `GET /api/categories`
- `GET /api/products`
