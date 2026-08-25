Quiero que implementes un sistema profesional, seguro y tolerante a fallos de actualizaciones automáticas para esta aplicación Electron.

IMPORTANTE: antes de modificar código, inspecciona completamente la estructura actual del proyecto, especialmente la configuración de Electron, `package.json`, proceso main, preload, IPC, sistema de build/empaquetado y cualquier configuración existente de `electron-builder`.

No asumas rutas, nombres de archivos ni arquitectura. Adáptate al proyecto existente.

## OBJETIVO

La aplicación ya está instalada y funcionando en equipos reales. Quiero que, a partir de las próximas versiones, pueda recibir actualizaciones sin tener que descargar e instalar manualmente un nuevo `.exe`.

La prioridad absoluta es:

ESTABILIDAD > SEGURIDAD > FACILIDAD DE ACTUALIZACIÓN

Una falla buscando o descargando una actualización NUNCA debe impedir que la aplicación abra y siga funcionando con la versión instalada.

## SISTEMA DE ACTUALIZACIÓN

Implementa el mecanismo utilizando `electron-updater` y la infraestructura de `electron-builder` que corresponda al proyecto.

El flujo esperado es:

Aplicación inicia normalmente.

Después del arranque, y sin bloquear la interfaz, verifica si existe una actualización.

Si no existe actualización:
no hacer nada molesto para el usuario.

Si existe:
descargarla en segundo plano.

Durante la descarga:
la aplicación debe continuar funcionando normalmente.

Cuando termine correctamente:
mostrar una notificación dentro de la aplicación indicando:

"Hay una actualización lista para instalar."

Agregar una opción:

"Reiniciar y actualizar"

Al seleccionarla, cerrar correctamente la aplicación e instalar la actualización.

NO instalar una actualización mientras exista una operación crítica que pueda provocar pérdida de información.

## GITHUB RELEASES

Quiero utilizar GitHub Releases como mecanismo de distribución, salvo que después de inspeccionar el proyecto exista una razón técnica importante para utilizar otra estrategia.

Repositorio:

LACMMXLI/appmenu2026fatboy

Los instaladores y archivos generados para actualización NO deben guardarse dentro del repositorio Git.

No quiero volver a tener archivos `.exe` grandes dentro del historial normal de Git.

Los binarios deben publicarse como assets de GitHub Releases.

Configura correctamente `electron-builder` para generar los archivos necesarios para que `electron-updater` pueda detectar y descargar nuevas versiones.

## VERSIONADO

Utilizar versionado semántico:

MAJOR.MINOR.PATCH

Ejemplo:

0.2.4
0.2.5
0.2.6

Nunca publicar una actualización con la misma versión que la instalada.

La versión definida en el proyecto debe ser la fuente de verdad.

La aplicación debe poder mostrar su versión instalada.

## CANALES DE ACTUALIZACIÓN

Quiero preparar la arquitectura para manejar por lo menos:

stable
pilot

`pilot` será utilizado para instalar primero las actualizaciones en una computadora o sucursal de prueba.

`stable` será utilizado para las instalaciones normales.

El objetivo es poder probar una versión en producción limitada antes de distribuirla al resto de las sucursales.

No implementes una arquitectura innecesariamente compleja si `electron-updater` ya proporciona una solución estándar para esto.

## SEGURIDAD Y TOLERANCIA A FALLOS

Una falla de actualización JAMÁS debe inutilizar la aplicación.

Maneja correctamente:

sin conexión a Internet,
timeout,
GitHub inaccesible,
release inexistente,
archivo incompleto,
descarga interrumpida,
metadata incorrecta,
versión inválida,
error durante la comprobación,
error durante la descarga.

En cualquiera de esos casos:

registrar el error,
cancelar el proceso de actualización si corresponde,
mantener instalada la versión actual,
permitir que la aplicación siga funcionando normalmente.

NO mostrar errores técnicos al empleado.

## LOGS

Agregar logs claros para diagnóstico.

Registrar como mínimo:

versión instalada,
canal,
inicio de búsqueda,
actualización encontrada,
versión disponible,
inicio de descarga,
progreso,
descarga terminada,
actualización lista,
inicio de instalación,
errores.

Nunca registrar tokens, credenciales ni información sensible.

## IPC Y SEGURIDAD DE ELECTRON

Si el renderer necesita conocer el estado de la actualización, utiliza la arquitectura segura existente de Electron.

No habilites `nodeIntegration` solamente para esta función.

No deshabilites `contextIsolation`.

Si existe preload, utiliza preload + `contextBridge` + IPC de manera segura.

Expón al renderer únicamente las funciones estrictamente necesarias.

## INTERFAZ

Integra la actualización con la interfaz existente.

No rediseñes la aplicación completa.

Necesito poder mostrar:

"Buscando actualización..."

"Descargando actualización..."

porcentaje de descarga cuando esté disponible.

"Actualización lista"

"Reiniciar y actualizar"

Los estados informativos no deben estorbar al flujo normal del POS.

## ACTUALIZACIÓN MANUAL

Además de la comprobación automática, agrega en el área apropiada de configuración/información:

Versión instalada: X.X.X

Canal: Stable/Pilot

Botón:

"Buscar actualizaciones"

Este botón debe utilizar exactamente el mismo mecanismo de actualización.

## CIERRE SEGURO

Antes de ejecutar `quitAndInstall()`, revisa cómo funciona actualmente la aplicación.

No provoques pérdida de:

pedidos,
impresiones pendientes,
información local,
operaciones en proceso.

Si existe una operación crítica, posponer el reinicio y comunicar que la actualización se instalará cuando sea seguro.

## FIRMA

Revisa cómo está configurada actualmente la firma de código.

No inventes certificados ni secretos.

Si todavía no existe firma para Windows, deja preparada la configuración compatible y documenta exactamente qué faltaría para habilitarla.

Nunca incluyas certificados, contraseñas o tokens privados dentro del repositorio.

## COMPATIBILIDAD

La implementación debe funcionar con las instalaciones Windows generadas por este proyecto.

No rompas:

impresión térmica,
comunicación con backend,
configuración de sucursal,
sesiones,
almacenamiento local,
pedidos,
inicio automático,
ni ninguna función existente de Electron.

## PRIMERA ACTUALIZACIÓN

Ten en cuenta que las instalaciones que ya existen fueron creadas antes de implementar este sistema.

Determina claramente si esas instalaciones pueden comenzar a actualizarse automáticamente o si será necesario instalar manualmente UNA última versión que ya incluya `electron-updater`.

Si se necesita esa instalación puente, indícalo claramente.

A partir de esa versión, las siguientes actualizaciones deberán poder realizarse automáticamente.

## NO HAGAS

No metas instaladores `.exe` al repositorio.

No uses Git LFS como sustituto del sistema de Releases para distribuir actualizaciones.

No hagas cambios destructivos.

No cambies dependencias no relacionadas.

No modifiques la lógica de impresión salvo que sea estrictamente necesario.

No cambies la arquitectura existente innecesariamente.

No publiques todavía una Release real sin mi autorización.

No hagas `git push` ni publiques archivos externos sin mi autorización.

## PROCEDIMIENTO DE TRABAJO

Primero inspecciona el proyecto.

Después explícame brevemente qué arquitectura de actualización encontraste y qué vas a modificar.

Luego implementa los cambios.

Ejecuta build, typecheck, lint y pruebas disponibles.

Genera localmente el instalador/artefactos necesarios para verificar que `electron-builder` funciona.

Comprueba que se generan correctamente los archivos de metadata requeridos por `electron-updater`.

Revisa el diff final buscando cambios accidentales.

## PRUEBA OBLIGATORIA

Diseña una prueba del flujo:

versión A instalada
→ versión B disponible
→ detección
→ descarga
→ actualización lista
→ reinicio
→ instalación
→ versión B inicia correctamente.

También prueba qué sucede si Internet desaparece durante la descarga.

La versión A debe continuar funcionando.

## RESULTADO FINAL

Al terminar, entrégame un reporte indicando:

qué archivos modificaste,
qué dependencias agregaste,
cómo quedó configurado `electron-updater`,
cómo funcionan `stable` y `pilot`,
cómo publicar una nueva versión,
qué archivos deben subirse a GitHub Release,
cómo probar primero una actualización en pilot,
cómo promoverla posteriormente a stable,
cómo regresar a una versión anterior si una actualización presenta problemas,
y cualquier paso manual que todavía sea necesario.

No declares el trabajo terminado simplemente porque compile.

La implementación se considera terminada solamente cuando el flujo completo de actualización esté preparado y exista un procedimiento reproducible para publicar y probar futuras versiones.