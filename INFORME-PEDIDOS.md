# Informe final — Sistema robusto de pedidos (menú digital Fatboy)

Implementación de `nuevo modulo.md`: folio, aprobación por sucursal, máquina de estados, historial/auditoría y tiempo real, sobre la arquitectura existente (React/Vite/TS + NestJS/Prisma/PostgreSQL).

## 1. Qué encontré originalmente (Fase Cero)

- Auth de clientes ya era sesión opaca en tabla `Session` (no JWT) con Argon2id — correcto, no se tocó.
- `POST /orders` ya exigía sesión y ya recalculaba precios/extras desde la DB — no reconstruido.
- **`GET /orders/:id` no tenía ningún control de autenticación/propiedad** — IDOR real y explotable: cualquiera con un UUID de pedido veía nombre, teléfono, productos y total de otro cliente.
- `GET/PATCH /admin/orders*` solo se protegían con una clave estática compartida (`ADMIN_CATALOG_KEY`) sin scoping real por sucursal ni identidad del operador.
- No existía folio, `OrderStatusHistory`, modelo de personal, ni Socket.IO. `Order.status` era texto libre sin máquina de estados ni control de concurrencia.
- `BranchOrdersView` usaba polling de 5s y un selector de "rol" puramente cosmético (no validado en backend). El botón "Imprimir" estaba disponible incluso en pedidos sin aceptar.
- No había código de "guest orders" que limpiar.
- Hallazgo adicional durante Fase 7: `AdminCatalogView` tenía su **propia** pestaña de pedidos con botones de cambio de estado usando la misma clave compartida — el mismo problema en un segundo lugar no mencionado originalmente.

## 2. Qué modifiqué

### Backend
- **Modelo de datos**: folio único generado por secuencia de PostgreSQL (`nextval`, nunca `count()+1`), `OrderStatus` como enum real, `OrderStatusHistory` inmutable, modelos `Staff`/`StaffSession`.
- **Motor de estados** (`order-status.ts` + `OrderService.transitionOrder`): transiciones explícitas, lock optimista vía `updateMany` condicionado al estado leído (409 si alguien más ya cambió el pedido), escritura del historial en la misma transacción que el cambio de estado.
- **Seguridad**: `GET /orders/:id` y `.../history` ahora exigen ser dueño del pedido o personal de la sucursal (o ADMIN) — 404 si no, nunca confirma existencia. Nuevo módulo `Staff` con login propio (reutiliza el hashing de `AuthService`). `GET/PATCH/POST` de administración de pedidos exigen sesión de `Staff`, con scoping de sucursal server-side.
- **Creación segura**: folio + historial inicial dentro de la misma transacción de creación (ya validaba precios/stock).
- **API operativa**: `POST /orders/:id/accept`, `POST /orders/:id/reject` (motivo obligatorio), `PATCH /orders/:id/status` (resto de la máquina); `GET /orders/mine` y `GET /admin/orders` con paginación cursor.
- **Tiempo real**: `OrdersGateway` (Socket.IO) autenticado en un middleware (`server.use`) antes de aceptar la conexión — evita una condición de carrera real que encontré probando en vivo (autenticar dentro de `handleConnection` permite que el primer mensaje del cliente llegue antes de que exista el estado de auth). Rooms `user:{customerId}` y `branch:{branchId}`, eventos emitidos solo después del commit de Prisma.

### Frontend
- `BranchOrdersView.tsx`: login de personal real, sin selector de rol cosmético; sincronización vía socket con refetch por HTTP en cada evento y en reconexión; botones Aceptar/Rechazar (con motivo); "Imprimir" deshabilitado en `PENDING_APPROVAL`.
- `OrderTrackingView.tsx`: timeline de 5 pasos (Recibido/Aceptado/Preparando/Listo/Entregado) igual al ejemplo del documento; usa el endpoint ya protegido; tiempo real vía socket con reconexión.
- `ProfileView.tsx`: "Pedidos activos" / "Pedidos anteriores" separados, con folio y estados en español.
- `AdminCatalogView` / `AdminCatalogSections.tsx`: la pestaña de pedidos quedó **de solo lectura** (búsqueda administrativa) — los cambios de estado se retiraron de ahí; viven exclusivamente en `BranchOrdersView` con cuentas de personal reales.

## 3. Archivos creados

**Backend**: `src/modules/order/order-status.ts`, `src/modules/order/orders.gateway.ts`, `src/modules/staff/{staff-auth.service.ts,staff-bootstrap.service.ts,staff.controller.ts,staff.module.ts}`, `src/lib/http.ts`, `src/lib/cors.ts`, `prisma/migrations/20260817090000_add_order_workflow/migration.sql`, `test/helpers/app.ts`, `test/order-status.spec.ts`, `test/order-security.spec.ts`, `tsconfig.test.json`.
**Frontend**: `src/lib/socket.ts`.

## 4. Archivos modificados (principales)

`backend/prisma/schema.prisma`, `src/modules/order/{order.controller.ts,order.service.ts,order.module.ts}`, `src/app.module.ts`, `src/main.ts`, `backend/Dockerfile`, `backend/.env.example`, `backend/package.json` · `frontend/src/{lib/api.ts,views/BranchOrdersView.tsx,views/OrderTrackingView.tsx,views/ProfileView.tsx,views/CartView.tsx,views/AdminCatalogView.tsx,views/admin-catalog/AdminCatalogSections.tsx}`, `frontend/vite.config.ts`.

## 5. Migración Prisma

`20260817090000_add_order_workflow`: agrega enums `OrderStatus`/`StaffRole`, tablas `staff`/`staff_sessions`/`order_status_history`, columna `folio` (backfill determinístico por `created_at` + secuencia dedicada), conversión de `status` de texto a enum (mapeo 1:1 de valores viejos), índices (`status`, `branchId+status`, `branchId+createdAt`, `customerId+createdAt`). No destructiva; no se perdió ningún pedido existente.

## 6. Variables de entorno nuevas

`STAFF_BOOTSTRAP_USERNAME`, `STAFF_BOOTSTRAP_PASSWORD`, `STAFF_BOOTSTRAP_NAME` (opcional) — crean la primera cuenta `Staff` ADMIN al arrancar si la tabla está vacía; sin ellas no hay forma de entrar a `BranchOrdersView` la primera vez. Documentadas en `backend/.env.example`.

## 7. Socket.IO

- **Gateway**: `OrdersGateway`, path `/api/socket.io`.
- **Autenticación**: middleware `server.use` valida el mismo token opaco de sesión (cliente o staff) *antes* de aceptar la conexión — token inválido → `connect_error`, nunca llega a conectar.
- **Rooms**: `user:{customerId}` (cliente dueño), `branch:{branchId}` (staff de esa sucursal; ADMIN puede pedir unirse a otra vía `branch:watch`, validado server-side).
- **Eventos**: `order.created` (a la sucursal), `order.status_changed` (a sucursal + cliente dueño) — emitidos únicamente después del commit de PostgreSQL.
- **Payloads**: `{ orderId, branchId, status? }` — mínimos a propósito; el cliente siempre re-consulta por HTTP el estado real.

## 8. Máquina de estados

```
PENDING_APPROVAL → ACCEPTED → PREPARING → READY → COMPLETED
PENDING_APPROVAL → REJECTED
ACCEPTED/PREPARING → CANCELLED
```
Terminal: `COMPLETED`, `REJECTED`, `CANCELLED`. Transiciones fuera de esta tabla son rechazadas con `400`; una transición que pierde una carrera de concurrencia recibe `409` (o `400` si al momento de reintentar el estado ya cambió de forma incompatible).

## 9. Impresión

Auditado (Fase 9): la impresión es y era 100% manual, del lado del navegador (`window.open` + `window.print()`), sin backend ni impresora física involucrados. Único cambio: el botón queda deshabilitado mientras el pedido está `PENDING_APPROVAL`, para que la cocina nunca vea una comanda de un pedido aún no aceptado.

## 10. Seguridad

- **Autenticación**: sesión opaca (cliente) o `StaffSession` (personal), ambas UUID de 128 bits en tabla DB, nunca JWT firmado del lado del cliente.
- **Autorización**: cada acción sobre un pedido verifica propiedad (cliente) o pertenencia de sucursal (staff, salvo ADMIN) en el backend — nunca en el frontend.
- **Protección IDOR**: `GET /orders/:id` y `.../history` devuelven `404` (no `401/403`) ante cualquier acceso no autorizado, para no confirmar la existencia del recurso.
- **Precios**: siempre recalculados server-side desde `Product`, verificado con test automatizado de manipulación de precio.
- **Hallazgo y corrección durante el hardening**: un token con formato inválido (no-UUID) hacía que Prisma lanzara un error no controlado → `500` en vez de `401`. Corregido validando el formato antes de consultar la DB, en `AuthService` y `StaffAuthService`.

## 11. Pruebas ejecutadas

`backend/test/` (Node test runner nativo, sin dependencias nuevas de testing — compilado con `tsc` real, no `tsx`, porque esbuild no emite los metadatos de decoradores que Nest necesita para inyección de dependencias; lo comprobé de la manera difícil). **20/20 exitosas**, contra PostgreSQL real:

- Seguridad (TREINTA Y SIETE): creación sin/con auth, IDOR cruzado entre clientes, manipulación de precio, sucursal ajena (403 en get/accept/list), token inválido.
- Funcionales (TREINTA Y OCHO): ciclo de vida completo con historial atribuido al staff real, rechazo con/sin motivo, transición inválida, endpoint genérico rechaza `ACCEPTED`/`REJECTED`.
- Concurrencia (TREINTA Y NUEVE): 6 folios simultáneos sin colisión; aceptar-vs-rechazar simultáneo → exactamente un ganador, historial con una sola transición.

`npm run build` y `npm run lint` (backend), `npm run build` (frontend): limpios. Verificación manual adicional en navegador real (Fases 7 y 8): login de personal, pedido nuevo apareciendo en vivo sin recargar, rechazo con motivo, tracking del cliente actualizándose en vivo al aceptar el pedido.

## 12. Despliegue en Coolify

1. **Variables de entorno nuevas** en el servicio backend: `STAFF_BOOTSTRAP_USERNAME`, `STAFF_BOOTSTRAP_PASSWORD`, `STAFF_BOOTSTRAP_NAME` (opcional).
2. El `Dockerfile` se corrigió (build fallaba en producción con `node-gyp ERR! find Python`, un problema preexistente no relacionado con este trabajo): ahora instala `python3 make g++` en Alpine para compilar `argon2` cuando no hay binario prebuilt para musl.
3. `docker-entrypoint.sh` ya corre `prisma migrate deploy` en cada arranque — la migración de este trabajo se aplicará sola, sin pasos manuales.
4. Verificar que el reverse proxy de Coolify permita upgrade de WebSocket en `/api/socket.io` (necesario para Traefik/nginx por defecto, pero conviene confirmarlo explícitamente).
5. Tras el primer deploy, entrar a `BranchOrdersView` con la cuenta creada por bootstrap y, desde ahí (o vía `POST /admin/staff` con `ADMIN_CATALOG_KEY`), crear las cuentas reales del personal de cada sucursal.
