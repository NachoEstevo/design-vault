# Capture references with Design Shelf

A local Chrome/Brave extension: like an X post with images → add a note, category, and tags → save images and context into your library.

## Brave

1. Open `brave://extensions`, enable Developer mode, and load this repository's `extension` directory unpacked.
2. Open Design Shelf and choose **Use Downloads**. No directory picker or Brave flags are required.
3. Reload X and capture a reference. Images, `note.md`, and `reference.json` are downloaded to `<Downloads>/Design Shelf/<category>/<date>_<post>/`.
4. To use Drive for desktop, synchronize only that dedicated directory.

Downloads-mode gallery reads a private browser copy; exported files are what the skill reads. Uninstalling or clearing extension data removes the gallery copy, not downloaded files. External edits do not update this gallery. Chrome folder mode can rebuild a gallery from files.

A save completes only after images, note, and metadata have finished. Failures remain pending for retry, preserving completed downloads. `reference.json` records actual image filenames, including renames and browser-added collision numbers.

Keep `note.md`, `reference.json`, and the category directory structure. Changing Brave's download location also changes new references' destination. Review synchronization settings and do not switch destinations while saves are pending.

## Chrome

1. Open `chrome://extensions`, enable Developer mode, and load the `extension` directory containing `manifest.json`.
2. Open Design Shelf, choose **Connect folder**, and select a dedicated directory. Grant the browser read/write access.
3. Reload X and like a post with images.

Folder mode requires desktop Chrome 122+. The extension needs no Node, server, or Google account. If access expires, the library shows **Renew access**.

## Saved files

```text
Design Shelf/
  cards/
    2026-10-10_12345678901/
      image-01.png
      note.md
      reference.json
      .pending.json
```

The primary category determines the directory. Tags support style/component search without copying images. Create categories from the modal.

Saving requires a note, category, and at least one image. **Skip**, close, and Escape keep the like without saving. Text-only posts, videos, and GIFs do not open the modal. Images from quoted posts are excluded. The extension requests the highest available CDN resolution.

Duplicates preserve the first save. Downloads have time and size limits. Foreign or changed files in a partial save are preserved and reported as a conflict. Inspect the directory before retrying; there is no transaction with other applications modifying files simultaneously.

## Library and recovery

Filter the gallery by category or search notes, tags, authors, and post text. Each reference preserves images, note, and source.

Failed saves also rely on the original installation's recovery queue. **Do not uninstall with pending saves.** Reload the extension and X after updating, then use **Retry saves** to complete pending work.

Drive for desktop synchronizes files independently; opening Drive in a browser does not configure synchronization. The extension does not request Google credentials or verify uploads. Download originals locally on other machines before using the skill.

## Permissions and verification

Manifest V3; `storage` and `downloads` permissions; content scripts on X/Twitter and image access to `pbs.twimg.com`. No backend, telemetry, or remotely executed code is included.

Automated tests use a synthetic feed, controlled PNG responses, and genuine OPFS directory handles. They cover queues, files, gallery, skip, duplicates, renamed downloads, and worker recovery. They do **not** verify native external-folder selection, authenticated live X DOM, real X images, or actual Drive/R2 synchronization.

## Optional private cloud sync

Open **Cloud vault**, import your private owner JSON configuration or enter the HTTPS service URL and owner upload token, then connect. Grant access only to your service origin. **Sync saved references** uploads existing local references; subsequent captures upload after a successful local save. A failed upload leaves local files untouched and can be retried. Disconnect preserves local files and remote objects.

The hosted reading skill needs no extension or token. It receives descriptions and tags. New images remain metadata-only until the owner reviews a few originals with their own Codex/Claude and synchronizes those observations. See [private cloud setup](private-cloud.md).
