# Agregar o mejorar skills

Cada skill instalable vive en `skills/<nombre>/` y tiene un único `SKILL.md` como entrada. Mantené las instrucciones centrales cortas; separá operaciones, criterios o ejemplos cuando solo se necesiten en ciertos pedidos.

```text
skills/
  design-vault/
    SKILL.md
    vault.example.json
    agents/openai.yaml
    references/
    scripts/
```

Para una skill nueva, partí de [la plantilla](templates/SKILL.template.md). No agregues carpetas de skills vacías ni habilidades que solo prometan algo futuro. Elegí un alcance que tenga usos reales y comprobá su descubrimiento e invocación.

Posibles extensiones, todavía **no implementadas**:

| Nombre posible | Alcance que justificaría separarla |
| --- | --- |
| `component-vault` | Recuperar y adaptar patrones de componentes con sus estados. |
| `motion-vault` | Diseñar y verificar coreografías desde referencias de movimiento reales. |
| `brand-vault` | Trabajar con identidad, tipografía y material propio de una marca. |

Hoy Design Vault ya cubre decisiones de componentes y movimiento estático observado dentro de su flujo. Separarlas tendría sentido con recursos o procedimientos propios; no dupliques las mismas reglas en varias skills. Una captura estática no sirve como prueba de una animación.

## Antes de abrir un cambio

- Usá datos sintéticos en las pruebas. No publiques referencias, notas, credenciales, sesiones ni rutas personales.
- Guardá configuración de ejemplo; `vault.json` real queda ignorado.
- Ejecutá los comandos de desarrollo del README y revisá el diff completo.
- Documentá comportamiento y límites observables, sin claims de compatibilidad sin probar.
- Si una dependencia nueva es necesaria, explicá qué aporta y en qué entorno se instala.

El CI comprueba los archivos versionados con `scripts/check-public.py`. No reemplaza revisar qué se está publicando, especialmente al incorporar binarios o material de terceros.
