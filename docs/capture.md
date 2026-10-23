# Capturar referencias con Design Shelf

Extensión local de Chrome y Brave: like en un post con imágenes de X → modal con nota, categoría y etiquetas → imágenes y contexto en tu biblioteca.

## Brave

1. Abrí `brave://extensions`, activá modo de desarrollador y cargá la carpeta `extension` del repo como extensión descomprimida.
2. Abrí Design Shelf y elegí **Usar Descargas**. No requiere `showDirectoryPicker` ni flags de Brave.
3. Recargá las pestañas de X y guardá una referencia. Se descargan imágenes, `note.md` y `reference.json` en `<Descargas>/Design Shelf/<categoría>/<fecha>_<post>/`.
4. Si querés sincronizar con Drive para escritorio, conectá únicamente esa carpeta dedicada.

La galería del modo Descargas lee una copia privada en el navegador; los archivos exportados son los que puede leer la skill. Borrar datos de la extensión o desinstalarla borra esa copia, pero no los archivos descargados. Los cambios externos no se reflejan en esta galería. Para reconstruirla desde archivos, usá el modo carpeta en Chrome.

Los guardados se completan cuando terminan las imágenes, la nota y los metadatos. Si algo falla, queda pendiente y se puede reintentar conservando lo completado. `reference.json` registra el nombre real que Brave asignó a cada imagen, incluso si se renombró o agregó un número por conflicto.

Conservá `note.md`, `reference.json` y la estructura por categorías. Si cambiás la ruta de descargas de Brave, también cambia el destino de las nuevas referencias: revisá la carpeta sincronizada. No cambies de destino mientras haya pendientes.

## Chrome

1. Abrí `chrome://extensions`, activá modo de desarrollador y cargá la carpeta `extension`, que contiene `manifest.json`.
2. Abrí Design Shelf, elegí **Conectar carpeta** y seleccioná una carpeta dedicada. El navegador pide permiso de lectura/escritura.
3. Recargá X y dale like a un post con imágenes.

Chrome de escritorio 122+ para el modo carpeta. No necesitás Node, servidor ni cuenta de Google para usar la extensión. Si el navegador necesita renovar el permiso, la biblioteca muestra **Renovar acceso**.

## Qué se guarda

```text
Design Shelf/
  cards/
    2026-10-10_12345678901/
      image-01.png
      note.md
      reference.json
      .pending.json
```

La categoría principal organiza la carpeta. Las etiquetas permiten buscar estilos o componentes sin repetir imágenes. Podés crear categorías desde el modal.

Guardar requiere nota, categoría y al menos una imagen. **Omitir**, cerrar y Escape conservan el like sin guardar. Los posts sin imágenes, videos y GIFs no abren el modal. Solo se capturan imágenes del propio post, excluyendo el citado. Se solicita la mayor resolución disponible en el CDN.

Los duplicados conservan el primer guardado. Las descargas tienen límites de tiempo y tamaño. Los archivos ajenos o modificados en un guardado parcial se preservan y se informa el conflicto: revisá la carpeta antes de reintentar. No hay una transacción con otros programas que modifiquen esos archivos simultáneamente.

## Biblioteca y recuperación

La galería permite filtrar por categoría y buscar por nota, etiqueta, autor o texto del post. Cada referencia conserva imágenes, nota y fuente.

Los guardados fallidos también necesitan la cola de la instalación original para reintentarse; reinstalar puede perderla. **No desinstales con pendientes.** Recargá la extensión y X después de una actualización y usá **Reintentar guardados** para completar lo pendiente.

Drive para escritorio sincroniza los archivos por separado; abrir Drive en una pestaña no configura sincronización. La extensión no pide credenciales de Google ni prueba una subida efectiva. En otro equipo, descargá los originales localmente para que la skill pueda abrirlos.

## Permisos y verificación

Manifest V3; permisos `storage` y `downloads`; content scripts en X/Twitter y acceso al CDN `pbs.twimg.com`. No hay backend, telemetría ni código remoto ejecutable en esta extensión.

Las pruebas automatizadas sirven un feed sintético, respuestas PNG controladas y usan handles OPFS reales. Cubren cola, archivos, galería, omitir, duplicados, renombrado y recuperación del worker. **No prueban** el selector nativo de carpeta externa, el DOM autenticado actual de X, las imágenes reales de X ni una sincronización efectiva con Drive/R2.
