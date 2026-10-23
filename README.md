# Design Vault

**Tu biblioteca de inspiración, convertida en decisiones de diseño.**

Skills para agentes que diseñan con referencias elegidas por vos. Guardá imágenes de X con contexto, recuperá unas pocas según lo que necesita cada proyecto y llevá esas ideas a una interfaz que funcione.

[Instalar](#instalar-design-vault) · [Cómo funciona](#cómo-funciona) · [Capturar referencias](docs/capture.md) · [Almacenamiento](docs/storage.md) · [Crear otra skill](CONTRIBUTING.md)

## Qué incluye

| Carpeta | Para qué sirve |
| --- | --- |
| [`skills/design-vault`](skills/design-vault/SKILL.md) | Buscar, seleccionar y aplicar referencias de una biblioteca local privada. |
| [`extension`](extension) | Design Shelf: capturar imágenes de X desde Chrome o Brave, con nota, categoría y etiquetas. |
| [`templates`](templates/SKILL.template.md) | Punto de partida para una nueva skill con su propio alcance. No se instala como skill. |
| [`docs`](docs) | Instalación, captura, arquitectura, almacenamiento y límites actuales. |
| [`tests`](tests) | Pruebas con datos sintéticos, sin tu biblioteca personal. |

Hoy hay **una skill disponible**. El repo admite otras en `skills/<nombre>/`; las ideas para ampliarlo están en [la guía de contribución](CONTRIBUTING.md). No hace falta dividir la skill actual para usarla.

## Instalar Design Vault

Necesitás **Python 3.10+** con SQLite FTS5, un agente que pueda ejecutar scripts y abrir imágenes, y una carpeta local exportada por Design Shelf. Node y Google Drive no son requisitos de la skill.

### Codex, desde una copia del repo

```sh
git clone https://github.com/NachoEstevo/design-vault.git
cd design-vault
python scripts/install.py --vault-root "/ruta/a/Design Shelf"
```

### npm / npx: preparado, todavía sin publicar

El paquete está preparado como `@nachoestevo/design-vault`, con el comando `design-vault`, sin dependencias npm de ejecución. **Todavía no está publicado en el registro npm.** La disponibilidad del nombre y los permisos de publicación se revisan al publicarlo.

Después de publicar una versión, la instalación será:

```sh
npx @nachoestevo/design-vault --vault-root "/ruta/a/Design Shelf"
```

O una instalación global del comando:

```sh
npm install -g @nachoestevo/design-vault
design-vault --vault-root "/ruta/a/Design Shelf"
```

El comando sigue necesitando Python 3.10+; no lo descarga ni instala. El paquete lleva únicamente la skill y su instalador, sin extensión, pruebas ni vault. No usa scripts de instalación automática. Para probar el paquete antes de publicarlo, ver [publicación](docs/publishing.md).

### Configuración y otros agentes

En Windows también podés usar:

```powershell
./scripts/install-design-vault.ps1 -VaultRoot "$HOME/Downloads/Design Shelf"
```

El instalador copia solo la skill, respeta `CODEX_HOME` y **se detiene si ya existe una instalación**. Tu configuración se escribe en la copia instalada, fuera del repo. Reiniciá la sesión del agente si la skill aún no aparece.

Para otro agente que admita carpetas `SKILL.md`, elegí su directorio de skills:

```sh
python scripts/install.py --vault-root "/ruta/a/Design Shelf" --skills-root "/ruta/a/skills"
```

También podés copiar manualmente `skills/design-vault`, duplicar `vault.example.json` como `vault.json` en la copia instalada y ajustar `vault_root`. Esto no instala una skill en ChatGPT ni garantiza herramientas equivalentes en todos los agentes.

Las láminas de miniaturas requieren **Pillow**, una dependencia opcional:

```sh
python -m pip install Pillow
```

Sin Pillow, el agente puede buscar y abrir unas pocas imágenes directamente. Para comprobar la instalación:

```sh
python "/ruta/a/skills/design-vault/scripts/vault.py" status
```

`status` informa cantidad de posts, imágenes y categorías. No sube archivos ni analiza imágenes con un modelo.

## Usarla

```text
Usá $design-vault para crear una landing de una panadería.
Quiero algo cálido y simple, con tres productos y un pedido de demostración.
Elegí referencias para el hero, las cards y el formulario.
```

```text
Usá $design-vault para mejorar el footer de esta página.
Conservá la dirección visual existente y buscá solo lo que haga falta para ese bloque.
```

En Codex se invoca como `$design-vault`; en otros agentes usá su mecanismo de invocación. La skill propone tipografías, define jerarquía y composición, y puede generar fondos o assets mediante ImageGen **si esa herramienta está disponible y aporta algo**. No incluye un servicio de generación ni credenciales de proveedores.

## Cómo funciona

```text
Like en X → nota + categoría → carpeta privada
                                     ↓
                         índice local de metadatos
                                     ↓
                   referencias relevantes por componente
                                     ↓
                   pocas imágenes vistas → diseño + revisión
```

1. **Entiende qué necesita la pieza.** Una landing puede necesitar una referencia de composición, otra para cards y otra para el contacto. No agrega secciones por copiar una captura.
2. **Busca sin abrir todos los originales.** Usa notas, etiquetas, categorías y descripciones visuales ya guardadas en un índice SQLite local. La búsqueda es textual, con vocabulario frecuente en español e inglés; no es un buscador visual universal ni usa embeddings.
3. **Selecciona con variedad acotada.** Normalmente revisa hasta 12 candidatas visuales en total y abre 3–5 originales por diseño. Favorece pertinencia, diversidad, novedades y menor uso reciente; no garantiza resultados distintos si faltan opciones.
4. **Mantiene continuidad.** Una sesión conserva la selección; un nuevo proyecto puede explorar otra. Cada referencia tiene un rol explícito y conserva su enlace original.
5. **Aprende de lo observado.** El agente puede guardar una descripción de una imagen que realmente abrió. `describe` persiste esas observaciones; no hace visión por sí mismo.
6. **Implementa y comprueba.** La guía incluye copy concreto, tipografía, cards con contenido, footers, movimiento visible, reducción de movimiento y revisión responsive.

Podés editar las [preferencias de diseño](skills/design-vault/references/guidelines.md) y el [catálogo tipográfico](skills/design-vault/references/typography.md) en tu instalación. El brief explícito y la identidad del proyecto tienen prioridad sobre las preferencias por defecto.

Más detalle: [arquitectura](docs/architecture.md) y [operaciones de la skill](skills/design-vault/references/operations.md).

## Tu biblioteca sigue siendo tuya

**Este repo no contiene imágenes de inspiración, notas personales ni una biblioteca compartida.** Cada persona conecta la suya. La captura conserva el enlace y contexto original; guardar una referencia no otorga derechos para reutilizarla como asset de un sitio.

La skill trabaja sobre archivos locales. Drive para escritorio puede sincronizarlos; R2 puede servir como respaldo privado. Ninguno de los dos se conecta automáticamente al instalar la skill. Los assets generados para un proyecto quedan en ese proyecto, separados del vault.

No hay telemetría en el código de la skill o la extensión. La captura descarga imágenes del CDN de X; el agente o una herramienta externa de generación pueden tener su propio tratamiento de datos. Revisá qué referencias les das como entrada.

La configuración local, los originales, las notas, el índice, las miniaturas, las credenciales y las sesiones quedan fuera de Git. [Opciones de almacenamiento y R2](docs/storage.md).

## Capturar referencias con Design Shelf

1. En `chrome://extensions` o `brave://extensions`, activá modo de desarrollador y cargá la carpeta `extension` descomprimida.
2. En Brave, abrí Design Shelf y elegí **Usar Descargas**. En Chrome podés conectar una carpeta dedicada.
3. Recargá X. Al dar like a un post con imágenes aparece un modal para escribir una nota, elegir categoría y etiquetas, o saltar el guardado.
4. Conectá esa carpeta local a Design Vault.

Solo se guardan imágenes del post, sin las del citado. Omitir conserva el like y no guarda archivos. La versión actual requiere una nota para guardar. Los fallos quedan pendientes para reintentar desde la biblioteca.

[Guía completa de captura, Drive y recuperación](docs/capture.md). La extensión no está publicada en una tienda; su funcionamiento sobre X depende del DOM actual de esa plataforma.

## Desarrollo

Para las pruebas de extensión necesitás Node 22+ y npm; la skill no los usa.

```sh
npm ci
npm test
npm run check
python -m unittest discover -s tests -p "test_*.py" -v
python scripts/check-public.py
```

Prueba sintética de navegador:

```sh
npx playwright install chromium
npm run test:browser
```

Las pruebas incluyen recuperación de guardados, validación de rutas, instalación sin sobrescritura, selección reproducible y un catálogo sintético de 800 imágenes. Una prueba sintética no verifica el DOM autenticado de X, los permisos del selector nativo ni una sincronización real de Drive/R2. El control de publicación revisa los archivos versionados; no es una garantía de detección de todos los secretos.

## Créditos y licencia

La organización por skills y el enfoque de presentación toman como referencia el repo [Taste Skill de Leonxlnx](https://github.com/Leonxlnx/taste-skill). Este proyecto no incluye código, capturas ni bibliotecas de Taste y no está afiliado a ese proyecto.

Código e instrucciones bajo [MIT](LICENSE). Las imágenes de cada biblioteca conservan sus derechos y condiciones originales; la licencia de este repo no las incluye.
