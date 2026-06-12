# Analisis tecnico del proyecto

Fecha del analisis: 2026-06-12  
Ruta analizada: `c:\app\Nueva carpeta (2)`  
Alcance: solo se reviso el codigo existente en este repositorio. No se uso contexto de otros proyectos.

## Resumen ejecutivo

El proyecto compila correctamente y tiene una base funcional para un **menu web de Fatboy** con catalogo, sucursales y administracion basica de productos/categorias. El objetivo correcto del sistema es un **menu web con cuentas de clientes y panel administrador para gestionar pedidos y productos**, no un sistema POS de caja.

La arquitectura real del repositorio es:

- Frontend: React + Vite + TypeScript + Tailwind.
- Backend: NestJS + Prisma + PostgreSQL.
- Datos base: CSV en `base/`.
- Administracion: panel web en `/admin-catalog` protegido por `x-admin-key`.

El proyecto **todavia no esta completo como menu web operativo**. Actualmente tiene catalogo real, pero faltan cuentas reales de clientes, pedidos persistidos, gestion administrativa de pedidos, autenticacion, perfil persistido, recompensas reales y flujo de confirmacion/seguimiento respaldado por backend. La mayor parte de las pantallas de cliente simulan comportamiento con estado local o datos estaticos.

El riesgo principal no es de compilacion, sino de producto: la interfaz aparenta tener login, perfil, puntos, pedidos, pagos, seguimiento y WhatsApp, pero esas areas no estan respaldadas por backend ni base de datos. Si se opera asi en produccion, se pueden perder pedidos, mostrar informacion falsa o permitir administracion con seguridad debil.

## Verificaciones ejecutadas

Comandos ejecutados desde la raiz:

```bash
npm run lint:frontend
npm run lint:backend
npm run build
npm audit --omit=dev
```

Resultado:

- `lint:frontend`: pasa.
- `lint:backend`: pasa.
- `build`: pasa.
- `npm audit --omit=dev`: 0 vulnerabilidades reportadas.

Tamanos observados del build frontend:

- JS principal: aproximadamente `453.92 kB`.
- CSS principal: aproximadamente `60.72 kB`.

No se encontraron scripts ni archivos de pruebas automatizadas (`*.test.*`, `*.spec.*`, Jest, Vitest, Playwright o Cypress).

## Estructura real del proyecto

```text
apps/
  frontend/   React + Vite + Tailwind
  backend/    NestJS + Prisma
base/         CSV de sucursales, categorias y productos
logs/         logs locales
```

Scripts principales en `package.json`:

- `dev`: actualmente solo levanta frontend (`package.json:11`).
- `dev:frontend`: Vite (`package.json:12`).
- `dev:backend`: backend Nest compilado y ejecutado (`package.json:13`, `apps/backend/package.json:7`).
- `build`: frontend + backend (`package.json:14`).
- `lint`: TypeScript en ambos paquetes (`package.json:18`).
- `import:base`: carga CSV al backend (`package.json:17`, `apps/backend/package.json:14`).

## Estado del backend

### Lo que existe

El backend expone endpoints bajo `/api` (`apps/backend/src/main.ts:10`):

- `GET /api/health`
- `GET /api/branches`
- `GET /api/categories`
- `GET /api/products`
- `GET /api/admin/catalog`
- `POST /api/admin/categories`
- `PATCH /api/admin/categories/:id`
- `DELETE /api/admin/categories/:id`
- `POST /api/admin/products`
- `PATCH /api/admin/products/:id`
- `DELETE /api/admin/products/:id`

El modulo principal es catalogo:

- Controlador: `apps/backend/src/modules/catalog/catalog.controller.ts`.
- Servicio: `apps/backend/src/modules/catalog/catalog.service.ts`.
- Prisma service: `apps/backend/src/prisma/prisma.service.ts`.

El esquema Prisma actual solo tiene:

- `Branch` (`apps/backend/prisma/schema.prisma:15`).
- `Category` (`apps/backend/prisma/schema.prisma:24`).
- `Product` (`apps/backend/prisma/schema.prisma:35`).
- `CatalogStatus` (`apps/backend/prisma/schema.prisma:10`).

### Fortalezas

- El catalogo esta centralizado en backend, lo cual respeta la regla de source of truth para productos/categorias.
- Los precios se guardan como `Decimal(10,2)` en Prisma (`apps/backend/prisma/schema.prisma:38`).
- Los productos se devuelven con categoria incluida y ordenados por categoria/orden/nombre.
- La eliminacion de categorias bloquea borrar categorias con productos asociados, evitando romper integridad (`apps/backend/src/modules/catalog/catalog.service.ts:126`).
- La importacion base usa `upsert`, por lo que permite recargar CSV sin duplicar registros.

### Riesgos y fallas posibles

1. **No hay validacion formal con DTOs ni `ValidationPipe`.**  
   El controlador recibe `Body()` como interfaces TypeScript, pero esas interfaces no existen en runtime. La validacion real vive manualmente en el servicio. Funciona para algunos campos, pero no escala bien y deja inconsistencias posibles entre endpoints.

2. **CORS esta abierto a cualquier origen.**  
   `enableCors({ origin: true, credentials: true })` acepta cualquier origen (`apps/backend/src/main.ts:11`). Para un panel administrativo con clave, esto aumenta superficie de ataque.

3. **La seguridad administrativa depende de una clave estatica enviada desde el frontend.**  
   `ADMIN_CATALOG_KEY` se compara directamente con `x-admin-key` (`apps/backend/src/modules/catalog/catalog.controller.ts:111`). No hay usuarios, roles, sesiones, expiracion, auditoria, rate limiting ni bloqueo de intentos.

4. **El `.env.example` raiz esta incompleto.**  
   El `.env.example` raiz no documenta `ADMIN_CATALOG_KEY`, aunque el backend la requiere. El ejemplo correcto si aparece en `apps/backend/.env.example`.

5. **No hay endpoints de pedidos.**  
   El carrito genera un texto de WhatsApp desde el frontend, pero no crea un pedido en backend. No hay tabla `Order`, `OrderItem`, estados, pagos, cliente, sucursal seleccionada persistida ni historial real.

6. **No hay autenticacion real.**  
   No existen modelos de usuario, password hash, JWT, sesiones, refresh tokens ni control de permisos.

7. **No hay realtime.**  
   No hay Socket.IO, gateways o eventos de cambio de pedido/catalogo. Cualquier seguimiento de pedido es simulado.

8. **No hay gestion administrativa de pedidos.**  
   El proyecto necesita un panel para ver pedidos entrantes, cambiar estados, consultar detalle del cliente, sucursal, items y total. Actualmente el admin solo cubre catalogo.

9. **Manejo de errores aun basico.**  
   No hay filtro global de errores, logging estructurado, request id, metricas ni auditoria de operaciones administrativas.

10. **No hay paginacion ni limites en productos.**  
    `listProducts` consulta todos los productos activos o filtrados. Con catalogos grandes, imagenes y busquedas frecuentes, puede degradar.

## Estado del frontend

### Lo que existe

Pantallas principales:

- `HomeView`
- `MenuView`
- `ProductDetailView`
- `CartView`
- `PromosView`
- `BranchesView`
- `AuthView`
- `RegisterView`
- `ProfileView`
- `RewardsView`
- `ChangePasswordView`
- `PaymentMethodsView`
- `OrderTrackingView`
- `AdminCatalogView`

El acceso a API esta centralizado en `apps/frontend/src/lib/api.ts`. Consume:

- `GET /branches`
- `GET /categories?status=active`
- `GET /products?status=active`
- endpoints administrativos de catalogo

### Fortalezas

- La UI esta modularizada por vistas.
- El catalogo y sucursales se cargan desde backend en `MenuView`, `BranchesView` y `CartView`.
- Hay estados basicos de carga/error para menu y sucursales.
- El panel administrativo permite crear/editar/desactivar/eliminar productos y categorias.
- El frontend pasa TypeScript y build.

### Riesgos y fallas posibles

1. **El login no autentica contra backend.**  
   `UserContext` solo cambia `isAuthenticated` en memoria (`apps/frontend/src/context/UserContext.tsx:13`). Al recargar la pagina se pierde. No valida telefono/contraseña ni crea sesion.

2. **Los puntos de fidelidad son locales y manipulables.**  
   `points` inicia en `450` dentro del frontend (`apps/frontend/src/context/UserContext.tsx:15`) y `redeemPoints` solo descuenta localmente (`apps/frontend/src/context/UserContext.tsx:25`). No hay backend, historial ni validacion.

3. **El carrito vive solo en memoria.**  
   `CartContext` usa `useState` y genera `cartId` con `Math.random()` (`apps/frontend/src/context/CartContext.tsx:30`). Si el usuario recarga, pierde el carrito.

4. **Generar pedido no genera pedido real.**  
   `CartView` arma un mensaje de WhatsApp con cliente hardcodeado (`apps/frontend/src/views/CartView.tsx:51`) y abre `wa.me` (`apps/frontend/src/views/CartView.tsx:66`). Despues limpia el carrito y navega a seguimiento aunque no hay confirmacion del negocio.

5. **Datos de cliente hardcodeados.**  
   En carrito y perfil aparece `Juan Perez` y telefonos fijos (`apps/frontend/src/views/CartView.tsx:51`, `apps/frontend/src/views/ProfileView.tsx:28`).

6. **Promociones hardcodeadas.**  
   `PromosView` declara promociones en el componente (`apps/frontend/src/views/PromosView.tsx:11`) en vez de usar productos `isPromotion` del backend.

7. **Extras y modificaciones hardcodeados.**  
   `ProductDetailView` define extras y removals dentro del componente (`apps/frontend/src/views/ProductDetailView.tsx:23`, `apps/frontend/src/views/ProductDetailView.tsx:30`). Esto duplica logica de negocio en frontend.

8. **Seguimiento de pedido simulado.**  
   `OrderTrackingView` tiene pasos y tiempos estaticos (`apps/frontend/src/views/OrderTrackingView.tsx:11`). No consulta backend ni realtime.

9. **Metodos de pago simulados.**  
   `PaymentMethodsView` define tarjetas/efectivo locales (`apps/frontend/src/views/PaymentMethodsView.tsx:14`). No hay persistencia ni proveedor.

10. **Navegacion manual por estado.**  
    `App.tsx` usa `currentView` y `window.location.pathname === '/admin-catalog'`. No hay router real, rutas compartibles, deep links ni proteccion formal.

11. **Botones sin accion real.**  
    En `TopBar`, menu y campana no ejecutan nada util. En sucursales, `LLAMAR` y `COMO LLEGAR` son botones visuales sin accion real.

12. **Dependencias frontend posiblemente innecesarias.**  
    En `apps/frontend/package.json` aparecen `@google/genai`, `@vis.gl/react-google-maps`, `dotenv`, `express` y `@types/express`, pero no se usan en `src/`. Esto aumenta peso, mantenimiento y superficie de instalacion.

13. **El script `clean` no es portable para Windows puro.**  
    `apps/frontend/package.json:10` usa `rm -rf`, que puede fallar en PowerShell sin herramientas Unix.

14. **`allowJs` esta activo en TypeScript frontend.**  
    `apps/frontend/tsconfig.json:16` permite JS. Para un menu web TypeScript con cuentas y administracion, conviene desactivarlo cuando no sea necesario para mantener rigor.

## Faltantes principales para ser menu web operativo

### Backend / base de datos

Faltan modelos y endpoints para:

- Usuarios/clientes.
- Autenticacion.
- Roles/permisos.
- Pedidos.
- Items de pedido.
- Modificadores/extras.
- Promociones administrables.
- Direcciones o datos de entrega.
- Sucursales con direccion, horario, coordenadas y telefono operativo.
- Estados de pedido.
- Pagos/metodos de pago.
- Recompensas/puntos.
- Historial de compras.
- Auditoria administrativa.
- Configuracion de negocio.
- Panel administrativo de pedidos.

### Fuera de alcance para este proyecto

Por la definicion actual del proyecto, estas areas no deben tratarse como faltantes obligatorios:

- Caja.
- Turnos/cortes.
- Movimientos de efectivo.
- Impresion de tickets.
- Apertura de cajon.
- Electron.
- IPC frontend/Electron/backend.
- Servicio Windows.

Solo haria falta realtime si se desea que el panel admin reciba pedidos nuevos o cambios de estado sin refrescar manualmente.
- Manejo offline o recuperacion ante caida de red.

### Calidad / pruebas

Falta:

- Tests unitarios backend para `CatalogService`.
- Tests de integracion para endpoints de catalogo/admin.
- Tests frontend para flujos principales.
- Pruebas e2e del menu: cargar catalogo, agregar carrito, seleccionar sucursal, generar pedido.
- Validacion visual responsive.
- Pipeline CI.

## Prioridades recomendadas

### Prioridad 1: cerrar brecha entre UI aparente y backend real

1. Crear backend real de pedidos:
   - `Order`
   - `OrderItem`
   - `OrderModifier`
   - `OrderStatus`
   - sucursal
   - cliente
   - total calculado en backend

2. Cambiar `CartView` para enviar el carrito al backend antes de abrir WhatsApp.

3. El backend debe calcular totales, validar productos activos, validar precios y guardar snapshot del pedido.

4. El seguimiento debe consultar el pedido real por id.

### Prioridad 2: autenticacion y seguridad administrativa

1. Reemplazar `x-admin-key` por login real con roles.
2. Agregar `ValidationPipe`, DTOs y validadores.
3. Restringir CORS por `FRONTEND_ORIGIN`.
4. Agregar rate limiting para login/admin.
5. Agregar auditoria de cambios de catalogo.

### Prioridad 3: mover logica de negocio fuera del frontend

1. Promociones desde backend, usando `isPromotion` o una entidad `Promotion`.
2. Extras/modificadores desde backend.
3. Puntos/recompensas desde backend.
4. Datos de cliente desde backend.
5. Sucursales completas desde backend: direccion, horario, coordenadas, telefono, URL de mapas.

### Prioridad 4: estabilizar experiencia de usuario

1. Persistir carrito en backend o al menos en storage temporal con versionado.
2. Agregar router real.
3. Manejar errores con mensajes diferenciados: backend apagado, sin internet, 401, 409, 500.
4. Desactivar acciones cuando faltan datos criticos.
5. Conectar botones visuales que hoy no hacen nada.

### Prioridad 5: calidad y mantenimiento

1. Agregar pruebas automatizadas.
2. Limpiar dependencias no usadas.
3. Cambiar `clean` por comando portable.
4. Separar DTOs, validadores y tipos compartidos.
5. Agregar logging estructurado en backend.
6. Agregar paginacion/busqueda controlada en catalogo admin.

## Observaciones especificas de arquitectura

### Source of truth

El catalogo si empieza correctamente: productos y categorias vienen de backend en `MenuView`. Pero el frontend todavia contiene reglas de negocio importantes:

- Extras y removals.
- Calculo de subtotal.
- Redencion de puntos.
- Generacion de pedido.
- Datos de usuario.
- Estados de pedido.
- Promociones.

Para este menu web, eso debe moverse al backend o convertirse en datos configurables administrados por backend.

### Alcance correcto del producto

El repositorio corresponde a un **menu web con cuentas de clientes y administracion**, no a un POS. El foco tecnico debe quedar asi:

- Catalogo publico de productos y promociones.
- Cuentas de clientes.
- Carrito y pedido persistido.
- Seguimiento de pedido.
- Panel administrador para productos, categorias y pedidos.
- Notificacion o envio controlado por backend, incluyendo WhatsApp si se mantiene ese canal.

### Datos base

Los CSV tienen:

- `products_rows.csv`: 216 registros de datos + encabezado.
- `categories_rows.csv`: 10 registros de datos + encabezado.
- `branches_rows.csv`: 2 registros de datos + encabezado.

La importacion es util para arrancar, pero falta una estrategia de migracion/seed/versionado para produccion.

## Riesgos de produccion si se publica asi

- Pedidos pueden perderse porque no se guardan en backend.
- El seguimiento de pedido puede mostrar estados falsos.
- El usuario puede creer que inicio sesion aunque no existe autenticacion real.
- Los puntos pueden manipularse desde el navegador.
- La clave admin puede quedar expuesta o compartida sin trazabilidad.
- CORS abierto permite llamadas desde cualquier origen.
- No hay auditoria para cambios de catalogo.
- No hay pruebas que protejan flujos criticos.
- Las pantallas de pagos y perfil pueden generar confianza incorrecta al usuario.

## Checklist de mejora inmediata

- [ ] Agregar DTOs y `ValidationPipe` en NestJS.
- [ ] Restringir CORS con variable `FRONTEND_ORIGIN`.
- [ ] Documentar `ADMIN_CATALOG_KEY` en `.env.example` raiz o eliminar el ejemplo raiz duplicado.
- [ ] Crear entidad `Order` y endpoint `POST /api/orders`.
- [ ] Hacer que `CartView` cree pedido real antes de abrir WhatsApp.
- [ ] Mover extras/modificadores a backend.
- [ ] Hacer que `PromosView` use productos `isPromotion`.
- [ ] Implementar autenticacion real o quitar pantallas que simulan cuenta hasta tener backend.
- [ ] Agregar tests de backend para catalogo.
- [ ] Limpiar dependencias frontend no usadas.
- [ ] Reemplazar `rm -rf` por comando portable.

## Conclusion

El codigo actual es una buena base para un menu web administrable, con compilacion limpia y catalogo backend funcional. Lo que falta es convertir las pantallas simuladas en flujos reales respaldados por base de datos y asegurar el panel administrativo.

La recomendacion tecnica es no seguir agregando UI nueva hasta cerrar el flujo minimo real del menu web:

1. catalogo real,
2. carrito,
3. pedido persistido,
4. sucursal,
5. cliente,
6. confirmacion/seguimiento real,
7. administracion segura.

Despues de eso conviene completar el panel administrador de pedidos, recompensas y perfil del cliente.
