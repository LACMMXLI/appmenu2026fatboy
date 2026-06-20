Pega esto en Codex:

Integra un módulo de **encuesta de satisfacción anónima** dentro del proyecto actual del **menú digital Fatboy**.

No crear una app nueva. No crear un backend separado. Usar la arquitectura existente del menú digital.

## Objetivo

Agregar una encuesta pública para clientes en:

`/encuesta`

El cliente responde de forma anónima, la respuesta se guarda en la base de datos existente y después se le redirige al menú principal.

También crear un panel admin para que yo pueda ver las respuestas en:

`/admin/encuestas`

## Requisitos de la encuesta pública

Ruta:

`/encuesta`

Debe ser mobile first, rápida, clara y fácil de contestar desde QR.

Mostrar texto:

“Encuesta anónima. No pedimos datos personales.”

Campos obligatorios:

* Sucursal: Venecia / San Marcos
* Calificación general: 1 a 5
* Calidad de comida: 1 a 5
* Atención del personal: 1 a 5
* Tiempo de espera: 1 a 5
* Limpieza del lugar: 1 a 5
* ¿Volverías a comprar?: Sí / No / Tal vez

Campo opcional:

* Comentario, máximo 500 caracteres

No pedir:

* Nombre
* Teléfono
* Correo
* Número de ticket
* Datos personales

## Después de enviar

Al enviar correctamente:

1. Guardar respuesta.
2. Bloquear doble envío.
3. Mostrar mensaje:

“Gracias por ayudarnos a mejorar.”

4. Mostrar botón:

“Ver menú”

5. Redirigir automáticamente al menú principal después de 2 o 3 segundos.

La redirección debe mandar a la ruta principal del menú existente, por ejemplo:

`/`

## Backend / API

Crear endpoint público:

`POST /api/survey-responses`

Debe:

* Validar campos obligatorios.
* Rechazar comentario mayor a 500 caracteres.
* Guardar fecha automática.
* Guardar user agent.
* Guardar IP como hash o parcialmente anonimizada.
* No guardar IP directa.
* Aplicar anti-spam básico.
* No requerir login para responder.

Anti-spam:

* Máximo 3 respuestas cada 10 minutos por IP hash.
* Evitar doble envío desde frontend.
* No usar cookies invasivas.

## Base de datos

Usar la base de datos existente del menú digital.

Crear modelo/tabla:

`SurveyResponse`

Campos:

* `id`
* `branch`
* `ratingGeneral`
* `ratingFood`
* `ratingService`
* `ratingWaitTime`
* `ratingCleanliness`
* `wouldReturn`
* `comment`
* `ipHash`
* `userAgent`
* `createdAt`

Índices:

* `branch`
* `createdAt`
* `ratingGeneral`

## Panel admin

Crear ruta:

`/admin/encuestas`

Debe estar protegida con el sistema admin existente.

Debe mostrar:

* Total de respuestas
* Promedio general
* Promedio comida
* Promedio atención
* Promedio espera
* Promedio limpieza
* Porcentaje de clientes que sí volverían
* Comentarios recientes
* Lista de respuestas completas

Filtros:

* Sucursal
* Fecha inicial
* Fecha final
* Calificación general
* Solo respuestas con comentario

Cada respuesta debe mostrar:

* Fecha
* Sucursal
* Calificación general
* Comida
* Atención
* Espera
* Limpieza
* ¿Volvería?
* Comentario

No mostrar:

* IP
* IP hash
* User agent
* Datos técnicos

## API admin

Crear endpoint protegido:

`GET /api/admin/survey-responses`

Debe usar la protección admin existente.

Debe aceptar filtros:

* `branch`
* `dateFrom`
* `dateTo`
* `ratingGeneral`
* `hasComment`

Debe regresar:

* Métricas resumidas
* Lista de respuestas ordenadas por más recientes primero

## Integración con el menú

Reutilizar:

* Branding actual de Fatboy
* Estilos actuales
* Componentes existentes
* Layout mobile
* Configuración actual de sucursales si existe
* Sistema admin existente
* Base de datos existente
* Variables de entorno existentes

Agregar acceso opcional desde el menú o admin:

* Link público a `/encuesta`
* Preparar ruta para QR:
  `https://menu.fatboymexicali.com/encuesta`

## Privacidad

La encuesta debe ser anónima.

Reglas:

* No pedir datos personales.
* No guardar IP directa.
* No mostrar datos técnicos en admin.
* Comentario opcional.
* Texto visible de encuesta anónima.
* Usar hash de IP solo para anti-spam.

## Diseño

Debe ser:

* Mobile first
* Limpio
* Rápido
* Profesional
* Botones grandes
* Fácil de contestar en menos de 1 minuto
* Compatible con QR
* Usar estrellas o escala clara de 1 a 5
* Usar tarjetas para separar secciones

## Entregables

Implementar:

* Ruta pública `/encuesta`
* Formulario funcional
* API pública para guardar
* Modelo/migración de base de datos
* Panel `/admin/encuestas`
* API admin para consultar
* Filtros
* Métricas
* Redirección al menú después de enviar
* Protección admin usando el sistema actual
* Validaciones
* Anti-spam básico

Importante:

No romper el menú actual.
No cambiar rutas existentes.
No crear otra aplicación.
No crear otro backend.
Integrar todo como módulo/extensión del menú digital existente.
