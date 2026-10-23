# Movimiento en landings

Preferencia personal: una landing puede ser cálida y profesional y tener movimiento visible. Elegir dos o tres recursos compatibles y diseñar su secuencia; no aplicar el mismo fade a todo ni copiar una demo de producto que no exista en el proyecto.

## Patrones adaptables

Estos patrones describen recursos de movimiento; no dependen de proyectos o rutas del autor. Elegir solo los que sirvan al contenido y comprobarlos en el navegador.

- **Entrada editorial:** palabras que ascienden desde una máscara, imágenes que se abren y luego se asientan. Mantener el texto seleccionable y accesible, con saltos naturales y stagger corto.
- **Profundidad de producto:** un frame entra con profundidad; un objeto manipulable representa información real del producto. La interacción debe tener un objeto y un motivo. No agregar stickers ni drag solo por decorar.
- **Piezas por capas:** una carpeta, fichas o packaging entran con una secuencia; al hover las piezas se levantan. Adaptar a entregables existentes, con lectura y función claras.

## Elegir y comprobar

1. Definir el momento principal (hero, obra o demostración) y qué debe reconocer el visitante. Una entrada orquestada puede durar más que el feedback de un control; no retrasar la acción para esperar la animación.
2. Separar movimiento de entrada y respuesta al puntero en wrappers o propiedades con dueños claros. Elegir transform/opacity por defecto. Una máscara con `clip-path` puede aportar valor en un título o imagen: comprobar recortes y rendimiento en el navegador objetivo, sin asumir que toda máscara es gratuita o está acelerada.
3. Probar a velocidad normal: el recurso elegido debe verse sin tener que buscarlo. Variar amplitud y ritmo según tamaño real, no fijar el mismo desplazamiento para un título, una imagen y un botón. Dar protagonismo a pocos momentos y conservar lectura estable entre ellos.
4. Comprobar ida y vuelta del hover, clic rápido, foco, touch, entrada por scroll y preferencia reducida que cambia durante la sesión. Los objetos no deben quedarse ocultos, superponerse al texto ni impedir abrir el contenido. Distinguir foco de teclado y foco por puntero: mostrar inmediatamente un reveal al tabular no debe desplazar un botón entre pointerdown y click. Probar acciones durante la entrada, no solo después de que todo se asiente. Mantener alternativas estáticas sin JS y sin APIs opcionales.
5. Grabar el flujo y revisar estados intermedios y finales. En títulos por palabras, comprobar también nombre accesible completo, selección de texto, acentos/descendentes y el máximo de dos líneas después de cargar la fuente. Dar margen de máscara vertical y horizontal a los glifos, especialmente con tracking negativo; compensarlo sin cambiar los saltos de línea. Quitar el recorte cuando termina la entrada y en estados estáticos, de foco o movimiento reducido. Una caja de texto que cabe no prueba que sus letras no estén cortadas: inspeccionar la tipografía renderizada.
