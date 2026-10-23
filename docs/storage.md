# Dónde guardar los archivos

| Material | Destino |
| --- | --- |
| Skills, extensión, scripts, pruebas y documentación | GitHub público. |
| Originales, notas, `reference.json`, análisis personales | Carpeta privada local; Drive o R2 privado como opciones separadas. |
| SQLite, miniaturas e historial de sesiones | Caché local, fuera de la carpeta sincronizada. |
| Assets generados para un proyecto | Carpeta del proyecto. Publicarlos solo según ese proyecto. |
| Credenciales o configuración real | Fuera de Git; nunca dentro de `SKILL.md`. |

## Local y Google Drive

Es el flujo más directo: la extensión escribe en una carpeta y la skill lee esa misma carpeta. Si usás Drive para escritorio, sincronizá la carpeta dedicada de Design Shelf. En Brave, será `<Descargas>/Design Shelf`.

En otro equipo, los originales deben estar disponibles localmente. La extensión y la skill no comprueban si Drive terminó de subirlos. La skill tampoco lee el almacenamiento privado del navegador.

## R2 privado

R2 puede guardar un respaldo privado. Por sí solo no crea una carpeta local ni cambia el buscador: **esta versión de la skill no consume objetos remotos**. Para diseñar desde otro equipo hay que descargar una copia local y apuntar la skill a ella.

- Mantené deshabilitada la URL pública `r2.dev` y no conectes un dominio público al bucket personal.
- El endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` es una API S3 autenticada; el nombre del bucket se especifica por separado. No es una URL pública de imágenes.
- No necesitás habilitar CORS para copias mediante una herramienta S3 de escritorio/CLI. CORS no convierte un bucket privado en público ni sustituye autenticación.
- Podés subir archivos desde la pestaña **Objects** del dashboard. Para copias frecuentes conviene una herramienta S3 como rclone con un perfil privado, limitado al bucket necesario.
- Usá copia aditiva y revisá su simulación primero. Evitá sincronizaciones que borren objetos automáticamente al faltar un archivo local.

Ejemplo opcional, **después de instalar rclone y configurar un remote privado llamado `vault-r2`** con proveedor Cloudflare, región `auto` y tu endpoint. Este repo no crea credenciales, instala rclone ni ejecuta una subida por defecto:

```sh
rclone copy "/ruta/a/Design Shelf" "vault-r2:design-vault/library" --exclude ".pending.json" --exclude "*.sqlite*" --exclude "*.db*" --dry-run
```

Revisá el listado; quitá `--dry-run` para subir. `copy` puede reemplazar un objeto del mismo nombre si cambió: esto es una réplica de archivos, no un historial de backups. Para una copia histórica usá un prefijo nuevo por fecha y una política de conservación decidida aparte.

Restaurá a una carpeta vacía antes de conectar la skill:

```sh
rclone copy "vault-r2:design-vault/library" "/ruta/a/vault-restaurado" --dry-run
```

Revisá y ejecutá sin `--dry-run`. Conservá la estructura de carpetas y los nombres. Los JSON de referencias y descripciones siguen siendo privados aunque los originales provengan de posts públicos. No sincronices la caché reconstruible del equipo.

No se incluye ningún identificador de cuenta, endpoint personal, token, perfil ni configuración real en este repo. Una URL prefirmada da acceso temporal al objeto; no debe publicarse en documentación o commits como si fuera una referencia permanente.

Fuentes: [API S3 de R2](https://developers.cloudflare.com/r2/api/s3/api/), [buckets públicos](https://developers.cloudflare.com/r2/buckets/public-buckets/) y [rclone con R2](https://developers.cloudflare.com/r2/examples/rclone/).
