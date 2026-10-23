# Fondos y assets con ImageGen

Usar la herramienta de generación de imágenes que esté realmente disponible en la sesión, con su esquema documentado. La skill no requiere una API key para una herramienta integrada. No instalar un SDK ni pasar a una API/CLI de pago automáticamente si falta la herramienta. Si existe una skill ImageGen en ese entorno, aplicar su guía relevante.

Elegir e inspeccionar primero las referencias. Para imágenes locales, abrir cada referencia elegida con la herramienta de imagen antes de enviarla como contexto. En entornos con el esquema `image_gen.imagegen`, usar `referenced_image_paths` si todos los inputs tienen rutas locales, o `num_last_images_to_include` mínimo suficiente si algún input no tiene ruta; nunca ambos. Para una creación sin referencias visuales de entrada, omitir ambos. En otro entorno, seguir el mecanismo documentado allí.

Definir un encargo breve:

- Función: fondo de hero, textura de card, ilustración, objeto o asset transparente.
- Referencias: qué aporta cada imagen y qué debe conservarse del diseño propio.
- Dirección: composición, paleta, materiales y grado de detalle.
- Integración: proporción, áreas libres para texto, contraste y transparencia real cuando haga falta.
- Restricciones: evitar texto accidental, logos ajenos, contenido innecesario y una copia literal de la referencia.

Generar una propuesta inicial, inspeccionarla y ajustar con un cambio concreto si hace falta. Para un asset raster pedido usar ImageGen; para formas simples o un sistema SVG existente usar sus recursos nativos cuando corresponda. Una imagen del hero no debe contener el texto o botones funcionales de la interfaz salvo que el pedido sea una maqueta raster.

Mostrar la imagen generada con el mecanismo nativo. En Codex la herramienta puede guardar bajo su directorio de imágenes generadas; copiar el output elegido al proyecto si se va a consumir allí, verificando la ruta real devuelta por la herramienta. No inventar parámetros de destino ni dejar un asset de proyecto solo en caché. Conservar la transparencia y evitar sobreescribir assets existentes sin un pedido de reemplazo.

Guardar el prompt final y las rutas del output en los entregables del proyecto. No agregar generaciones al vault automáticamente: esa colección refleja referencias elegidas por el usuario. Si falta ImageGen, una especificación de generación se identifica como pendiente, nunca como imagen ya creada.
