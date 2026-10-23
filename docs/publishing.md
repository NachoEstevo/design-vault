# Publicar el paquete npm

El repo público y el registro npm son publicaciones separadas. El paquete está preparado como `@nachoestevo/design-vault`, versión `0.1.0`, pero no se publica automáticamente al pushear. No hay tokens npm en el repo ni un workflow de publicación habilitado.

Antes de publicar, comprobar que la cuenta npm controla ese scope, que el nombre está disponible y que la versión es la que se quiere distribuir. La configuración `publishConfig.access=public` define acceso público para el paquete con scope. Si el nombre cambia, actualizar README, `package.json` y lockfile juntos.

## Revisar y probar sin publicar

```sh
npm ci
npm test
npm run check
python -m unittest discover -s tests -p "test_*.py" -v
python scripts/check-public.py
npm pack --dry-run
```

`files` en `package.json` es una lista explícita: instalador, comando, instrucciones, configuración de ejemplo, referencias y scripts de la skill. npm agrega README, licencia y metadatos. No deben aparecer `vault.json`, imágenes, notas, bases, credenciales, extensión, pruebas ni archivos de proyectos personales.

Generar un paquete local y ejecutar su comando:

```sh
npm pack --pack-destination output
npm exec --yes --package=./output/nachoestevo-design-vault-0.1.0.tgz -- design-vault --help
```

Creá `output` si no existe. Para probar una instalación real, usá una biblioteca sintética y un directorio de skills temporal, distintos de tu instalación habitual:

```sh
npm exec --yes --package=./output/nachoestevo-design-vault-0.1.0.tgz -- design-vault --vault-root "/ruta/a/vault-de-prueba" --skills-root "/ruta/a/skills-de-prueba"
```

La carpeta del vault debe existir. Repetir la instalación debe fallar conservando la configuración previa. `DESIGN_VAULT_PYTHON` permite indicar un ejecutable Python concreto si no está en PATH.

## Publicación futura

Cuando el nombre, versión y archivos estén revisados, autenticar npm con el flujo del proveedor y ejecutar `npm publish --access public`. No compartir tokens por el chat ni commitear `.npmrc` con credenciales. La publicación no se ejecutó como parte del preparado del repo.

Después, probar `npx @nachoestevo/design-vault --help` desde otra carpeta, instalar en un destino temporal y revisar el contenido del tarball remoto. Recién entonces actualizar el README para quitar el estado de pendiente.
