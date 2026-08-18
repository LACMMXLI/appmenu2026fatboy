# Plan de implementación — Fatboy Pedidos

## Objetivo general

El proyecto actual de Fatboy ya cuenta con un sistema funcional de pedidos integrado al menú digital.

Actualmente existe:

- Frontend React + Vite + TypeScript.
- Backend NestJS.
- Prisma ORM.
- PostgreSQL.
- Autenticación de clientes mediante sesiones opacas.
- Autenticación independiente para personal mediante `Staff` y `StaffSession`.
- Modelo de sucursales.
- Creación segura de pedidos.
- Folios únicos.
- Máquina de estados.
- Historial y auditoría.
- Control de concurrencia.
- Autorización por sucursal.
- Socket.IO.
- Actualización de pedidos en tiempo real.
- Seguimiento del pedido por parte del cliente.
- Vista `BranchOrdersView` para operación de pedidos.
- Impresión manual desde navegador.

**No se debe reconstruir ninguno de estos componentes.**

El objetivo de esta implementación es separar correctamente las dos interfaces del sistema.

El sistema deberá quedar conceptualmente dividido en:

```text
                    ┌──────────────────────────┐
                    │       PostgreSQL         │
                    │   Base de datos única    │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │      Backend NestJS      │
                    │                          │
                    │ Auth clientes            │
                    │ Auth Staff               │
                    │ Orders                   │
                    │ OrderStatusHistory       │
                    │ Branches                 │
                    │ Socket.IO                │
                    │ Seguridad/autorización   │
                    └───────┬──────────┬───────┘
                            │          │
                  ┌─────────▼───┐  ┌───▼──────────────┐
                  │ MENÚ FATBOY │  │ FATBOY PEDIDOS   │
                  │             │  │                  │
                  │ Clientes    │  │ Personal         │
                  │ Público     │  │ Operación        │
                  └─────────────┘  └──────────────────┘
```

No son dos sistemas de pedidos.

Son **dos aplicaciones frontend consumiendo el mismo backend y trabajando sobre los mismos pedidos**.

---

# Uno. Problema que queremos resolver

Actualmente el frontend público del menú contiene también funcionalidad destinada al personal, principalmente `BranchOrdersView`.

Esto mezcla dos contextos completamente diferentes:

**Menú Fatboy**

Está diseñado para clientes.

Su función es:

- Mostrar catálogo.
- Mostrar productos.
- Permitir registro/login.
- Crear pedidos.
- Consultar pedidos propios.
- Mostrar seguimiento.
- Mostrar historial del cliente.

**Operación Fatboy**

Está diseñada para empleados.

Su función es:

- Recibir pedidos.
- Revisarlos.
- Aceptarlos.
- Rechazarlos.
- Imprimirlos.
- Cambiar su estado.
- Consultar pedidos de la sucursal.
- Consultar historial operativo.

Estas responsabilidades deben quedar separadas.

Además, el navegador de un cliente no necesita recibir componentes, rutas y código JavaScript correspondientes a las herramientas internas del negocio.

La seguridad seguirá dependiendo siempre del backend, pero la separación evita distribuir innecesariamente el frontend operativo dentro de la aplicación pública.

---

# Dos. Nueva aplicación

Crear una segunda aplicación frontend denominada provisionalmente:

**Fatboy Pedidos**

Será una aplicación complementaria del ecosistema Fatboy.

No será:

- un POS;
- un KDS;
- un sistema de inventarios;
- un administrador del catálogo;
- un nuevo backend;
- una nueva base de datos;
- un nuevo motor de órdenes.

Su única responsabilidad en esta primera etapa será:

> Recibir y gestionar operacionalmente los pedidos digitales correspondientes a cada sucursal.

---

# Tres. Arquitectura objetivo

La arquitectura deberá quedar aproximadamente así:

```text
apps/
    menu/
        React
        Vite
        TypeScript

    pedidos/
        React
        Vite
        TypeScript

backend/
    NestJS
    Prisma
    PostgreSQL
    Socket.IO
```

No es obligatorio modificar inmediatamente la estructura física del repositorio si hacerlo representa un riesgo innecesario.

Primero analizar la estructura existente.

Si actualmente frontend y backend están organizados de otra manera, realizar la separación con la menor cantidad posible de cambios destructivos.

**No realizar una migración de monorepo únicamente por estética.**

La prioridad es separar los builds y despliegues.

---

# Cuatro. Despliegue esperado

Se deberán generar dos aplicaciones frontend completamente independientes a nivel de build.

Ejemplo:

```text
menu.fatboymexicali.com
```

Aplicación pública para clientes.

Y:

```text
pedidos.fatboymexicali.com
```

Aplicación privada/operativa para sucursales.

Ambas consumirán el mismo backend existente.

Ejemplo conceptual:

```text
menu.fatboymexicali.com ──────┐
                              │
                              ▼
                       api/backend Fatboy
                              ▲
                              │
pedidos.fatboymexicali.com ───┘
```

Socket.IO también será compartido.

No crear una segunda instancia lógica del motor de pedidos.

---

# Cinco. Reutilizar el backend actual

Antes de programar, auditar los endpoints y servicios existentes.

La nueva aplicación deberá reutilizar todo lo construido para:

- `Staff`.
- `StaffSession`.
- login de personal.
- autorización.
- sucursales.
- pedidos.
- aceptación.
- rechazo.
- cambios de estado.
- historial.
- Socket.IO.
- rooms por sucursal.
- concurrencia.
- folios.

No duplicar lógica de negocio en React.

React únicamente representa el estado y solicita acciones.

NestJS continúa siendo la autoridad.

---

# Seis. Autenticación de Fatboy Pedidos

Al abrir la aplicación sin sesión válida deberá mostrarse exclusivamente el login de personal.

Ejemplo:

```text
FATBOY PEDIDOS

Usuario
[________________]

Contraseña
[________________]

       INICIAR SESIÓN
```

La aplicación utilizará `StaffSession`.

No utilizar autenticación de clientes.

No utilizar `ADMIN_CATALOG_KEY`.

No almacenar contraseñas.

No implementar autorización únicamente desde React.

Una vez autenticado, el backend determinará:

- identidad;
- nombre;
- rol;
- sucursal;
- permisos.

Un empleado normal jamás deberá poder elegir manualmente otra sucursal para obtener sus pedidos.

La sucursal efectiva deberá proceder de su identidad validada por backend.

---

# Siete. Pantalla principal

Esta será la pantalla más importante de toda la aplicación.

Debe estar optimizada para:

- tablet;
- computadora;
- pantalla táctil;
- operación rápida;
- ambientes de restaurante.

No queremos un dashboard administrativo tradicional lleno de tablas pequeñas.

Queremos una interfaz operacional.

Diseño conceptual:

```text
FATBOY PEDIDOS                    AMÉRICAS
Luis                              ● Conectado

--------------------------------------------------

NUEVOS      ACEPTADOS      PREPARACIÓN       LISTOS
   3            2               4                1

--------------------------------------------------

#FB-001287                         6:42 PM
Juan Pérez

2 × Hamburguesa Especial
1 × Boneless
2 × Coca-Cola

TOTAL $485

[ VER PEDIDO ]

--------------------------------------------------

#FB-001288                         6:44 PM
María López

1 × California
2 × Sushi Cielo

TOTAL $310

[ VER PEDIDO ]
```

La interfaz final puede utilizar columnas, pestañas o agrupaciones responsivas.

Lo importante es que el empleado pueda identificar inmediatamente:

- pedidos nuevos;
- pedidos aceptados;
- pedidos preparando;
- pedidos listos.

---

# Ocho. Estados

La aplicación debe respetar exactamente la máquina de estados existente.

```text
PENDING_APPROVAL
        │
        ├──────→ REJECTED
        │
        ▼
    ACCEPTED
        │
        ▼
   PREPARING
        │
        ▼
      READY
        │
        ▼
    COMPLETED
```

Además:

```text
ACCEPTED → CANCELLED

PREPARING → CANCELLED
```

No agregar estados desde frontend.

No permitir saltos de estado.

No reproducir la máquina de estados solamente mediante botones ocultos.

El backend seguirá validando cada transición.

---

# Nueve. Pedidos nuevos

Cuando llegue un nuevo pedido para la sucursal:

Socket.IO emitirá el evento existente:

```text
order.created
```

La aplicación deberá:

- recibir el evento;
- realizar refetch HTTP;
- actualizar la interfaz;
- colocar el pedido en Nuevos;
- destacar visualmente la llegada.

Agregar alerta sonora configurable para pedidos nuevos.

El sonido debe llamar la atención del empleado sin depender de que esté observando permanentemente la pantalla.

Considerar restricciones del navegador respecto a reproducción automática de audio.

Después de una interacción inicial del usuario, preparar/habilitar el sistema de alertas.

No transportar todo el pedido mediante Socket.IO.

Mantener la arquitectura existente:

```text
Evento Socket
      ↓
orderId
      ↓
refetch HTTP
      ↓
estado real del servidor
```

---

# Diez. Vista detallada del pedido

Al seleccionar un pedido mostrar una vista clara y de alta legibilidad.

Ejemplo:

```text
PEDIDO #FB-001287

6:42 PM
Juan Pérez
Teléfono: ...

--------------------------------

2 × HAMBURGUESA ESPECIAL

    Sin cebolla
    + Tocino
    + Queso

1 × BONELESS

    BBQ
    Ranch

2 × COCA-COLA

--------------------------------

Notas:

"Una hamburguesa sin cebolla."

--------------------------------

Subtotal
Extras
Total

TOTAL: $485

--------------------------------

[ RECHAZAR ]       [ ACEPTAR ]
```

Los modificadores y notas deben tener especial prioridad visual.

El objetivo es reducir errores de preparación.

---

# Once. Aceptación

Un pedido `PENDING_APPROVAL` tendrá:

**Aceptar**

y

**Rechazar**

Al presionar Aceptar:

```text
POST /orders/:id/accept
```

Una vez confirmado por backend:

```text
PENDING_APPROVAL → ACCEPTED
```

El pedido cambia inmediatamente de grupo.

No aplicar optimistic UI que muestre el pedido aceptado antes de recibir confirmación del servidor.

La respuesta del backend manda.

---

# Doce. Rechazo

Al presionar Rechazar, solicitar obligatoriamente un motivo.

Ejemplo:

```text
RECHAZAR PEDIDO

Motivo:

[ Producto agotado       ]
[ Sucursal por cerrar    ]
[ Problema con el pedido ]
[ Otro                   ]
```

Si selecciona Otro:

```text
Especificar motivo:
[________________________]
```

Utilizar el endpoint existente.

No permitir rechazo sin motivo.

---

# Trece. Preparación

Un pedido aceptado mostrará:

```text
[ INICIAR PREPARACIÓN ]
```

Esto genera:

```text
ACCEPTED → PREPARING
```

La aplicación actualizará la vista después de confirmación HTTP.

---

# Catorce. Pedido listo

En `PREPARING`:

```text
[ MARCAR COMO LISTO ]
```

Generará:

```text
PREPARING → READY
```

El pedido deberá aparecer inmediatamente en la sección Listos.

---

# Quince. Entrega

En `READY`:

```text
[ MARCAR ENTREGADO ]
```

Generará:

```text
READY → COMPLETED
```

Una vez completado desaparece de la operación activa y pasa al historial.

---

# Dieciséis. Cancelaciones

Mantener las reglas existentes:

```text
ACCEPTED → CANCELLED
PREPARING → CANCELLED
```

Una cancelación deberá solicitar confirmación.

Si el backend actualmente permite almacenar motivo de cancelación, utilizarlo.

Si todavía no existe motivo de cancelación persistente, analizar si conviene agregarlo reutilizando el esquema de auditoría existente.

No cambiar la máquina de estados sin justificarlo.

---

# Diecisiete. Impresión

Mantener inicialmente la impresión existente mediante navegador.

No desarrollar todavía:

- impresión silenciosa;
- servicio local;
- agente de impresión;
- integración directa con impresoras;
- KDS.

La regla continúa siendo:

```text
PENDING_APPROVAL
      ↓
NO IMPRIMIBLE

ACCEPTED
      ↓
IMPRIMIBLE
```

Después de aceptar:

```text
[ IMPRIMIR COMANDA ]
```

Debe generar una comanda sencilla y legible.

La impresión automática se considerará en otra fase.

---

# Dieciocho. Tiempo real

Reutilizar `OrdersGateway`.

Path existente:

```text
/api/socket.io
```

Reutilizar autenticación de `StaffSession`.

El empleado debe entrar automáticamente al room correspondiente:

```text
branch:{branchId}
```

Eventos existentes:

```text
order.created
order.status_changed
```

Cuando ocurra cualquiera:

```text
Socket event
      ↓
invalidar/refrescar pedidos
      ↓
GET API
      ↓
renderizar estado real
```

No asumir que Socket.IO garantiza por sí mismo que la pantalla esté sincronizada.

---

# Diecinueve. Reconexión

Esta parte es crítica para operación real.

Una tablet puede:

- perder Wi-Fi;
- cambiar de red;
- suspenderse;
- bloquear pantalla;
- recuperar conexión;
- dejar Socket.IO desconectado temporalmente.

Por ello:

Cuando Socket.IO reconecte:

```text
socket reconnect
      ↓
refetch completo
      ↓
sincronizar pantalla
```

Mostrar discretamente el estado:

```text
● Conectado
```

o

```text
○ Reconectando...
```

La pérdida del socket no debe impedir que las acciones HTTP continúen funcionando si existe conectividad con la API.

---

# Veinte. Historial

Agregar una sección:

```text
PEDIDOS ACTIVOS | HISTORIAL
```

Historial permitirá consultar:

- completados;
- rechazados;
- cancelados.

Mostrar al menos:

- folio;
- fecha;
- hora;
- cliente;
- total;
- estado final.

Permitir abrir el pedido para consultar sus detalles.

No permitir modificar pedidos terminales.

---

# Veintiuno. Búsqueda

Agregar búsqueda por:

- folio;
- cliente;
- teléfono, si el endpoint existente lo permite.

La búsqueda no debe descargar miles de pedidos al frontend.

Utilizar paginación/cursor existente.

---

# Veintidós. Auditoría

El frontend no deberá generar artificialmente el historial.

Todas las transiciones deberán continuar pasando por:

```text
OrderService.transitionOrder()
```

El backend deberá continuar registrando:

- pedido;
- estado anterior;
- estado nuevo;
- operador;
- fecha/hora;
- motivo cuando corresponda.

La aplicación puede mostrar posteriormente esta información, pero jamás será responsable de crear la auditoría.

---

# Veintitrés. Concurrencia

Considerar explícitamente este escenario:

Tablet uno:

```text
ACEPTAR
```

Tablet dos:

```text
RECHAZAR
```

sobre el mismo pedido simultáneamente.

El backend ya resuelve esto mediante optimistic locking.

La nueva aplicación debe manejar correctamente `409`.

Ante un conflicto:

No mostrar un error técnico.

Mostrar algo similar a:

```text
El pedido ya fue actualizado desde otro dispositivo.
```

Y realizar inmediatamente:

```text
refetch
```

Nunca intentar forzar la transición.

---

# Veinticuatro. Seguridad

La separación de frontend NO sustituye la seguridad del backend.

Todas las operaciones deben continuar protegidas server-side.

Verificar:

```text
StaffSession
      ↓
Staff
      ↓
Branch
      ↓
Order.branchId
```

Un empleado de una sucursal no deberá poder obtener pedidos de otra modificando:

- URL;
- request;
- JavaScript;
- parámetros;
- body;
- query string.

ADMIN será la única excepción cuando las reglas actuales explícitamente lo permitan.

---

# Veinticinco. Separación del frontend público

Después de que Fatboy Pedidos funcione correctamente, limpiar el frontend público.

Eliminar del build público, cuando corresponda:

- `BranchOrdersView`;
- login operativo de Staff;
- componentes exclusivos de operación;
- acciones internas sobre pedidos;
- dependencias utilizadas exclusivamente por Fatboy Pedidos.

**No eliminar código antes de verificar que haya sido migrado correctamente.**

Orden:

```text
copiar/migrar
      ↓
adaptar
      ↓
probar nueva aplicación
      ↓
desplegar
      ↓
verificar
      ↓
eliminar del frontend público
```

---

# Veintiséis. Lo que permanece en el Menú Fatboy

El menú público deberá conservar:

- catálogo;
- categorías;
- productos;
- carrito;
- autenticación de clientes;
- checkout;
- creación del pedido;
- perfil;
- pedidos activos;
- pedidos anteriores;
- tracking;
- Socket.IO para seguimiento del cliente.

Por ejemplo:

```text
Cliente crea pedido
        ↓
PENDING_APPROVAL
        ↓
"Esperando confirmación de la sucursal"
        ↓
Sucursal acepta
        ↓
ACCEPTED
        ↓
Cliente recibe actualización
        ↓
"Tu pedido fue aceptado"
```

El cliente nunca necesita conocer ni cargar la interfaz operativa.

---

# Veintisiete. PWA

Preparar Fatboy Pedidos como PWA.

Objetivo:

En las tablets de las sucursales se podrá instalar como aplicación.

El empleado verá:

```text
Fatboy Pedidos
```

en la pantalla principal del dispositivo.

Al abrirlo deberá sentirse como una aplicación operacional y no como una página web genérica.

Implementar:

- manifest;
- nombre;
- iconos;
- `display: standalone`;
- theme;
- instalación PWA.

No implementar offline transaccional.

**Nunca permitir cambios de estado offline.**

Los pedidos requieren confirmación real del servidor.

---

# Veintiocho. Sesión persistente

La aplicación estará instalada en dispositivos del negocio.

Evitar que el empleado tenga que iniciar sesión constantemente durante el mismo periodo operacional.

Reutilizar la duración y renovación de `StaffSession` existente.

Si actualmente la sesión tiene una duración poco adecuada para una terminal de sucursal, documentar el comportamiento antes de modificarlo.

No implementar sesiones eternas.

---

# Veintinueve. Responsive

Prioridad:

```text
Tablet
Desktop
Móvil
```

Debe funcionar en móvil, pero no diseñar toda la experiencia alrededor de una pantalla telefónica.

Botones operacionales grandes.

Evitar:

- controles diminutos;
- menús complejos;
- tablas enormes;
- hover como única interacción;
- acciones críticas demasiado juntas.

---

# Treinta. Diseño visual

Mantener identidad Fatboy, pero distinguir claramente esta aplicación del menú comercial.

Debe transmitir:

**herramienta de trabajo**

más que:

**página de restaurante**.

Priorizar:

- contraste;
- velocidad;
- lectura;
- estados;
- folios;
- hora;
- productos;
- acciones.

No llenar la aplicación de animaciones decorativas.

La velocidad operacional tiene prioridad sobre efectos visuales.

---

# Treinta y uno. Indicadores de tiempo

Cada pedido activo deberá mostrar claramente:

```text
6:42 PM
Hace 8 min
```

El tiempo transcurrido es operacionalmente más importante que la fecha completa.

Los pedidos que llevan demasiado tiempo deberán poder destacarse visualmente.

En esta fase puede realizarse solamente en frontend.

No convertir todavía esto en un sistema de SLA o métricas.

---

# Treinta y dos. Orden de pedidos

Por defecto, ordenar los pedidos operativos del más antiguo al más reciente dentro de cada estado.

El objetivo es evitar que pedidos antiguos queden enterrados.

Un pedido nuevo no debe hacer desaparecer visualmente uno que lleva demasiado tiempo esperando.

---

# Treinta y tres. Administración

Fatboy Pedidos no reemplaza `AdminCatalogView`.

No introducir aquí:

- edición de productos;
- precios;
- categorías;
- promociones;
- fotografías;
- configuración del catálogo.

Administración y operación son conceptos diferentes.

Fatboy Pedidos debe permanecer enfocado.

---

# Treinta y cuatro. Primera versión funcional

La versión inicial se considerará funcional cuando permita:

```text
LOGIN STAFF
      ↓
IDENTIFICAR SUCURSAL
      ↓
VER PEDIDOS
      ↓
RECIBIR PEDIDO EN TIEMPO REAL
      ↓
ABRIR
      ↓
ACEPTAR / RECHAZAR
      ↓
IMPRIMIR
      ↓
PREPARANDO
      ↓
LISTO
      ↓
ENTREGADO
      ↓
HISTORIAL
```

Nada más es requisito crítico para la primera versión.

---

# Treinta y cinco. Fuera de alcance

No desarrollar todavía:

- KDS;
- pantallas independientes de cocina;
- estaciones por área;
- POS;
- inventario;
- asignación de cocineros;
- impresoras automáticas;
- impresión silenciosa;
- tiempos por estación;
- delivery;
- repartidores;
- rutas;
- analítica avanzada;
- notificaciones push complejas;
- WhatsApp;
- integración con plataformas externas.

Estas funcionalidades podrán consumir posteriormente el mismo motor de pedidos.

---

# Treinta y seis. Estrategia de implementación

## Fase cero — Auditoría

Antes de modificar código:

Analizar:

- estructura actual;
- `BranchOrdersView`;
- API utilizada por esa vista;
- autenticación Staff;
- Socket.IO;
- componentes reutilizables;
- variables de entorno;
- configuración CORS;
- configuración Vite;
- despliegue Coolify.

Documentar qué puede reutilizarse directamente.

No comenzar reescribiendo.

---

## Fase uno — Crear aplicación

Crear el segundo frontend React/Vite/TypeScript.

Configurar:

- API base URL;
- Socket.IO;
- variables de entorno;
- routing;
- autenticación;
- manejo global de sesión.

---

## Fase dos — Migrar operación existente

Tomar como referencia `BranchOrdersView`.

No copiar ciegamente.

Extraer y adaptar:

- login Staff;
- consulta de pedidos;
- acciones;
- socket;
- impresión.

Eliminar dependencias del menú público.

---

## Fase tres — Nueva UX operacional

Construir:

- pantalla principal;
- agrupación por estados;
- tarjetas;
- detalle;
- botones operativos;
- alertas;
- estados de conexión;
- tiempos transcurridos.

---

## Fase cuatro — Historial

Implementar:

- pedidos terminales;
- búsqueda;
- paginación;
- detalle histórico.

---

## Fase cinco — PWA

Agregar instalación como aplicación.

Probar principalmente en tablet Android.

---

## Fase seis — Seguridad

Intentar explícitamente:

- acceder sin sesión;
- utilizar token cliente;
- utilizar token Staff inválido;
- consultar otra sucursal;
- cambiar `branchId`;
- modificar `orderId`;
- saltar estados;
- modificar estados terminales;
- reutilizar sesión vencida.

La seguridad deberá seguir dependiendo del backend.

---

## Fase siete — Concurrencia

Abrir el mismo pedido en dos clientes.

Probar:

```text
aceptar vs rechazar
```

y:

```text
cambiar estado simultáneamente
```

Verificar manejo correcto de `409`.

---

## Fase ocho — Tiempo real

Probar:

- pedido nuevo;
- aceptación;
- preparación;
- listo;
- completado;
- desconexión Wi-Fi;
- reconexión;
- suspensión de tablet;
- reanudación.

Después de reconectar, la interfaz deberá representar el estado real de PostgreSQL.

---

## Fase nueve — Separación definitiva

Cuando Fatboy Pedidos esté validado:

Eliminar del frontend público los módulos exclusivamente operativos.

Realizar build del menú.

Inspeccionar que el nuevo bundle público no dependa de `BranchOrdersView` ni de componentes exclusivos de Staff.

---

## Fase diez — Despliegue

Crear un servicio adicional en Coolify para Fatboy Pedidos.

Resultado:

```text
SERVICIO 1
Frontend Menú

SERVICIO 2
Frontend Fatboy Pedidos

SERVICIO 3
Backend NestJS

SERVICIO 4
PostgreSQL
```

La infraestructura existente determinará si PostgreSQL aparece administrativamente como servicio independiente, pero conceptualmente seguirá siendo una sola base de datos.

Configurar dominio operativo.

Ejemplo:

```text
pedidos.fatboymexicali.com
```

Configurar correctamente:

- HTTPS;
- CORS;
- API URL;
- Socket URL;
- WebSocket upgrade;
- variables de producción.

---

# Treinta y siete. Pruebas de aceptación

Antes de declarar terminada la implementación realizar como mínimo este recorrido real:

Cliente entra al menú.

Cliente inicia sesión.

Cliente crea pedido para Américas.

Pedido obtiene folio.

Fatboy Pedidos de Américas recibe el pedido sin refrescar manualmente.

Otra sucursal no puede verlo.

Empleado abre el pedido.

Empleado acepta.

Cliente recibe actualización.

Empleado imprime.

Empleado marca En preparación.

Cliente recibe actualización.

Empleado marca Listo.

Cliente recibe actualización.

Empleado marca Entregado.

Pedido desaparece de activos.

Pedido aparece en historial.

`OrderStatusHistory` contiene todas las transiciones y el Staff responsable.

Después:

crear otro pedido y rechazarlo.

Verificar motivo.

Finalmente:

desconectar la tablet de Internet, cambiar un pedido desde otro dispositivo, reconectar la tablet y verificar que se resincronice automáticamente.

---

# Treinta y ocho. Criterio arquitectónico obligatorio

Durante el desarrollo mantener esta regla:

> Fatboy Pedidos es una nueva interfaz para el motor existente, no un nuevo motor de pedidos.

No duplicar:

- modelos;
- tablas;
- estados;
- lógica;
- seguridad;
- sockets;
- historial;
- reglas de negocio.

La fuente de verdad continúa siendo:

```text
NestJS
   ↓
Prisma
   ↓
PostgreSQL
```

Los frontends son consumidores.

---

# Resultado final esperado

Al terminar deberán existir claramente tres piezas:

### Menú Fatboy

Aplicación pública.

```text
CLIENTE
↓
Explora
↓
Compra
↓
Envía pedido
↓
Sigue pedido
```

### Fatboy Pedidos

Aplicación interna operacional.

```text
SUCURSAL
↓
Recibe
↓
Acepta / Rechaza
↓
Imprime
↓
Prepara
↓
Marca listo
↓
Entrega
```

### Backend Fatboy

Núcleo común.

```text
Autenticación
Sucursales
Pedidos
Estados
Seguridad
Auditoría
Tiempo real
Base de datos
```

Esta separación deberá permitir que posteriormente agreguemos:

```text
KDS
POS
impresión automática
notificaciones
analítica
otras estaciones
```

sin volver a modificar conceptualmente el menú público.

## Principio final

**No reconstruir lo que ya funciona.**

Primero auditar el proyecto actual, reutilizar el motor robusto de pedidos que ya existe y construir sobre él la nueva interfaz operacional.

El objetivo de esta etapa es exclusivamente conseguir una separación limpia:

**Menú para el cliente.**

**Fatboy Pedidos para el negocio.**

**Un solo backend y una sola fuente de verdad para ambos.**