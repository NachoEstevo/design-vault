# Design Vault

**Turn your inspiration library into design decisions.**

Agent skills for designing with references you chose yourself. Capture images from X with context, retrieve a few that fit each project, and turn those ideas into an interface that works.

**Current release: local capture and retrieval.** The planned hosted mode lets anyone request design guidance derived from the owner's private references, without a reference gallery or original-image downloads. People can also run their own vault. See the [private inspiration service architecture](docs/private-cloud.md); the cloud service is not connected or deployed yet.

[Install](#install) · [How it works](#how-it-works) · [Capture references](docs/capture.md) · [Storage](docs/storage.md) · [Add a skill](CONTRIBUTING.md)

## What's included

| Directory | Purpose |
| --- | --- |
| [`skills/design-vault`](skills/design-vault/SKILL.md) | Find, select, and apply references from a private local library. |
| [`extension`](extension) | Design Shelf: capture images from X in Chrome or Brave, with notes, categories, and tags. |
| [`templates`](templates/SKILL.template.md) | A starting point for a future skill with its own scope. Not an installable skill. |
| [`docs`](docs) | Setup, capture, architecture, storage, and current limitations. |
| [`tests`](tests) | Synthetic fixtures and behavioral checks. No personal library. |

**One skill is available today.** Additional skills can live in `skills/<name>/`. See [contributing](CONTRIBUTING.md) for possible future additions; they are not implemented or required to use Design Vault.

## Install

You need **Python 3.10+** with SQLite FTS5, an agent that can run scripts and view images, and a local library exported by Design Shelf. The skill itself does not need Node, Google Drive, or API keys.

### From a clone

```sh
git clone https://github.com/NachoEstevo/design-vault.git
cd design-vault
python scripts/install.py --vault-root "/path/to/Design Shelf"
```

Windows PowerShell:

```powershell
./scripts/install-design-vault.ps1 -VaultRoot "$HOME/Downloads/Design Shelf"
```

The installer copies only the skill into Codex's skills directory, respects `CODEX_HOME`, and **refuses to overwrite an existing installation**. Configuration is written to the installed copy, outside this repo. Start a new agent session if the skill has not appeared yet.

For another agent that supports `SKILL.md` folders, specify its skills directory:

```sh
python scripts/install.py --vault-root "/path/to/Design Shelf" --skills-root "/path/to/skills"
```

You can also copy `skills/design-vault` manually, duplicate `vault.example.json` as `vault.json` in the installed copy, and set `vault_root`. This does not install a skill in ChatGPT or guarantee equivalent tool access in every agent.

### Install now with npx from GitHub

With Node 22+ and Python 3.10+ installed, you can install directly from this repository without an npm registry release:

```sh
npx --yes --package=github:NachoEstevo/design-vault design-vault --vault-root "/path/to/Design Shelf"
```

This runs the same installer and preserves existing installations. For reproducible installs, append a reviewed commit or tag after the GitHub package name, for example `github:NachoEstevo/design-vault#8b1747f`.

### npm registry: prepared, not published yet

The package is prepared as `@nachoestevo/design-vault`, exposing the `design-vault` command with no npm runtime dependencies. **It is not published to the npm registry yet.** Name availability and publishing permissions must be verified before release.

After publication:

```sh
npx @nachoestevo/design-vault --vault-root "/path/to/Design Shelf"
```

Or install the command globally:

```sh
npm install -g @nachoestevo/design-vault
design-vault --vault-root "/path/to/Design Shelf"
```

This command needs Node 22+ and still requires Python 3.10+. It does not download Python or run an automatic install hook. The package includes the skill and installer only, without the extension, tests, or library. See [publishing](docs/publishing.md) to test the package locally before release.

### Optional contact sheets

Search works with the Python standard library. Contact sheets additionally need Pillow:

```sh
python -m pip install Pillow
```

Without Pillow, the agent can open a few selected originals directly. Check your installation with:

```sh
python "/path/to/skills/design-vault/scripts/vault.py" status
```

`status` reports reference, image, and category counts. It does not upload files or run image analysis.

## Use it

```text
Use $design-vault to create a warm, simple bakery landing page.
Show three products and a demo order flow.
Choose references for the hero, product cards, and order form.
```

```text
Use $design-vault to improve this page's footer.
Keep the existing visual direction and search only for references this section needs.
```

Codex uses `$design-vault`; other agents use their own invocation mechanism. The skill proposes typography, establishes composition and hierarchy, and can generate backgrounds or assets through ImageGen **when that tool is available and useful**. It does not bundle a generation service or provider credentials.

## How it works

```text
Like on X → note + category → private folder
                                    ↓
                         local metadata index
                                    ↓
                    references for each needed component
                                    ↓
                 a few images inspected → design + review
```

1. **Map the page's needs.** A landing page might need one layout reference, another for cards, and another for a contact form. Do not add sections just because they appear in a screenshot.
2. **Search before opening originals.** A local SQLite index searches notes, tags, categories, and previously saved visual descriptions. Search is textual, with common English and Spanish vocabulary expansion. It is not universal visual search and does not use embeddings.
3. **Keep selection small and varied.** Usually review up to 12 visual candidates in total and open 3–5 originals per design. Selection favors relevance, diversity, recency, and less recent use. Variety depends on the available library.
4. **Preserve continuity.** A session keeps its selection; a new project can explore another direction. Each selected reference has a role and retains its source link.
5. **Record what was actually observed.** The agent can describe an image it inspected. The `describe` command stores those observations; it does not perform vision itself.
6. **Build and check the result.** Guidelines cover concrete copy, typography, useful card content, footers, visible motion, reduced motion, and responsive review.

Edit the [design preferences](skills/design-vault/references/guidelines.md) and [typography catalog](skills/design-vault/references/typography.md) in your installation. An explicit brief and the project's brand take precedence over defaults.

Details: [architecture](docs/architecture.md) and [skill operations](skills/design-vault/references/operations.md).

## Your library stays yours

**This repo contains no inspiration images, personal notes, or shared reference collection.** Everyone connects their own library. Capturing a reference preserves its context and source; it does not grant rights to reuse the image as a website asset.

The skill reads local files. Drive for desktop can synchronize them, and private R2 storage can hold a backup. Neither is connected automatically by installing the skill. Assets generated for a project stay in that project, separate from the vault.

There is no telemetry in the skill or extension code. Capture downloads images from X's CDN; your agent and external generation tools may have their own data handling. Review which references you supply to them.

Local configuration, originals, notes, databases, thumbnails, credentials, and sessions stay out of Git. See [storage and private R2](docs/storage.md).

## Capture references with Design Shelf

1. Open `chrome://extensions` or `brave://extensions`, enable Developer mode, and load the `extension` directory unpacked.
2. In Brave, open Design Shelf and choose **Use Downloads**. Chrome can also connect a dedicated folder.
3. Reload X. Liking a post with images opens a modal for a note, category, tags, or skipping the save.
4. Connect that local folder to Design Vault.

Only images belonging to the post are captured, excluding quoted posts. Skipping keeps the like without saving files. A note is required to save in the current version. Failed saves remain pending for explicit retry.

[Full capture, Drive, and recovery guide](docs/capture.md). The extension is not published in a browser store; live extraction depends on X's current DOM.

## Development

Extension tests require Node 22+ and npm. The Python skill does not.

```sh
npm ci
npm test
npm run check
python -m unittest discover -s tests -p "test_*.py" -v
python scripts/check-public.py
```

Synthetic browser checks:

```sh
npx playwright install chromium
npm run test:browser
```

Checks cover save recovery, path validation, installation without overwrites, reproducible selection, and a synthetic 800-image library. Synthetic tests do not verify authenticated live X, native external-folder permissions, or actual Drive/R2 synchronization. The publication check inspects tracked files and is not a guarantee of detecting every secret.

## Credits and license

The skill-folder organization and presentation were informed by [Leonxlnx's Taste Skill](https://github.com/Leonxlnx/taste-skill). This project includes no Taste code, screenshots, or reference collection and is not affiliated with it.

Code and instructions are [MIT licensed](LICENSE). Library images retain their original rights and terms; this repository's license does not cover them.
