# Arquitectura

## Tres responsabilidades

- **Design Shelf:** detecta el like, muestra el modal y guarda archivos locales. El modo Descargas usa `chrome.downloads`; el modo carpeta usa handles del navegador. Su almacenamiento privado conserva la cola de recuperación.
- **Design Vault:** lee `reference.json`, construye un índice SQLite local y selecciona referencias. La búsqueda no modifica los originales. `describe` escribe análisis separados en `_design-vault/descriptions`.
- **El agente:** interpreta el pedido, abre unas pocas imágenes, decide qué aplicar, implementa el diseño y revisa el resultado. El script no ejecuta visión ni genera una página por sí mismo.

## Contrato de la biblioteca

```text
Design Shelf/
  cards/
    2026-10-10_12345678901/
      image-01.png
      note.md
      reference.json
  _design-vault/
    descriptions/
```

`reference.json` guarda identidad del post, fuente, fecha, categoría, etiquetas, nota y nombres reales de las imágenes. La categoría organiza la carpeta; las etiquetas aportan búsqueda sin duplicar archivos. Los fixtures de `tests/` muestran el formato con contenido sintético.

Cada imagen tiene un ID `<postId>:<índice>`. Dos imágenes del mismo post pueden tener estilos diferentes. El buscador limita el aporte de un mismo post y usa hashes conocidos para evitar repeticiones.

## Escala y continuidad

La actualización revisa firmas y relee metadatos modificados, sin abrir los píxeles originales. La búsqueda usa FTS5, pondera señales textuales y selecciona desde un conjunto acotado. Crear una lámina sí abre las candidatas; los análisis visuales se hacen solo después de inspeccionar originales.

Las sesiones conservan firma de búsqueda, candidatos, semilla y selección. Si cambia la búsqueda se usa otra sesión. El agente coordina las sub-sesiones por componentes; no existe agregación automática ni garantía de cobertura semántica de toda la biblioteca.

El índice, las miniaturas y el historial viven fuera del vault, en la caché local del equipo. No sincronizar una base abierta. Las descripciones verifican vigencia frente al archivo observado. Notas y metadatos se tratan como datos, no como instrucciones ejecutables.

## Configuración

Prioridad de raíz: argumento `--root` → variable `DESIGN_VAULT_ROOT` → `vault.json` en la skill → `vault.example.json`. Los argumentos globales `--root` y `--cache` van antes del subcomando. La caché no puede estar dentro del vault.

El instalador genera configuración en la skill instalada, no dentro del checkout público. No actualiza ni reemplaza instalaciones existentes. Para actualizar, revisá cambios y preservá tu `vault.json` y preferencias antes de copiar una versión nueva.

No hay backend, base remota, autenticación de Google, sincronización R2 automática ni colección pública incluida.
