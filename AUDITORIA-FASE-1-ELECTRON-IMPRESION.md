# Auditoría — Fase 1: Electron e impresión térmica para Fatboy Pedidos

Fecha: 2026-08-19  
Alcance: auditoría técnica, definición de arquitectura y línea base. En esta fase no se modifica el flujo de pedidos ni se instala Electron.

## 1. Resultado ejecutivo

La aplicación que debe convertirse en escritorio es `frontend-pedidos`. Ya es una aplicación operativa independiente del menú público y ya contiene sesión de personal, alcance por sucursal, tablero, historial, alertas, Socket.IO y una impresión manual básica.

La solución recomendada es agregar una capa Electron dentro de ese mismo workspace y reutilizar el mismo React. La PWA web debe seguir funcionando; Electron será otro destino de compilación, no otro panel de pedidos.

No se recomienda cargar la URL pública dentro de Electron. El instalador debe incluir los archivos compilados de React y conectarse directamente al backend configurado. Así la apertura de la aplicación no depende del servidor nginx del frontend.

## 2. Inventario confirmado

| Área | Implementación actual | Evaluación para Electron |
|---|---|---|
| Aplicación operativa | `frontend-pedidos`, React 19, Vite 6 y TypeScript | Reutilizable |
| Sesión | `StaffSession`, token persistido y validado con `/staff/me` | Reutilizable; nunca exponer una clave administrativa |
| Sucursal | STAFF/MANAGER fijados por backend; ADMIN puede seleccionar | Reutilizable |
| Pedidos activos | Consulta `/admin/orders` filtrada por sucursal y estados activos | Reutilizable |
| Tiempo real | Socket.IO autenticado; eventos `order.created` y `order.status_changed` | Reutilizable como señal, conservando refetch HTTP |
| Respaldo | Poll de seguridad además del socket | Reutilizable |
| Estados | `PENDING_APPROVAL → ACCEPTED → PREPARING → READY → COMPLETED`, con terminales `REJECTED` y `CANCELLED` | El backend continúa como autoridad |
| Historial | Paginado y filtrado en servidor | Reutilizable |
| Impresión | HTML en una ventana nueva, `window.print()`, ancho fijo de 80 mm | Debe reemplazarse para escritorio |
| PWA | Manifest, service worker e instalación web | Debe conservarse para navegador y desactivarse dentro de Electron |
| Electron/ESC-POS | No hay dependencias, procesos, IPC, instalador ni configuración | Trabajo nuevo |

## 3. Flujo real encontrado

1. El cliente autenticado crea el pedido en el backend.
2. El backend confirma la transacción y emite `order.created` a la sala `branch:{branchId}`.
3. `frontend-pedidos` recibe el evento y vuelve a consultar la API por HTTP.
4. La API limita al operador a su sucursal.
5. El tablero reproduce una alerta únicamente para pedidos pendientes vistos por primera vez.
6. El operador abre el pedido y actualmente puede imprimirlo manualmente mediante el diálogo del navegador.

Este diseño ya resuelve correctamente la autoridad y privacidad. Electron no debe cambiar la máquina de estados ni confiar en un pedido completo recibido por socket.

## 4. Brechas para impresión automática

### 4.1 Impresión actual

`frontend-pedidos/src/lib/printOrder.ts`:

- abre una ventana nueva;
- interpola los datos del pedido como HTML;
- llama a `window.print()`;
- fija el formato a 80 mm;
- no permite seleccionar impresora;
- no confirma el resultado del spooler;
- no guarda intentos ni errores;
- no evita duplicados de impresión;
- no escapa de forma explícita todos los textos insertados en el HTML.

Por lo tanto, esta función sirve como referencia visual del ticket, pero no como motor de impresión automática.

### 4.2 Persistencia e idempotencia

El esquema no contiene trabajos ni recibos de impresión. Tampoco existen `printedAt`, `printStatus`, número de intentos o estación responsable.

Una cola exclusivamente local puede evitar duplicados en una computadora, pero no puede coordinar una reinstalación o dos receptores de la misma sucursal. Para una operación confiable se recomienda una cola persistente con identidad de estación y una llave única por pedido, tipo de documento y destino.

La confirmación del spooler significa "trabajo aceptado por Windows", no garantiza que físicamente salió papel. La interfaz debe distinguir entre enviado, error y resultado incierto; nunca prometer impresión exactamente una vez cuando el hardware no puede confirmarlo.

### 4.3 Datos faltantes

El pedido guarda `deliveryType`, pero no guarda una dirección de entrega como fotografía inmutable del momento de compra. El ticket actual tampoco puede imprimirla.

Si la modalidad `delivery` está activa, antes de automatizar esos tickets debe definirse y persistirse la dirección por pedido. Leer después la dirección actual del perfil del cliente sería incorrecto, porque puede cambiar después de realizar la compra.

### 4.4 Cobertura de pruebas

El backend tiene pruebas del ciclo y la autorización de pedidos. No se encontraron pruebas automatizadas para:

- generación del ticket;
- escape de contenido;
- conexión y reconexión del socket de la app operativa;
- deduplicación de alertas;
- selección de impresora;
- cola, reintentos o recuperación después de un reinicio.

## 5. Arquitectura objetivo aprobada para desarrollo

```text
Backend NestJS/PostgreSQL
  ├─ autoridad de pedido, sucursal y estados
  ├─ Socket.IO como aviso
  └─ contrato persistente de trabajos/recibos de impresión
                 │
                 ▼
frontend-pedidos empaquetado con Electron
  ├─ renderer React existente
  ├─ preload con API mínima y tipada
  └─ proceso principal
       ├─ descubrimiento de impresoras de Windows
       ├─ configuración local por estación
       ├─ cola durable
       ├─ impresión silenciosa
       └─ logs y recuperación
                 │
                 ▼
Spooler de Windows → impresora térmica USB o de red
```

## 6. Decisiones técnicas

1. **Un solo frontend operativo.** Electron se agrega dentro de `frontend-pedidos`; no se crea otra SPA.
2. **Renderer local.** Electron carga el build incluido en el instalador y utiliza la URL del backend por configuración.
3. **Seguridad de Electron.** `nodeIntegration: false`, `contextIsolation: true`, sandbox habilitado y un `preload` con operaciones explícitas.
4. **Sin secretos administrativos.** La aplicación continúa usando exclusivamente `StaffSession` y el alcance de sucursal del backend.
5. **Impresión abstraída.** React solicita imprimir mediante una interfaz; solo el proceso principal conoce Electron y las impresoras.
6. **Primer adaptador: spooler de Windows.** Se recomienda comenzar con `webContents.print({ silent: true, deviceName })`, porque funciona con impresoras USB o de red instaladas y evita dependencias nativas prematuras.
7. **ESC/POS como adaptador adicional.** Se agregará únicamente cuando se conozcan marca, modelo, conexión y necesidad real de corte/cajón/comandos crudos.
8. **Papel configurable.** Perfiles de 58 mm y 80 mm; nunca un ancho fijo dentro del ticket.
9. **Reimpresión separada.** La reimpresión siempre es una acción manual, visible y auditada; no debe confundirse con el primer intento automático.
10. **La aceptación del pedido no depende de imprimir.** Un fallo de impresora no debe alterar automáticamente el estado comercial del pedido.

## 7. Estructura propuesta

```text
frontend-pedidos/
  electron/
    main.ts
    preload.ts
    printing/
      printer-service.ts
      print-queue.ts
      ticket-renderer.ts
  src/
    desktop/
      desktop-bridge.ts
      desktop-types.ts
    lib/
      printOrder.ts        # fachada web/escritorio
  package.json             # scripts web y desktop
```

La ubicación puede ajustarse a la herramienta de empaquetado elegida, pero la separación entre React, `preload` y proceso principal es obligatoria.

## 8. Siguiente fase recomendada

La Fase 2 debe entregar un corte vertical pequeño y verificable:

1. Agregar el proceso principal y `preload` de Electron a `frontend-pedidos`.
2. Mantener funcionando el build web/PWA existente.
3. Listar impresoras instaladas mediante Electron.
4. Guardar una impresora y ancho de papel por estación.
5. Generar el ticket con datos escapados.
6. Imprimir manualmente y de forma silenciosa un pedido real o fixture controlado.
7. Mostrar éxito o error del spooler en la interfaz.
8. Agregar pruebas unitarias del formateo y del contrato IPC.

La impresión automática, la cola durable y el contrato backend se incorporan después de validar esa impresión manual con el modelo físico de impresora. Esto reduce el riesgo de construir reintentos sobre un adaptador que todavía no se ha comprobado con el hardware de sucursal.

## 9. Criterios de salida de la Fase 1

- [x] Aplicación operativa correcta identificada.
- [x] Flujo de pedidos y autoridad del backend documentados.
- [x] Socket, sesión y alcance por sucursal revisados.
- [x] Impresión actual y brechas identificadas.
- [x] Ausencia de Electron, cola y campos de impresión confirmada.
- [x] Riesgo de dirección faltante para entrega documentado.
- [x] Arquitectura objetivo definida.
- [x] Alcance de la Fase 2 definido.
- [x] Línea base local validada.

## 10. Línea base local verificada

Ejecutado el 2026-08-19:

- `npm run lint:pedidos`: correcto.
- `npm run build:pedidos`: correcto.
- `npm --prefix backend test`: 34 pruebas aprobadas, 0 fallidas.
- Estado de Git antes de la documentación: limpio.

Estas verificaciones son locales. No demuestran instalación en Windows, impresión física ni despliegue en sucursales.

## 11. Datos operativos que deben registrarse antes de cerrar la Fase 2

- Marca y modelo de la impresora de la sucursal piloto.
- Conexión: USB, Ethernet/Wi-Fi o impresora compartida de Windows.
- Ancho real: 58 mm u 80 mm.
- Si se requiere corte automático, cajón de dinero o logo rasterizado.
- Cantidad de copias y destinos: recepción, cocina o ambos.
- Si habrá una o varias computadoras receptoras por sucursal.

## 12. Estado de implementación de la Fase 2

Implementada el 2026-08-19:

- Electron integrado dentro de `frontend-pedidos`, sin crear otra SPA.
- Renderer local mediante el protocolo seguro `fatboy://`.
- `nodeIntegration` desactivado, aislamiento de contexto y sandbox activos.
- `preload` limitado a cinco operaciones explícitas de impresión.
- Validación de todos los datos recibidos por IPC.
- Consulta de impresoras instaladas mediante Electron.
- Configuración local de impresora y papel de 58/80 mm.
- Ticket de prueba e impresión manual silenciosa desde pedidos activos e historial.
- Formato térmico compartido con la versión web y escape de contenido controlado por clientes.
- Service worker e indicador de instalación PWA desactivados dentro de Electron.
- Scripts de desarrollo, compilación y empaquetado para Windows.
- Pruebas unitarias del ticket y del contrato de impresión.

Verificación local:

- TypeScript: correcto.
- Pruebas de Pedidos: 8 aprobadas.
- Build web: correcto.
- Build Electron: correcto.
- Arranque directo de Electron: correcto.
- Arranque de la aplicación Windows empaquetada: correcto.

El empaquetador alcanzó y creó `win-unpacked`, pero la protección del entorno bloqueó la modificación final del ejecutable para insertar la integridad ASAR. La configuración está preparada; el instalador NSIS debe generarse nuevamente en una estación donde el antivirus no bloquee temporalmente el ejecutable. Esto no sustituye la prueba física con la impresora de la sucursal piloto.

## 13. Aceptación automática por sucursal

Implementada el 2026-08-19:

- Configuración independiente por sucursal en cada equipo Electron.
- Selector persistente para habilitar o deshabilitar la aceptación automática.
- Impresora y ancho de papel guardados junto con la sucursal correspondiente.
- El pedido sólo se imprime cuando el backend confirma el estado `ACCEPTED`.
- Una carrera entre dos equipos no acepta dos veces el mismo pedido.
- La cola local de esta primera entrega fue sustituida en la Fase 3 por una cola durable en el backend.
- El formato anterior de configuración de impresora se conserva como migración compatible y comienza con la automatización deshabilitada.
- El formulario de impresión se renderiza mediante un portal centrado en la ventana, con altura máxima y desplazamiento interno para evitar texto cortado.
- El backend agrega `fatboy://app` a CORS para HTTP y Socket.IO, conservando los orígenes web configurados.

La automatización necesita una sesión de personal vigente, conexión al backend y una impresora disponible. La configuración es local al equipo y está separada por sucursal; no altera automáticamente otros receptores instalados.

## 14. Estado de implementación de la Fase 3

Implementada localmente el 2026-08-19:

- La aceptación automática crea el trabajo de producción dentro de la misma transacción que cambia el pedido a `ACCEPTED`.
- La cola vive en PostgreSQL y está segmentada por sucursal; reinstalar o reiniciar Electron no pierde trabajos pendientes.
- Cada instalación Electron conserva una identidad UUID y el nombre de la computadora para reclamar trabajos y dejar trazabilidad.
- Estados explícitos: `PENDING`, `CLAIMED`, `PRINTING`, `PRINTED`, `FAILED` y `UNCERTAIN`.
- Dos estaciones pueden permanecer activas: una actualización condicional permite que sólo una reclame cada trabajo.
- Los trabajos fallidos se pueden reintentar; el historial reciente y la recuperación manual aparecen en Configuración de impresora.
- Si Windows recibió el ticket pero se perdió la confirmación al backend, el trabajo pasa a `UNCERTAIN` al vencer su lease y nunca se reimprime automáticamente. El operador debe verificar el papel antes de pulsar Reintentar.
- El acceso continúa protegido por `StaffSession` y por el alcance de sucursal del personal.
- Se agregó una migración Prisma aditiva y pruebas de aceptación, exclusión entre estaciones, alcance de sucursal, ciclo completo, error/recuperación y resultado incierto.

Verificación local:

- Prisma validate y migración sobre la base local: correctos.
- Backend: 41 pruebas aprobadas, 0 fallidas.
- Fatboy Pedidos: 13 pruebas aprobadas, 0 fallidas.
- TypeScript y builds web/backend/Electron: correctos.

Antes de liberar esta versión se debe aplicar la migración del backend y desplegar backend + Electron como una sola actualización coordinada. La validación local no sustituye una prueba física de corte, ancho y legibilidad con la impresora térmica de cada sucursal.
