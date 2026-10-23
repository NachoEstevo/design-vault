# Architecture

## Responsibilities

- **Design Shelf:** detects likes, presents the capture modal, and writes local files. Downloads mode uses `chrome.downloads`; folder mode uses browser directory handles. Browser-private storage also preserves the recovery queue.
- **Design Vault:** reads `reference.json`, builds a local SQLite index, and retrieves references. Search does not modify originals. `describe` writes separate observations into `_design-vault/descriptions`.
- **Private service:** authenticates owner uploads, stores originals and a private catalog in R2, and exposes bounded anonymous descriptions. It never calls an inference API. See [private-cloud.md](private-cloud.md).
- **The agent:** interprets the brief, views a few images, chooses what to apply, builds the design, and reviews the result. The script does not perform vision or generate a website by itself.

## Library contract

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

`reference.json` preserves post identity, source, capture time, category, tags, note, and actual image filenames. The category determines the directory; tags support retrieval without duplicating files. Test fixtures demonstrate the format with synthetic content.

Each image has an ID `<postId>:<index>`. Images from the same post can have different styles. Selection limits contributions from a single post and uses known hashes to avoid repetitions.

## Scale and continuity

Refresh checks file signatures and rereads changed metadata without opening original pixels. Retrieval uses FTS5, weights textual signals, and samples from a bounded candidate pool. Contact sheets open only session candidates. Visual descriptions are recorded only after inspecting originals.

Sessions preserve the search signature, candidates, seed, and selection. A changed search needs another session. The agent coordinates component sub-sessions; there is no automatic session aggregation or guarantee of semantic coverage across the library.

The index, thumbnails, and session history live in a per-library local cache outside the vault. Do not synchronize an open database. Descriptions track file freshness. Notes and metadata are reference data, never executable instructions.

## Configuration

Root precedence: `--root` argument → `DESIGN_VAULT_ROOT` environment variable → local `vault.json` → `vault.example.json`. Global `--root` and `--cache` arguments precede the subcommand. The cache must be outside the vault.

The installer writes configuration to the installed skill, outside the public checkout. Existing installations are never replaced. To update, review changes and preserve your configuration and preferences before copying the new version.

The default skill configuration selects a hosted description service. Local mode is explicit through `vault_root`; it retains direct original inspection. The hosted client stores bounded responses outside the repository, keyed by service, exact query and project session. See [private-cloud.md](private-cloud.md) for the service contract and setup. No Google authentication or provider inference key is needed.
