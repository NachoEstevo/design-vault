# Publishing to npm

The public repository and npm registry are separate publications. The package is prepared as `@nachoestevo/design-vault`, version `0.2.0`, but pushing does not publish it. There are no npm tokens or automatic publishing workflows in this repo.

Direct GitHub installation already works without registry publication: `npx --yes --package=github:NachoEstevo/design-vault design-vault --vault-root "/path/to/Design Shelf"`. Pin a reviewed commit/tag for reproducible installation. Both GitHub and tarball installs use the same Python installer.

Before release, verify scope ownership, name availability, and the intended version. `publishConfig.access=public` makes the scoped package public. Update README, `package.json`, and lockfile together if the name changes.

## Review and test without publishing

```sh
npm ci
npm test
npm run check
python -m unittest discover -s tests -p "test_*.py" -v
python scripts/check-public.py
npm pack --dry-run
```

The `files` allowlist includes only the installer, command, skill instructions, example configuration, references, and scripts. npm adds README, license, and package metadata. The tarball must not contain real configuration, images, notes, databases, credentials, extension code, tests, or private projects.

Create `output` if needed, then build and test a local package:

```sh
npm pack --pack-destination output
npm exec --yes --package=./output/nachoestevo-design-vault-0.2.0.tgz -- design-vault --help
```

Test an actual installation using an existing synthetic library and a temporary skills directory, separate from your regular installation:

```sh
npm exec --yes --package=./output/nachoestevo-design-vault-0.2.0.tgz -- design-vault --vault-root "/path/to/test-vault" --skills-root "/path/to/test-skills"
```

A repeat installation must fail while preserving configuration. `DESIGN_VAULT_PYTHON` can point to a specific Python executable when PATH discovery is insufficient.

## Future release

Once the name, version, and package files have been reviewed, authenticate through npm's own flow and run `npm publish --access public`. Never share tokens in chat or commit an `.npmrc` containing credentials. Preparing this repository did not publish the package.

After publication, test `npx @nachoestevo/design-vault --help` from a separate directory, install into a temporary destination, and inspect the remote tarball. Then remove the pending-publication notice from the README.
