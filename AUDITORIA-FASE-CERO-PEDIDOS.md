# Auditoría — Fase cero: Fatboy Pedidos

Auditoría previa a la implementación del [plan](<Plan de implementación — Fatboy Pedidos, aplicación operativa complementaria .md>). No se modificó código. Objetivo: documentar qué existe y qué puede reutilizarse directamente para la nueva app `Fatboy Pedidos`.

## 1. Estructura actual del repositorio

Monorepo con **npm workspaces** (`frontend`, `backend`), no un monorepo con herramientas tipo Turborepo/Nx:

```
menufatboy2026/
  frontend/   React 19 + Vite 6 + TypeScript + Tailwind 4
  backend/    NestJS + Prisma + PostgreSQL
  docker-compose.yml   (postgres + backend + frontend, 1 solo servicio frontend)
  Dockerfile           (root, multi-stage — commit reciente "add multi-stage Dockerfile for backend")
```

No hay separación física `apps/menu` + `apps/pedidos` todavía. Siguiendo la regla del plan ("no migrar a monorepo por estética"), lo más simple es **agregar `frontend-pedidos/` como tercer workspace hermano de `frontend/`**, apuntando al mismo `backend/`. Cambio de mínimo riesgo: no toca `frontend/` ni `backend/` existentes.

## 2. `BranchOrdersView` — qué hace hoy y qué es reutilizable

Vive en [BranchOrdersView.tsx](frontend/src/views/BranchOrdersView.tsx) (836 líneas), montada en `App.tsx` vía un chequeo simple de `window.location.pathname === '/branch-orders'` — **no hay React Router** en el proyecto; el "ruteo" es manual con `useState` + `pathname`. Para la nueva app esto no importa (será un proyecto Vite standalone), pero confirma que no hay que migrar ninguna dependencia de router.

Ya implementa correctamente casi todo el Fase-uno-a-cuatro del plan:

- Login de `Staff` (usuario/contraseña) → guarda token en `sessionStorage['fatboy-staff-token']`.
- Restaura sesión con `getStaffMe(token)`.
- ADMIN puede elegir sucursal por `<select>`; STAFF/MANAGER quedan fijos a `staff.branchId` (coincide con Sección Seis del plan).
- Sincronización: socket como señal de "algo cambió" + refetch HTTP siempre — nunca confía en el payload del evento (coincide con Sección Nueve/Dieciocho).
- Poll de seguridad cada 30s como red de respaldo si se pierde un evento.
- Sonido de alerta con WebAudio (sin asset externo) para pedidos nuevos, evitando bloqueo de autoplay (coincide con Sección Nueve).
- Tarjetas de pedido agrupadas: Recepción/nuevos, Preparación/entrega, Listos — más pestaña "Finalizados" (histórico) y "Canjes".
- Modal de rechazo con motivo obligatorio (textarea libre, no las opciones predefinidas del mockup del plan — detalle de UX a decidir, no bloqueante).
- Aprobar/rechazar solicitudes de cancelación iniciadas por el cliente.
- Impresión vía `window.open` + `window.print()`, deshabilitada mientras el pedido está en `PENDING_APPROVAL` (coincide exactamente con Sección Diecisiete).
- Manejo de conflicto: cualquier error de acción dispara refetch inmediato (cubre el 409 de concurrencia, Sección Veintitrés), aunque hoy no distingue el mensaje "actualizado desde otro dispositivo" de un error genérico — ajuste menor a hacer en la nueva app.

**Pieza fuera de alcance mezclada ahí:** la pestaña "Canjes" (`redemptions`) no usa `StaffSession`, usa la clave compartida `ADMIN_CATALOG_KEY` (`sessionStorage['fatboy-admin-key']`). El plan es explícito: Fatboy Pedidos no debe usar `ADMIN_CATALOG_KEY` ni ser un admin de catálogo. **Esta pestaña no debe migrarse** a Fatboy Pedidos — es dominio de `AdminCatalogView`, que ya tiene su propia vista de canjes.

## 3. Backend — endpoints y servicios ya construidos (reutilizables tal cual)

`OrderController` ([order.controller.ts](backend/src/modules/order/order.controller.ts)) ya expone todo lo que el plan pide, con seguridad server-side real (no cosmética):

| Endpoint | Uso en Fatboy Pedidos |
|---|---|
| `POST /api/staff/login` | Login de personal |
| `POST /api/staff/logout` | Logout |
| `GET /api/staff/me` | Identidad/rol/sucursal tras login (`staff.controller.ts`, no listado arriba pero usado por `getStaffMe`) |
| `GET /api/admin/orders?branchId&limit&cursor` | Tablero de pedidos — autoscopeado a la sucursal del `StaffSession` si no se manda `x-admin-key` |
| `GET /api/orders/:id` / `.../history` | Detalle + auditoría, exige ser dueño o staff de la sucursal (404 si no) |
| `POST /api/orders/:id/accept` | `PENDING_APPROVAL → ACCEPTED` |
| `POST /api/orders/:id/reject` (body `reason`) | `PENDING_APPROVAL → REJECTED`, motivo obligatorio server-side |
| `PATCH /api/orders/:id/status` (body `status`) | Resto de la máquina (`PREPARING`, `READY`, `COMPLETED`, `CANCELLED`) |
| `POST /api/orders/:id/cancellation/approve` \| `/reject` | Resolución de cancelaciones solicitadas por cliente |

`assertBranchAccess` y `resolveBranchScope` (privados en el controller) ya implementan exactamente la regla de la Sección Veinticuatro: un STAFF/MANAGER nunca puede leer ni escribir pedidos de otra sucursal, sin importar qué mande el cliente. **No hay nada que tocar en el backend para la v1** salvo, potencialmente, CORS (ver §5).

Máquina de estados y auditoría (`OrderService.transitionOrder`, `OrderStatusHistory`) ya existen, con locking optimista (`updateMany` condicionado) que devuelve 409 en conflicto — exactamente lo que pide la Sección Veintitrés.

## 4. Socket.IO

`OrdersGateway` ([orders.gateway.ts](backend/src/modules/order/orders.gateway.ts)):

- Path fijo: `/api/socket.io`.
- Auth vía middleware `server.use` (antes de aceptar conexión) — token igual al de HTTP (`Session` o `StaffSession`), pasado en `handshake.auth.token`.
- Rooms: `user:{customerId}` (clientes) y `branch:{branchId}` (staff, automático si tiene sucursal fija; ADMIN se une manualmente con el evento `branch:watch`).
- Eventos emitidos: `order.created` y `order.status_changed`, **solo con `{orderId, branchId, status?}`** — nunca el pedido completo. Coincide exactamente con la Sección Nueve/Dieciocho del plan ("no transportar todo el pedido por socket").

Cliente ya tiene un wrapper listo: [socket.ts](frontend/src/lib/socket.ts) (`connectOrdersSocket(token)`), 26 líneas, sin dependencias del menú público — **copiable literal** al nuevo proyecto.

## 5. Configuración: CORS, Vite, entorno

- **CORS** ([cors.ts](backend/src/lib/cors.ts)): si `CORS_ORIGIN` no está seteado, el default solo permite `localhost:8371/5173`. En producción el `.env` actual trae `CORS_ORIGIN=https://menu.fatboymexicali.com` (un solo origen). **Acción pendiente para Fase uno/diez**: agregar `https://pedidos.fatboymexicali.com` a esa lista (formato coma-separado, ya soportado por `resolveCorsOrigin`) — el gateway de sockets reutiliza la misma función, así que un solo cambio de env cubre HTTP y WebSocket.
- **Vite** ([vite.config.ts](frontend/vite.config.ts)): proxy de dev `/api → http://localhost:8372` con `ws: true` (cubre el upgrade de WebSocket en dev). El nuevo proyecto de Vite necesitará la misma config, apuntando al mismo backend local.
- **`API_BASE_URL`** en `frontend/src/lib/api.ts` lee `VITE_API_BASE_URL` con fallback a `/api` — mismo patrón a reutilizar en `frontend-pedidos`, con su propio `.env` apuntando a la URL pública del backend en producción.

## 6. Despliegue (Docker / Coolify)

`docker-compose.yml` actual define 3 servicios: `postgres`, `backend`, `frontend` (nginx sirviendo el build de Vite, puerto `8371:80`). No hay servicio para una segunda SPA todavía.

Para Fase diez del plan, el patrón es agregar un cuarto servicio (`frontend-pedidos`) con su propio `Dockerfile` (mismo patrón: build Vite → nginx), su propio dominio en Coolify (`pedidos.fatboymexicali.com`) y su propia variable `VITE_API_BASE_URL`/`VITE_SOCKET_URL` de build. `backend` y `postgres` no cambian.

## 7. Sesión persistente (Sección Veintiocho del plan)

Detalle a decidir antes de Fase uno: `BranchOrdersView` guarda el token en **`sessionStorage`**, que se borra al cerrar la pestaña/navegador. El plan pide para Fatboy Pedidos "evitar que el empleado tenga que iniciar sesión constantemente" en una tablet instalada como PWA. `StaffSession` en backend ya dura 14h (`SESSION_HOURS`, pensado como "un turno completo") — adecuado. Lo que hay que cambiar **en el frontend nuevo** es usar `localStorage` en vez de `sessionStorage` para que la sesión sobreviva a que la PWA se cierre y reabra dentro de esas 14h. No requiere tocar el backend.

## 8. PWA — base reutilizable

El menú público ya tiene `manifest.webmanifest` + `sw.js` + set de íconos en `frontend/public/`. Fatboy Pedidos necesitará su propio manifest (nombre "Fatboy Pedidos", `start_url`/`scope` distintos, íconos propios para no confundirse con el menú en la pantalla de la tablet) pero puede copiar el patrón (`display: standalone` en vez de `fullscreen` ya que es una app de trabajo, no un menú de cliente) y el `sw.js` existente como punto de partida.

## 9. Piezas de UI reutilizables literalmente

- `components/ui/Button.tsx`, `components/ui/Input.tsx`, `lib/utils.ts` (`cn`).
- Tipos y constantes de `lib/api.ts`: `Order`, `OrderStatus`, `OrderStatusHistoryEntry`, `Staff`, `Branch`, `ORDER_STATUS_LABELS_ES`, y las funciones `staffLogin/staffLogout/getStaffMe/getAdminOrders/acceptOrder/rejectOrder/updateOrderStatus/approveCancellation/rejectCancellation`.
- La lógica interna de `BranchOrdersView` (agrupación por estado, `orderAge`, `parseJsonList` para extras/removals, `playNewOrderChime`, el HTML de impresión) es portable casi sin cambios — es la base de la Fase dos ("no copiar ciegamente, extraer y adaptar").

## 10. Conclusión — qué NO hay que reconstruir

Confirmado: **todo el motor** (folios, máquina de estados, `OrderStatusHistory`, `StaffSession`, autorización por sucursal, Socket.IO con rooms, locking optimista con 409) ya existe, ya es correcto y ya está probado (`INFORME-PEDIDOS.md` documenta la implementación previa + tests). El trabajo real de Fatboy Pedidos es 100% frontend:

1. Nuevo workspace `frontend-pedidos/` (Vite+React+TS), reutilizando `lib/api.ts` (recortado, sin todo lo de catálogo/admin) y `lib/socket.ts` tal cual.
2. UI operacional nueva (Sección Siete del plan) en vez de las 3 columnas actuales de `BranchOrdersView` — se puede tomar como referencia, no copiar entero.
3. `localStorage` en vez de `sessionStorage` para sesión persistente de tablet.
4. Motivo de rechazo con opciones predefinidas + "Otro" (hoy es solo texto libre).
5. Mensaje específico de conflicto 409 ("El pedido ya fue actualizado desde otro dispositivo") en vez de error genérico.
6. Manifest/PWA propio.
7. `CORS_ORIGIN` en backend: agregar el dominio de Pedidos.
8. Nuevo servicio Docker/Coolify + dominio `pedidos.fatboymexicali.com`.

No se requiere ningún cambio en `backend/` para que la v1 funcione — es consumidor puro de la API existente, tal como exige la Sección Treinta y ocho ("no un nuevo motor de pedidos").
