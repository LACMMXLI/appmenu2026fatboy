# CONTEXTO DEL PROYECTO

Estás trabajando sobre un proyecto existente llamado `menufatboy2026`.

No estás creando una aplicación desde cero.

El sistema actualmente funciona como un menú digital web de Fatboy desde el cual los clientes registrados pueden consultar el catálogo, iniciar sesión, agregar productos al carrito y realizar pedidos.

El proyecto tiene aproximadamente esta arquitectura:

## Frontend

- React
- Vite
- TypeScript
- Tailwind CSS

## Backend

- NestJS
- Prisma ORM
- PostgreSQL

## Infraestructura

- Docker
- Coolify

El proyecto ya contiene módulos relacionados con:

- autenticación;
- usuarios/clientes;
- catálogo;
- carrito;
- pedidos;
- seguimiento de pedidos;
- administración de pedidos por sucursal;
- encuestas;
- administración del catálogo;
- posiblemente impresión de comandas/tickets.

Debes trabajar sobre la arquitectura existente.

NO reconstruyas funcionalidades que ya existen.

NO conviertas este proyecto en un POS.

NO construyas un KDS nuevo.

El POS utilizado por el negocio es un sistema independiente.

El KDS utilizado por cocina también pertenece a un sistema externo/independiente.

Esta implementación corresponde exclusivamente al menú digital y su sistema administrativo de pedidos.

---

# OBJETIVO GENERAL

Queremos convertir el flujo actual de pedidos del menú digital en un sistema robusto de:

- creación de órdenes;
- identificación mediante folio;
- recepción por sucursal;
- aprobación o rechazo;
- seguimiento;
- cambios de estado;
- actualización en tiempo real;
- trazabilidad;
- historial;
- auditoría.

El cliente deberá poder realizar un pedido y posteriormente seguir todo su progreso desde su cuenta.

La sucursal deberá recibir el pedido automáticamente y decidir si lo acepta o rechaza.

Después de ser aceptado, el pedido podrá avanzar por diferentes estados hasta ser entregado.

Todos los cambios deberán quedar registrados históricamente.

---

# PRINCIPIO FUNDAMENTAL

PostgreSQL será la fuente de verdad.

El frontend nunca será autoridad sobre:

- identidad del usuario;
- precios;
- permisos;
- estados;
- sucursal;
- propiedad de una orden;
- transiciones;
- totales.

Socket.IO solamente será utilizado para comunicar cambios en tiempo real.

La base de datos siempre determinará el estado real.

---

# FASE CERO — AUDITORÍA OBLIGATORIA

NO comiences escribiendo código inmediatamente.

Primero inspecciona completamente cómo funciona actualmente el sistema de pedidos.

Revisa como mínimo:

`schema.prisma`

`App.tsx`

`CartView.tsx`

`BranchOrdersView.tsx`

`OrderTrackingView.tsx`

`order.controller.ts`

`order.service.ts`

módulo de autenticación

guards existentes

estrategia JWT existente

roles/permisos existentes

relación User/Order

sistema actual de impresión

cualquier implementación relacionada con polling

cualquier implementación relacionada con WebSockets

cualquier código antiguo relacionado con pedidos de invitados

Revisa también cualquier archivo relacionado que descubras durante la inspección.

Antes de implementar, documenta:

## Estado actual

Cómo funciona hoy:

```text
Cliente
→ Carrito
→ Checkout
→ API
→ OrderController
→ OrderService
→ Prisma
→ PostgreSQL
→ Vista sucursal
→ Tracking
→ impresión si existe
```

## Identificar

- qué ya existe;
- qué funciona;
- qué está incompleto;
- qué debe modificarse;
- qué debe eliminarse;
- qué debe reutilizarse;
- qué representa un riesgo;
- qué migraciones serán necesarias.

No asumas que algo falta sin comprobarlo.

---

# REGLA OBLIGATORIA — NO EXISTEN PEDIDOS DE INVITADOS

Los pedidos solamente pueden ser realizados por usuarios registrados y autenticados.

NO implementar:

- guest checkout;
- pedidos anónimos;
- tracking público;
- pedidos mediante solamente teléfono;
- recuperación pública mediante folio.

El cliente puede consultar el menú sin autenticarse si el comportamiento actual lo permite.

Sin embargo, para confirmar un pedido deberá iniciar sesión o registrarse.

Flujo:

```text
VISITANTE
   ↓
Consulta menú
   ↓
Agrega productos
   ↓
Intenta realizar pedido
   ↓
¿AUTENTICADO?
   ↓
NO ─────────────→ LOGIN / REGISTRO
                       ↓
                      SÍ
                       ↓
                CREAR PEDIDO
```

Toda orden debe pertenecer obligatoriamente a un usuario.

La identidad debe obtenerse del token/sesión autenticada.

NO confiar en un `userId` enviado desde el frontend.

Conceptualmente:

```text
JWT
 ↓
AuthGuard
 ↓
req.user
 ↓
userId
 ↓
Order.userId
```

Un usuario jamás debe poder consultar pedidos pertenecientes a otro usuario.

---

# ARQUITECTURA DEL NUEVO FLUJO

El flujo deseado será:

```text
CLIENTE AUTENTICADO
        ↓
REALIZA PEDIDO
        ↓
BACKEND VALIDA
        ↓
SE GENERA ORDEN
        ↓
SE GENERA FOLIO
        ↓
PENDING_APPROVAL
        ↓
SUCURSAL RECIBE PEDIDO
        ↓
┌────────────────────────────┐
│                            │
REJECT                    ACCEPT
│                            │
↓                            ↓
REJECTED                  ACCEPTED
                             ↓
                          PREPARING
                             ↓
                           READY
                             ↓
                         COMPLETED
```

Cada transición deberá actualizar:

1. `Order.status`
2. historial de estados
3. fecha/hora
4. usuario responsable cuando corresponda
5. motivo cuando corresponda
6. clientes conectados mediante Socket.IO

---

# UNO — CREACIÓN DEL PEDIDO

Cuando el cliente confirme el carrito:

El backend debe:

1. verificar autenticación;
2. obtener el usuario desde la autenticación;
3. validar la sucursal;
4. consultar productos reales;
5. consultar precios reales;
6. validar variantes;
7. validar extras;
8. validar promociones;
9. recalcular subtotal;
10. recalcular descuentos;
11. recalcular total;
12. crear la orden;
13. generar folio;
14. registrar estado inicial;
15. registrar historial;
16. confirmar la transacción;
17. emitir evento en tiempo real.

El frontend NO debe determinar el total definitivo.

---

# DOS — FOLIO ÚNICO

Cada pedido tendrá:

## ID interno

Utilizar el sistema actual si ya existe.

Si utiliza UUID, conservarlo.

Este ID es técnico.

## Folio público

Crear un identificador humano.

Ejemplo:

`FB-008421`

El cliente verá este folio.

La sucursal verá este folio.

Administración podrá buscarlo.

La impresión deberá mostrarlo cuando corresponda.

El folio deberá ser:

- único;
- indexado;
- protegido mediante constraint UNIQUE;
- generado de manera segura ante concurrencia.

NO utilizar ingenuamente:

`count() + 1`

porque dos pedidos simultáneos pueden producir el mismo folio.

Diseñar una estrategia segura utilizando PostgreSQL/Prisma.

---

# TRES — ESTADO INICIAL

Una orden recién creada NO significa que haya sido aceptada.

Estado inicial:

`PENDING_APPROVAL`

Texto mostrado al cliente:

`Pendiente de aceptación`

Inmediatamente después del checkout mostrar:

```text
¡Pedido recibido!

Folio:
FB-008421

Tu pedido fue enviado a la sucursal.

Estamos esperando que la sucursal lo acepte.
```

Debe quedar claramente diferenciado:

`PEDIDO RECIBIDO`

de:

`PEDIDO ACEPTADO`.

---

# CUATRO — RECEPCIÓN EN SUCURSAL

La pantalla administrativa/operativa de pedidos deberá recibir automáticamente las nuevas órdenes correspondientes a su sucursal.

No deberá ser necesario actualizar manualmente la página.

Ejemplo:

```text
NUEVO PEDIDO

FB-008421

Hace 37 segundos

Cliente: Alonzo

2 × Hamburguesa
1 × Sushi
2 × Refresco

Notas:
Sin cebolla

Total:
$485.00

Método de pago:
Efectivo

[ RECHAZAR ]       [ ACEPTAR ]
```

La interfaz debe adaptarse al diseño existente.

No reconstruir toda la pantalla si puede evolucionarse `BranchOrdersView.tsx`.

---

# CINCO — ACEPTAR PEDIDO

Cuando la sucursal pulse:

`ACEPTAR`

el frontend deberá llamar al backend.

El backend deberá:

- autenticar;
- autorizar;
- comprobar sucursal;
- consultar estado actual;
- verificar transición;
- actualizar estado;
- crear historial;
- confirmar DB;
- emitir evento Socket.IO;
- ejecutar impresión existente si corresponde.

Nuevo estado:

`ACCEPTED`

Cliente:

`Tu pedido fue aceptado.`

---

# SEIS — RECHAZAR PEDIDO

Los pedidos `PENDING_APPROVAL` podrán rechazarse.

Solicitar motivo.

Ejemplos:

- producto agotado;
- sucursal saturada;
- problema con el pedido;
- fuera de horario;
- otro.

Estado:

`REJECTED`

Registrar:

- motivo;
- fecha;
- usuario interno responsable;
- estado anterior;
- estado nuevo.

El cliente deberá recibir inmediatamente la actualización.

Ejemplo:

```text
Pedido no aceptado

La sucursal no pudo aceptar tu pedido.

Motivo:
Producto agotado
```

---

# SIETE — MÁQUINA DE ESTADOS

Crear una máquina de estados controlada por backend.

Estados conceptuales:

```text
PENDING_APPROVAL
ACCEPTED
PREPARING
READY
COMPLETED
REJECTED
CANCELLED
```

Antes de modificar enums existentes, analizar los estados actuales.

Reutilizar estados equivalentes cuando sea posible.

Transiciones permitidas conceptualmente:

```text
PENDING_APPROVAL
→ ACCEPTED
→ REJECTED

ACCEPTED
→ PREPARING
→ CANCELLED

PREPARING
→ READY
→ CANCELLED

READY
→ COMPLETED
```

No permitir:

```text
COMPLETED → PREPARING

REJECTED → ACCEPTED

PENDING_APPROVAL → READY
```

salvo que exista una necesidad funcional explícita y documentada.

El backend será autoridad sobre estas reglas.

---

# OCHO — HISTORIAL Y TRAZABILIDAD

No basta con almacenar solamente:

`Order.status`

Crear historial persistente.

Diseñar un modelo Prisma equivalente conceptualmente a:

```text
OrderStatusHistory

id
orderId
fromStatus
toStatus
createdAt
userId nullable
reason nullable
metadata nullable
```

Adaptar nombres al esquema existente.

Cada transición deberá generar un registro.

Ejemplo:

```text
Pedido FB-008421

20:31:04
Pedido creado

20:31:05
Pendiente de aceptación

20:32:17
Aceptado

20:34:02
Preparación iniciada

20:47:31
Pedido listo

20:52:10
Entregado
```

El historial deberá ser inmutable durante operaciones normales.

---

# NUEVE — AUDITORÍA DEL RESPONSABLE

Cuando una acción sea realizada por personal interno, registrar quién la realizó.

Ejemplo:

```text
20:31 Pedido creado
Cliente

20:32 Pedido aceptado
Luis

20:34 Preparación iniciada
Edgar

20:47 Pedido listo
Edgar

20:52 Pedido entregado
Luis
```

Utilizar usuarios/roles existentes.

No crear un sistema paralelo de empleados si ya existe uno.

Si actualmente el sistema interno no identifica correctamente a los usuarios responsables, documentar y corregir primero la autorización necesaria.

---

# DIEZ — TRACKING DEL CLIENTE

Mejorar `OrderTrackingView.tsx`.

El cliente deberá poder observar el estado en tiempo real.

Ejemplo:

```text
Pedido FB-008421

✓ Pedido recibido
✓ Pedido aceptado
● Preparando tu pedido
○ Listo para recoger
○ Entregado
```

Mostrar además:

- folio;
- sucursal;
- fecha;
- hora;
- productos;
- total;
- estado;
- timeline.

No mostrar enums técnicos.

Ejemplo:

`PENDING_APPROVAL`

debe visualizarse como:

`Pendiente de aceptación`.

---

# ONCE — PEDIDOS EN EL PERFIL

El usuario autenticado deberá poder consultar:

`Pedidos activos`

y:

`Pedidos anteriores`

Cada pedido mostrará:

- folio;
- fecha;
- sucursal;
- total;
- estado.

Al abrirlo:

- productos;
- cantidades;
- extras;
- total;
- timeline;
- estado actual.

El backend deberá verificar propiedad.

Conceptualmente:

```text
usuario autenticado
        ↓
Order.userId === req.user.id
        ↓
permitir
```

Nunca:

```text
folio conocido
↓
permitir acceso
```

Conocer el folio NO concede autorización.

---

# DOCE — SEGURIDAD CONTRA IDOR

Evitar vulnerabilidades donde:

Usuario A tiene:

`FB-008421`

y modifica la URL para intentar consultar:

`FB-008422`

perteneciente al Usuario B.

El backend deberá devolver acceso denegado/no encontrado según la estrategia de seguridad elegida.

Aplicar esta protección independientemente de:

- UUID;
- folio;
- ID;
- query params;
- URL.

---

# TRECE — SOCKET.IO

Sustituir el polling como mecanismo principal de actualización.

Implementar:

NestJS WebSocket Gateway + Socket.IO.

Eventos conceptuales:

```text
order.created

order.accepted

order.rejected

order.status_changed
```

No es obligatorio utilizar exactamente esos nombres si existe una convención mejor dentro del proyecto.

---

# CATORCE — ROOMS

No hacer broadcast global de todos los pedidos.

Implementar rooms.

Conceptualmente:

```text
branch:{branchId}

user:{userId}

order:{orderId}
```

Sucursal:

solo recibe pedidos correspondientes a esa sucursal.

Cliente:

solo recibe información autorizada.

Pedido:

puede disponer de room específica cuando resulte conveniente.

---

# QUINCE — SEGURIDAD WEBSOCKET

La conexión WebSocket también deberá autenticarse.

No confiar en:

```text
socket.emit("join", {
  userId: 123
})
```

como mecanismo de autorización.

Validar token/sesión.

El servidor determina:

- quién es el usuario;
- qué rooms puede utilizar;
- qué sucursal puede consultar;
- qué pedidos puede recibir.

---

# DIECISÉIS — FLUJO CORRECTO DE EVENTOS

Siempre:

```text
REQUEST
   ↓
BACKEND
   ↓
VALIDACIÓN
   ↓
TRANSACCIÓN
   ↓
POSTGRESQL
   ↓
COMMIT EXITOSO
   ↓
SOCKET.IO
   ↓
FRONTENDS
```

Nunca:

```text
Socket.IO
↓
mostrar cambio
↓
intentar guardar después
```

PostgreSQL continúa siendo la fuente de verdad.

---

# DIECISIETE — RECONEXIÓN

El sistema debe tolerar pérdida temporal de conexión.

Ejemplo:

La tablet pierde Wi-Fi durante treinta segundos.

Durante ese tiempo cambia una orden.

La tablet reconecta.

No debe depender exclusivamente de haber recibido todos los eventos.

Al reconectar:

```text
Socket reconecta
      ↓
Frontend consulta API
      ↓
Backend consulta PostgreSQL
      ↓
UI recupera estado verdadero
```

Socket.IO notifica.

HTTP sincroniza.

PostgreSQL manda.

---

# DIECIOCHO — CONCURRENCIA

Resolver condiciones de carrera.

Ejemplo:

Tablet A:

`ACEPTAR`

Tablet B:

`RECHAZAR`

ambas prácticamente simultáneamente.

Solamente una operación puede ganar.

La otra deberá recibir algo equivalente a:

`409 Conflict`

y refrescar el pedido.

Implementar transacciones u operaciones atómicas según corresponda.

---

# DIECINUEVE — PRECIOS Y EXTRAS

Auditar específicamente `order.service.ts`.

El backend debe recalcular:

- precio producto;
- variante;
- extras;
- promociones;
- cantidades;
- descuentos;
- subtotal;
- total.

El frontend solamente comunica selección.

Ejemplo correcto:

```text
productId
variantId
extraIds
quantity
```

Backend consulta precios reales.

No confiar en:

```text
price: 100
extraPrice: 30
total: 130
```

proporcionado por navegador.

Si el sistema actual todavía recibe precios de extras como JSON manipulable, corregir este riesgo dentro de esta implementación o diseñar la migración necesaria.

---

# VEINTE — IMPRESIÓN DE COMANDA

Antes de modificar impresión, investigar exactamente qué existe.

Determinar:

- si actualmente imprime;
- cuándo imprime;
- desde dónde imprime;
- qué componente dispara la impresión;
- si depende del navegador;
- si depende de backend;
- qué información incluye.

Si actualmente imprime inmediatamente al crear pedido, cambiar conceptualmente el flujo a:

```text
PEDIDO CREADO
      ↓
PENDING_APPROVAL
      ↓
NO IMPRIMIR
      ↓
SUCURSAL ACEPTA
      ↓
ACCEPTED
      ↓
IMPRIMIR COMANDA
```

La cocina no debe comenzar una orden que todavía no ha sido aceptada.

No crear una arquitectura nueva de impresión si la actual puede adaptarse.

---

# VEINTIUNO — ERROR DE IMPRESIÓN

La impresión es un efecto secundario.

No corromper el pedido si la impresora falla.

Ejemplo:

```text
Pedido aceptado correctamente
↓
DB = ACCEPTED
↓
intento impresión
↓
impresora falla
```

El pedido NO debe desaparecer ni volver arbitrariamente a `PENDING_APPROVAL`.

Registrar el fallo de impresión si la arquitectura lo permite y permitir reintentar impresión de manera controlada.

Evitar impresiones duplicadas accidentales.

---

# VEINTIDÓS — KDS EXTERNO

El KDS pertenece a otro sistema.

NO construir un KDS nuevo.

NO intentar integrar el KDS sin conocer:

- API;
- protocolo;
- autenticación;
- formato de comandas.

Puede dejarse preparada una separación arquitectónica para futuras integraciones.

Conceptualmente:

```text
OrderService
     ↓
Order accepted
     ↓
Integration layer
     ↓
Futura integración
```

Pero no implementar servicios ficticios.

---

# VEINTITRÉS — EL SISTEMA NO ES UN POS

Mantener claramente separados los conceptos.

Este proyecto administra:

```text
MENÚ DIGITAL
+
CUENTAS DE CLIENTES
+
CARRITO
+
PEDIDOS WEB
+
RECEPCIÓN
+
APROBACIÓN
+
TRACKING
+
TRAZABILIDAD
```

No agregar:

- apertura/cierre de caja;
- arqueos;
- movimientos de efectivo;
- inventario POS;
- comandas de meseros;
- mesas;
- terminal de venta;
- funciones generales de POS.

---

# VEINTICUATRO — PANTALLA OPERATIVA

Optimizar la vista de sucursal para operación rápida.

Separar visualmente, según resulte apropiado:

```text
NUEVOS

EN PREPARACIÓN

LISTOS
```

Un pedido nuevo debe destacar.

Mostrar:

`Hace 25 segundos`

`Hace 1 min`

`Hace 4 min`

para que el personal pueda identificar retrasos.

---

# VEINTICINCO — AVISO DE NUEVO PEDIDO

Cuando llegue un pedido nuevo:

- actualizar UI;
- destacar pedido;
- reproducir sonido cuando el navegador lo permita.

No reproducir sonidos repetitivos por el mismo pedido.

Gestionar correctamente restricciones de autoplay del navegador.

---

# VEINTISÉIS — ADMINISTRACIÓN

Administración deberá poder buscar pedidos.

Filtros recomendados:

- folio;
- cliente;
- sucursal;
- estado;
- rango de fechas.

Si teléfono forma parte legítima de la búsqueda administrativa actual, conservarlo.

Al abrir un pedido mostrar:

- datos generales;
- productos;
- total;
- estado;
- historial;
- responsables;
- motivos de rechazo/cancelación.

---

# VEINTISIETE — MÉTRICAS FUTURAS

No construir todavía un sistema BI completo.

Sin embargo, diseñar correctamente los datos para posteriormente calcular:

```text
creación → aceptación

aceptación → preparación

preparación → listo

listo → entrega

creación → entrega
```

Así podremos posteriormente obtener:

- tiempo promedio de aceptación;
- tiempo promedio de preparación;
- tiempo total;
- pedidos rechazados;
- cancelaciones;
- desempeño por sucursal;
- horas con mayor saturación.

---

# VEINTIOCHO — ÍNDICES DE POSTGRESQL

Analizar las consultas reales.

Evaluar índices para:

```text
folio

status

branchId

createdAt

userId
```

y combinaciones:

```text
branchId + status

branchId + createdAt

userId + createdAt
```

No agregar índices indiscriminadamente.

Documentar por qué se agrega cada índice.

---

# VEINTINUEVE — PAGINACIÓN

No utilizar `findMany()` ilimitados para históricos.

Implementar paginación donde corresponda.

Preferentemente cursor pagination para tablas que crecerán continuamente.

Ejemplo conceptual:

```text
GET /orders?limit=30&cursor=...
```

Aplicarlo especialmente a:

- historial de pedidos;
- administración;
- pedidos del usuario;
- consultas históricas.

Las vistas operativas de pedidos activos pueden utilizar una estrategia específica apropiada al pequeño conjunto activo.

---

# TREINTA — SESIONES VENCIDAS

Auditar manejo de JWT/token expirado.

Si API responde:

`401 Unauthorized`

el frontend debe:

- limpiar sesión inválida;
- solicitar autenticación;
- evitar estados inconsistentes.

Aplicar también comportamiento coherente al WebSocket.

---

# TREINTA Y UNO — PEDIDOS HISTÓRICOS

La migración NO puede destruir pedidos existentes.

Si actualmente existen otros estados, crear estrategia de migración.

Ejemplo:

estado antiguo:

`pending`

podría requerir mapearse a algún estado nuevo.

NO realizar conversiones arbitrarias.

Analizar los datos y comportamiento existente antes.

Si existe ambigüedad, documentarla.

---

# TREINTA Y DOS — CÓDIGO LEGACY DE INVITADOS

Buscar código relacionado con:

- guest;
- anonymous;
- guestOrder;
- guest checkout;
- pedidos sin userId.

El sistema ya no debe permitir pedidos de invitados.

Sin embargo:

NO eliminar código simplemente porque parece antiguo.

Primero determinar:

- dónde se utiliza;
- qué depende de él;
- si contiene datos históricos.

Después retirar/refactorizar de manera segura lo que realmente esté obsoleto.

---

# TREINTA Y TRES — MODELO DE HISTORIAL

Diseñar una estructura robusta.

Ejemplo conceptual Prisma:

```text
OrderStatusHistory {
  id
  orderId
  fromStatus
  toStatus
  reason
  userId
  createdAt
  metadata
}
```

No copies esto literalmente sin analizar el esquema actual.

Crear relaciones e índices apropiados.

---

# TREINTA Y CUATRO — TRANSACCIONES

Operaciones críticas deben ser atómicas.

Especialmente:

```text
validar estado
+
actualizar Order
+
crear OrderStatusHistory
```

No debe ser posible:

```text
Order = ACCEPTED

pero

History = inexistente
```

por un fallo intermedio.

Usar `prisma.$transaction` u otra estrategia apropiada.

---

# TREINTA Y CINCO — API

Diseñar endpoints REST coherentes con la API existente.

Ejemplos conceptuales:

```text
POST /orders

GET /orders/me

GET /orders/:id

POST /orders/:id/accept

POST /orders/:id/reject

PATCH /orders/:id/status
```

Estos nombres son ejemplos.

Respeta las convenciones existentes.

No crear endpoints redundantes si ya existen equivalentes.

---

# TREINTA Y SEIS — AUTORIZACIÓN INTERNA

Auditar especialmente `BranchOrdersView`.

Si actualmente los roles dependen de:

- sessionStorage;
- localStorage;
- selectores frontend;
- `ADMIN_CATALOG_KEY`;

NO considerar eso seguridad suficiente.

Las operaciones críticas deben autorizarse en NestJS.

El backend debe conocer:

- usuario;
- rol;
- sucursal;
- permisos.

Un usuario de una sucursal no deberá administrar pedidos de otra salvo que su rol explícitamente lo permita.

---

# TREINTA Y SIETE — PRUEBAS DE SEGURIDAD

Agregar pruebas para:

```text
Usuario no autenticado crea pedido
→ RECHAZADO

Usuario autenticado crea pedido
→ PERMITIDO

Usuario A consulta pedido B
→ RECHAZADO

Usuario modifica userId
→ NO obtiene pedido ajeno

Usuario interno sin permiso acepta
→ RECHAZADO

Sucursal A modifica pedido sucursal B
→ RECHAZADO

Token vencido
→ REAUTENTICACIÓN
```

---

# TREINTA Y OCHO — PRUEBAS FUNCIONALES

Probar:

- creación;
- folio;
- aceptación;
- rechazo;
- motivo rechazo;
- preparación;
- listo;
- completado;
- cancelación;
- timeline;
- perfil;
- tracking;
- impresión;
- WebSockets;
- reconexión.

---

# TREINTA Y NUEVE — PRUEBAS DE CONCURRENCIA

Probar:

dos pedidos creados simultáneamente.

No pueden compartir folio.

Probar:

dos tablets aceptando la misma orden.

Probar:

una acepta mientras otra rechaza.

Probar:

cambio de estado simultáneo.

La base de datos debe permanecer consistente.

---

# CUARENTA — NO ROMPER FUNCIONALIDADES EXISTENTES

Mantener funcionando:

- menú;
- catálogo;
- categorías;
- promociones;
- carrito;
- autenticación;
- registro;
- perfil;
- administración del catálogo;
- encuestas;
- pedidos existentes;
- despliegue Docker/Coolify.

Evitar refactors masivos fuera del alcance.

---

# PLAN DE IMPLEMENTACIÓN

Después de la auditoría, ejecutar por fases.

## FASE 1 — MODELO DE DATOS

- estados;
- folio;
- historial;
- relaciones;
- índices;
- migración.

Ejecutar tests y build.

## FASE 2 — MOTOR DE ESTADOS

Implementar:

- reglas;
- transiciones;
- transacciones;
- concurrencia;
- auditoría.

Ejecutar tests y build.

## FASE 3 — SEGURIDAD

Implementar/verificar:

- JWT;
- Guards;
- propiedad de órdenes;
- roles;
- sucursales;
- protección IDOR.

Ejecutar tests y build.

## FASE 4 — CREACIÓN SEGURA DEL PEDIDO

- usuario obligatorio;
- validación catálogo;
- precios;
- extras;
- promociones;
- total;
- folio;
- historial inicial.

Ejecutar tests y build.

## FASE 5 — API OPERATIVA

Implementar/refactorizar:

- aceptar;
- rechazar;
- estados;
- consulta;
- historial;
- paginación.

Ejecutar tests y build.

## FASE 6 — TIEMPO REAL

Implementar:

- Socket.IO;
- autenticación;
- rooms;
- eventos;
- reconexión.

Ejecutar tests y build.

## FASE 7 — PANTALLA DE SUCURSAL

Mejorar:

`BranchOrdersView.tsx`

Implementar:

- nuevos;
- aceptación;
- rechazo;
- preparación;
- listos;
- tiempos;
- sonido;
- actualización automática.

## FASE 8 — EXPERIENCIA DEL CLIENTE

Mejorar:

`OrderTrackingView.tsx`

y perfil.

Implementar:

- pedidos activos;
- historial;
- timeline;
- actualizaciones en vivo.

## FASE 9 — IMPRESIÓN

Auditar y adaptar el sistema existente.

La impresión deberá ocurrir en el momento operativo correcto.

## FASE 10 — HARDENING

Ejecutar:

- pruebas funcionales;
- seguridad;
- concurrencia;
- reconexión;
- build producción;
- migraciones;
- revisión TypeScript.

---

# RESULTADO FINAL ESPERADO

La prueba completa debe ser:

```text
1. Cliente entra al menú.

2. Consulta productos.

3. Agrega productos.

4. Intenta realizar pedido.

5. El sistema verifica autenticación.

6. Backend identifica al usuario desde su sesión/token.

7. Backend consulta productos y precios reales.

8. Backend calcula total.

9. Se crea la orden.

10. Se genera folio FB-XXXXXX.

11. Se registra PENDING_APPROVAL.

12. Se registra historial.

13. PostgreSQL confirma transacción.

14. Socket.IO notifica a la sucursal.

15. Pedido aparece automáticamente.

16. Sucursal revisa pedido.

17. Sucursal acepta.

18. Backend valida autorización.

19. Estado cambia a ACCEPTED.

20. Historial registra responsable y hora.

21. Cliente recibe actualización en vivo.

22. Se ejecuta impresión si corresponde.

23. Pedido pasa a PREPARING.

24. Cliente ve "Preparando tu pedido".

25. Pedido pasa a READY.

26. Cliente ve "Tu pedido está listo".

27. Pedido pasa a COMPLETED.

28. Cliente ve pedido completado.

29. Todo queda registrado históricamente.

30. Cliente puede consultar posteriormente el pedido desde su perfil.

31. Administrador puede localizarlo mediante folio.

32. Administrador puede reconstruir todo el timeline.
```

---

# CRITERIOS DE TERMINADO

No considerar la implementación terminada simplemente porque compile.

Debe cumplirse:

- migraciones funcionando;
- pedidos históricos conservados;
- build backend exitoso;
- build frontend exitoso;
- tests críticos exitosos;
- folios sin colisiones;
- autorización backend funcionando;
- IDOR protegido;
- precios validados server-side;
- estados controlados;
- historial persistente;
- Socket.IO autenticado;
- reconexión funcional;
- pantalla sucursal en tiempo real;
- tracking cliente en tiempo real;
- impresión existente adaptada si corresponde;
- ninguna dependencia del guest checkout;
- documentación actualizada.

---

# DOCUMENTACIÓN FINAL

Al terminar genera un informe con:

## Qué encontraste originalmente

Explica el funcionamiento anterior.

## Qué modificaste

Por backend/frontend/database.

## Archivos modificados

Lista exacta.

## Archivos creados

Lista exacta.

## Migraciones Prisma

Explicar cada migración.

## Nuevas variables de entorno

Documentarlas sin exponer secretos.

## Socket.IO

Documentar:

- Gateway;
- autenticación;
- rooms;
- eventos;
- payloads.

## Máquina de estados

Documentar estados y transiciones.

## Impresión

Explicar cómo funcionaba y cómo quedó.

## Seguridad

Explicar:

- autenticación;
- autorización;
- protección por sucursal;
- propiedad del pedido;
- protección IDOR.

## Pruebas

Indicar cuáles se ejecutaron y resultados.

## Despliegue

Documentar exactamente qué debe realizarse en Coolify para desplegar esta versión.

---

# REGLAS FINALES

No desarrollar desde cero.

No convertir el menú en POS.

No construir un KDS.

No integrar el KDS externo sin conocer su interfaz.

No permitir pedidos de invitados.

No confiar en `userId` enviado por frontend.

No confiar en precios enviados por frontend.

No confiar en roles almacenados solamente en frontend.

No utilizar el folio como autorización.

No utilizar Socket.IO como fuente de verdad.

No emitir cambios definitivos antes del commit de PostgreSQL.

No permitir transiciones arbitrarias.

No perder historial.

No destruir pedidos existentes.

No ejecutar migraciones destructivas sin analizar datos.

No imprimir una orden todavía pendiente de aceptación.

No duplicar funcionalidad existente.

No realizar refactors masivos fuera del alcance.

No introducir dependencias innecesarias.

Priorizar:

1. integridad de datos;
2. seguridad;
3. trazabilidad;
4. estabilidad;
5. operación en tiempo real;
6. experiencia del usuario.

Primero audita.

Después presenta brevemente el plan basado en el código REAL encontrado.

Después implementa todas las fases de manera incremental.

No te detengas solamente en el análisis: una vez determinado el plan y comprobado que es compatible con la arquitectura existente, procede con la implementación completa.

Después de cada fase ejecuta las validaciones correspondientes y corrige los errores encontrados antes de continuar.