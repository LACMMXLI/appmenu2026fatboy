# Plan de despliegue en Coolify para menu digital/web con API, frontend y almacenamiento S3

## Objetivo

Preparar este proyecto para desplegar el menu digital y sitio web del negocio en Coolify usando contenedores separados dentro del mismo proyecto/stack:

- `frontend`: React/Vite compilado y servido como aplicacion web.
- `backend`: API NestJS con Prisma.
- `postgres`: base de datos PostgreSQL persistente.
- `minio`: almacenamiento compatible con S3 para imagenes.
- `minio-init` o script equivalente: creacion inicial de bucket/politicas.
- `migrations` o comando de arranque controlado: aplicar migraciones Prisma antes de levantar la API.

La regla principal se mantiene: el backend es la fuente canonica de datos. El frontend no debe contener credenciales S3 ni decidir reglas de almacenamiento.

## Decision de arquitectura

No conviene meter API, frontend, PostgreSQL y MinIO dentro de un solo contenedor. La forma correcta para Coolify es un mismo proyecto con varios servicios en `docker-compose.yml`.

Cada servicio corre en su propio contenedor, pero todos pertenecen al mismo stack de Coolify y se comunican por nombre interno:

- El frontend llama a la API por dominio publico o por proxy interno.
- El backend se conecta a PostgreSQL usando host `postgres`.
- El backend se conecta a MinIO usando host `minio`.
- MinIO guarda archivos en un volumen persistente.
- PostgreSQL guarda datos en un volumen persistente.

## Estrategia recomendada

Usar Docker Compose como punto central de despliegue:

- `docker-compose.yml` en la raiz.
- `apps/backend/Dockerfile` para construir la API.
- `apps/frontend/Dockerfile` para construir y servir el frontend.
- Archivo `.dockerignore` en raiz para excluir `node_modules`, logs, builds locales y archivos sensibles.
- Variables de entorno documentadas en `.env.example` sin secretos reales.

Coolify debe configurarse con build pack `Docker Compose`, base directory `/`, y compose location `docker-compose.yml`.

## Flujo de imagenes

El flujo debe quedar asi:

1. Admin o modulo autorizado sube una imagen desde el frontend.
2. El frontend envia el archivo al backend por un endpoint autenticado/admin.
3. El backend valida tipo, tamano, extension y contexto del archivo.
4. El backend sube el objeto a MinIO usando credenciales privadas.
5. El backend guarda en PostgreSQL el `imageUrl` y, si hace falta, tambien el `objectKey`.
6. El frontend muestra las imagenes usando la URL entregada por la API.

No se debe subir directamente desde frontend a MinIO en la primera version, porque eso obliga a exponer credenciales o a implementar firmas temporales antes de tener control completo.

## Opciones para exponer imagenes

### Opcion A: bucket publico solo para lectura

MinIO permite que el bucket de imagenes sea publico para lectura. El backend sube los archivos y guarda URLs publicas.

Ventajas:

- Simple.
- Rapido para imagenes de productos y banners.
- Menos carga para el backend.

Riesgos:

- Cualquier persona con la URL puede ver la imagen.
- Hay que cuidar nombres de objetos y no subir archivos privados.

### Opcion B: backend como proxy de imagenes

El frontend consume URLs tipo `/api/media/products/...`, y el backend lee desde MinIO.

Ventajas:

- Mas control.
- MinIO puede quedar totalmente privado.
- Mejor para archivos sensibles.

Riesgos:

- Mas carga para backend.
- Hay que cuidar cache headers para no afectar rendimiento.

Recomendacion inicial: usar opcion A para imagenes publicas de catalogo y banners. Si despues se agregan documentos privados o archivos de clientes, usar opcion B para esos casos.

## Variables de entorno necesarias

Backend:

```env
PORT=8372
DATABASE_URL=postgresql://menu_app:${POSTGRES_PASSWORD}@postgres:5432/menu_digital_web
ADMIN_CATALOG_KEY=...
PUBLIC_APP_URL=https://app.tudominio.com
CORS_ORIGIN=https://app.tudominio.com
S3_ENDPOINT=http://minio:9000
S3_PUBLIC_ENDPOINT=https://s3.tudominio.com
S3_REGION=us-east-1
S3_BUCKET=fatboy-images
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_FORCE_PATH_STYLE=true
MAX_UPLOAD_MB=5
```

Frontend:

```env
VITE_API_BASE_URL=https://api.tudominio.com/api
```

PostgreSQL:

```env
POSTGRES_DB=menu_digital_web
POSTGRES_USER=menu_app
POSTGRES_PASSWORD=...
```

MinIO:

```env
MINIO_ROOT_USER=...
MINIO_ROOT_PASSWORD=...
MINIO_DEFAULT_BUCKET=fatboy-images
```

## Archivos a crear en fases posteriores

```text
docker-compose.yml
.dockerignore
apps/backend/Dockerfile
apps/frontend/Dockerfile
apps/frontend/nginx.conf
apps/backend/src/modules/storage/storage.module.ts
apps/backend/src/modules/storage/storage.service.ts
apps/backend/src/modules/media/media.controller.ts
```

Opcional si se decide automatizar bucket y politica:

```text
docker/minio/create-bucket.sh
docker/minio/policy-public-read.json
```

## Paso 1: preparar contenedores base

1. Crear `.dockerignore` en raiz.
2. Crear `apps/backend/Dockerfile`.
3. Crear `apps/frontend/Dockerfile`.
4. Crear `apps/frontend/nginx.conf` si el frontend se sirve con Nginx.
5. Crear `docker-compose.yml` con servicios separados:
   - `frontend`
   - `backend`
   - `postgres`
   - `minio`
   - `minio-init`
6. Definir volumen persistente para PostgreSQL.
7. Definir volumen persistente para MinIO.
8. No exponer PostgreSQL al exterior.
9. No exponer MinIO API al exterior salvo que se decida usar bucket publico por dominio controlado.

Resultado esperado: el proyecto compila y levanta localmente con `docker compose up --build`.

## Paso 2: preparar base de datos y migraciones

1. Confirmar que Prisma usa `DATABASE_URL`.
2. Agregar un proceso de migracion controlado:
   - opcion simple: comando manual `npm --prefix apps/backend run prisma:deploy` dentro del contenedor.
   - opcion automatizada: servicio `migrations` en compose que corre `prisma migrate deploy`.
3. Evitar `prisma migrate dev` en produccion.
4. Validar que el backend arranca despues de PostgreSQL y despues de migraciones.

Resultado esperado: Coolify puede crear la base y aplicar migraciones sin pasos manuales peligrosos.

## Paso 3: preparar MinIO/S3

1. Agregar servicio `minio` al compose.
2. Agregar volumen persistente para `/data`.
3. Agregar servicio `minio-init` con cliente `mc` para:
   - esperar a que MinIO este listo.
   - crear bucket `fatboy-images`.
   - configurar politica de lectura si se usa bucket publico.
4. Definir credenciales desde variables de Coolify, nunca hardcodeadas.
5. Decidir dominio publico para imagenes:
   - `https://s3.tudominio.com/fatboy-images/...`, o
   - mantener MinIO privado y servir por `/api/media/...`.

Resultado esperado: el backend puede subir y leer archivos usando API compatible con S3.

## Paso 4: agregar modulo backend de almacenamiento

1. Instalar SDK S3 compatible en backend.
2. Crear `StorageModule` y `StorageService`.
3. Centralizar ahi:
   - cliente S3.
   - bucket.
   - validacion de endpoint.
   - generacion de `objectKey`.
   - subida de archivo.
   - eliminacion futura.
   - URL publica o URL proxy.
4. No duplicar logica S3 dentro de catalogo o banners.
5. Validar:
   - MIME permitido: `image/jpeg`, `image/png`, `image/webp`.
   - tamano maximo.
   - nombre normalizado.
   - ruta por contexto: `products/`, `banners/`, `branches/`.

Resultado esperado: el backend queda listo para manejar imagenes sin que el frontend sepa de MinIO.

## Paso 5: endpoints para imagenes

1. Crear endpoint admin para subir imagen:

```text
POST /api/admin/media/images
```

2. Recibir `multipart/form-data`.
3. Recibir contexto opcional:
   - `product`
   - `banner`
   - `branch`
4. Responder:

```json
{
  "url": "https://...",
  "objectKey": "products/..."
}
```

5. Usar el endpoint desde la pantalla de catalogo/admin.
6. Mantener `imageUrl` como campo fuente en productos y banners para no romper el modelo actual.

Resultado esperado: la carga de imagenes queda integrada sin cambiar de golpe todo el catalogo.

## Paso 6: adaptar frontend

1. Mantener `VITE_API_BASE_URL` como unica configuracion de API.
2. En `AdminCatalogView`, reemplazar el input manual de URL por:
   - input URL manual opcional.
   - selector de archivo.
   - preview.
   - boton de subir.
3. Al subir, guardar la URL devuelta por backend en `imageUrl`.
4. No agregar logica S3 al frontend.
5. Mantener fallback visual para productos sin imagen.

Resultado esperado: el admin puede cargar imagenes desde la UI y el cliente final las ve desde catalogo, promos, detalle y banners.

## Paso 7: configurar Coolify

1. Crear nuevo recurso en Coolify.
2. Seleccionar repositorio.
3. Seleccionar build pack `Docker Compose`.
4. Base directory: `/`.
5. Docker Compose location: `docker-compose.yml`.
6. Configurar variables requeridas en Coolify.
7. Asignar dominios:
   - frontend: `https://app.tudominio.com`
   - API: `https://api.tudominio.com`
   - MinIO console: opcional y restringida.
   - MinIO public endpoint: solo si se usa bucket publico.
8. No publicar PostgreSQL.
9. Revisar volumenes persistentes antes del primer deploy real.

Resultado esperado: Coolify levanta todos los servicios como un stack unico.

## Paso 8: verificacion

Checklist local:

- `npm run lint`
- `npm run build`
- `docker compose build`
- `docker compose up`
- API responde en `/api`.
- Frontend carga y llama a la API correcta.
- Prisma conecta a PostgreSQL.
- Migraciones aplican correctamente.
- MinIO mantiene archivos despues de reiniciar contenedores.
- Subida de imagen desde admin funciona.
- Imagen se muestra en catalogo, promociones, detalle y banners.

Checklist en Coolify:

- frontend responde por HTTPS.
- API responde por HTTPS.
- CORS permite solo el dominio del frontend.
- PostgreSQL no esta expuesto publicamente.
- MinIO no expone consola sin necesidad.
- Los volumenes persisten despues de redeploy.
- Logs de backend no muestran secretos.
- Imagen subida desde produccion sigue disponible tras reiniciar servicios.

## Orden recomendado de implementacion

1. Crear Dockerfiles y compose minimo sin MinIO.
2. Validar build local de frontend/backend.
3. Agregar PostgreSQL al compose y validar Prisma.
4. Agregar MinIO al compose.
5. Agregar variables S3 al backend.
6. Crear StorageModule.
7. Crear endpoint de subida.
8. Integrar UI admin.
9. Probar local con Docker.
10. Configurar Coolify.
11. Hacer primer deploy.
12. Ajustar dominios, CORS y public URLs.

## Riesgos principales

- `VITE_API_BASE_URL` se define en build time; si cambia el dominio, hay que reconstruir frontend.
- Si MinIO usa dominio publico distinto al interno, el backend debe usar `S3_ENDPOINT` interno para subir y `S3_PUBLIC_ENDPOINT` para devolver URLs.
- Si el bucket se hace publico, solo debe usarse para imagenes publicas.
- Si las migraciones corren en cada arranque sin control, pueden bloquear el deploy.
- Si se exponen puertos con `ports`, se puede saltar el proxy de Coolify; en produccion conviene usar dominios del proxy.
- Si se definen redes custom en compose, Coolify puede tener problemas de proxy. Mejor dejar que Coolify cree la red.

## Fuentes consultadas

- Coolify Docker Compose: https://coolify.io/docs/knowledge-base/docker/compose
- Coolify Docker Compose build pack: https://coolify.io/docs/applications/build-packs/docker-compose
- Coolify Dockerfile build pack: https://coolify.io/docs/applications/build-packs/dockerfile
- MinIO container deployment: https://docs.min.io/aistor/installation/container/
