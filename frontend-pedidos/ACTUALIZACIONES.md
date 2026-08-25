# Actualizaciones de Fatboy Pedidos

## Alcance y primera instalación puente

La versión `0.2.4` y las anteriores no contienen `electron-updater`; por lo tanto, no pueden actualizarse solas. Cada equipo existente debe instalar manualmente **una vez** la versión puente `0.2.5`. Desde esa versión, las siguientes actualizaciones pueden detectarse, descargarse e instalarse desde la aplicación.

La versión de `frontend-pedidos/package.json` es la única fuente de verdad. Nunca se debe reutilizar una versión ya distribuida ni reemplazar sus binarios.

## Arquitectura

- Proveedor: GitHub Releases del repositorio `LACMMXLI/appmenu2026fatboy`.
- Windows: instalador NSIS generado por `electron-builder`.
- Runtime: `electron-updater` en el proceso principal, después de que la ventana abre.
- Seguridad del renderer: preload con `contextBridge`; no se habilita `nodeIntegration` y se conserva `contextIsolation`/sandbox.
- Instalación: exclusivamente cuando el usuario pulsa **Reiniciar y actualizar**. `autoInstallOnAppQuit` está deshabilitado.
- Cierre seguro: toda mutación HTTP al backend y toda impresión Electron se registra como operación crítica. Si alguna sigue activa, la instalación se pospone hasta que termine.
- Persistencia del canal: `update-settings.json` dentro de `app.getPath('userData')` (actualmente `%APPDATA%\@fatboy-pos\frontend-pedidos`).
- Diagnóstico: `logs/updater.log` dentro del mismo `userData`.

Una falla de red, GitHub, metadata, checksum o descarga sólo cambia el estado del actualizador y se registra. No se cierra la aplicación ni se sustituye la versión instalada.

## Canales

- `stable` usa `latest.yml` y sólo acepta Releases normales.
- `pilot` usa `pilot.yml`, permite Releases prerelease y requiere versiones SemVer como `0.2.6-pilot.1`.
- Los downgrades automáticos están deshabilitados en ambos canales.

El canal sólo puede cambiarlo un usuario ADMIN desde **Impresora → Aplicación de escritorio**. El equipo piloto debe dejarse en `Pilot`; los demás permanecen en `Stable`.

## Preparar una versión pilot

Ejemplo para la versión posterior a la instalación puente:

```powershell
npm version 0.2.6-pilot.1 --workspace frontend-pedidos --no-git-tag-version
npm run lint:pedidos
npm run test:pedidos
npm run build:pedidos:desktop
npm --prefix frontend-pedidos run package:desktop:pilot
```

Verificar en `frontend-pedidos/release/pilot/`:

- `Fatboy-Pedidos-0.2.6-pilot.1-x64.exe`
- `Fatboy-Pedidos-0.2.6-pilot.1-x64.exe.blockmap`
- `pilot.yml`

Crear manualmente un GitHub Release con tag `v0.2.6-pilot.1`, marcarlo **prerelease** y adjuntar exactamente esos tres assets. No usar `--publish always` en una estación de desarrollo. No agregar los binarios a Git.

## Promover a stable

Después de completar la prueba piloto, usar el mismo commit funcional, retirar el sufijo prerelease y volver a construir:

```powershell
npm version 0.2.6 --workspace frontend-pedidos --no-git-tag-version
npm run lint:pedidos
npm run test:pedidos
npm run build:pedidos:desktop
npm --prefix frontend-pedidos run package:desktop:stable
```

Verificar en `frontend-pedidos/release/stable/`:

- `Fatboy-Pedidos-0.2.6-x64.exe`
- `Fatboy-Pedidos-0.2.6-x64.exe.blockmap`
- `latest.yml`

Crear un Release normal con tag `v0.2.6` y adjuntar esos tres assets. El build stable es una versión SemVer posterior a `0.2.6-pilot.1`; nunca se vuelve a publicar la misma versión. Un equipo que deje de ser piloto debe cambiar su canal a `Stable` para recibir la versión normal.

## Firma de Windows

Actualmente no existe un certificado Authenticode configurado y los instaladores salen `NotSigned`. No se incluye ni se inventa un certificado.

Para habilitar firma, guardar en los secretos del entorno de compilación/CI:

- `WIN_CSC_LINK`: ruta segura, URL temporal o contenido base64 del certificado `.pfx`/`.p12`.
- `WIN_CSC_KEY_PASSWORD`: contraseña del certificado.

`electron-builder` detecta esas variables y firma ejecutables/instalador. Antes de publicar, comprobar `Get-AuthenticodeSignature` y mantener el mismo publisher en versiones futuras. La versión puente sin firma valida la descarga por SHA-512; después de instalar una versión firmada, `electron-updater` podrá exigir continuidad del publisher mediante el `app-update.yml` generado.

## Prueba obligatoria A → B

Esta prueba requiere dos versiones distintas y un Release accesible; un draft de GitHub no es visible para `electron-updater`.

1. Instalar A (`0.2.5`) en una PC de prueba y cambiar su canal a `Pilot`.
2. Confirmar que A abre, inicia sesión, consulta pedidos e imprime una prueba.
3. Publicar B (`0.2.6-pilot.1`) como prerelease con el `.exe`, `.blockmap` y `pilot.yml` generados juntos.
4. Abrir A. Confirmar en `updater.log`: versión instalada, canal, búsqueda y versión encontrada.
5. Confirmar que la interfaz sigue operable mientras descarga y que muestra progreso.
6. Confirmar el mensaje **Hay una actualización lista para instalar**.
7. Iniciar una impresión o mutación de pedido y pulsar **Reiniciar y actualizar**. Debe mostrarse que la instalación fue pospuesta; sólo debe reiniciar después de concluir la operación.
8. Confirmar que B abre y muestra `0.2.6-pilot.1`, conserva sesión/configuración local y vuelve a consultar pedidos.

### Interrupción de Internet

1. Reinstalar A y borrar cualquier descarga pendiente del caché del updater si fuera necesario.
2. Iniciar la descarga de B y desconectar la red cuando exista progreso.
3. Confirmar que se registra el error, no aparece ningún error técnico al empleado y A continúa aceptando pedidos/impresiones locales disponibles.
4. Cerrar y abrir A: debe seguir reportando `0.2.5` y arrancar normalmente.
5. Restaurar Internet y pulsar **Buscar actualizaciones**; la descarga debe reiniciarse o reanudarse según el caché válido.

## Rollback

No se habilitan downgrades automáticos. El rollback seguro es una corrección hacia delante: revertir el cambio defectuoso en código, incrementar PATCH (por ejemplo `0.2.7`) y publicar esa nueva versión. Así todos los equipos reciben una versión mayor y el historial sigue siendo auditable.

Si una emergencia exige volver literalmente a una versión anterior, hacerlo manualmente sólo después de respaldar configuración/datos locales, desinstalar la versión afectada e instalar el asset histórico verificado. No reemplazar assets de un Release existente ni publicar metadata que declare una versión ya usada.
