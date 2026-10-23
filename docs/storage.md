# Where files belong

| Material | Destination |
| --- | --- |
| Skills, extension, scripts, tests, and documentation | Public GitHub repository. |
| Originals, notes, `reference.json`, personal descriptions | Private local folder; Drive or private R2 as separate options. |
| SQLite, thumbnails, session history | Local cache, outside synchronized folders. |
| Project-generated assets | The project's directory and publication policy. |
| Credentials and real configuration | Outside Git, never in `SKILL.md`. |

## Local storage and Google Drive

The simplest workflow: the extension writes to a folder and the skill reads that same folder. Drive for desktop can synchronize the dedicated Design Shelf directory. In Brave, this is `<Downloads>/Design Shelf`.

On another machine, originals must be available locally. Neither the extension nor the skill checks whether Drive has finished uploading. The skill does not read browser-private extension storage.

## Private R2

The extension can upload saved originals and metadata through an owner-authenticated Worker. The shared skill receives selected descriptions and tags; it cannot download originals. Use [the service setup guide](private-cloud.md) to deploy your own private vault or import an existing library. No AI API runs in the service.

The native service stores immutable images under `v1/objects/` and a private catalog under `v1/private/`. This is separate from an optional file-preserving backup: native objects alone are not a drop-in local folder export. Keep your original Design Shelf folder for recovery.

- Keep the public `r2.dev` URL disabled and do not connect a public domain to a personal bucket.
- `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` is an authenticated S3 API endpoint; specify the bucket separately. It is not a public image URL.
- Desktop/CLI S3 copies do not require CORS. CORS does not make private storage public or replace authentication.
- You can upload files from the dashboard's **Objects** tab. For repeated copies, use an S3 tool such as rclone with a private profile scoped to the required bucket.
- Preview copy operations first. Avoid synchronization that deletes remote objects when a local file disappears.

Optional example, **after installing rclone and configuring a private remote named `vault-r2`** with provider Cloudflare, region `auto`, and your endpoint. This repo does not create credentials, install rclone, or upload anything automatically:

```sh
rclone copy "/path/to/Design Shelf" "vault-r2:design-vault/library" --exclude ".pending.json" --exclude "*.sqlite*" --exclude "*.db*" --dry-run
```

Review the file list before removing `--dry-run`. `copy` may replace an object with the same name when it changes: this is a replica, not backup history. Use a new dated prefix and a separately chosen retention policy for historical snapshots.

Restore into an empty directory before connecting the skill:

```sh
rclone copy "vault-r2:design-vault/library" "/path/to/restored-vault" --dry-run
```

Review and rerun without `--dry-run`. Preserve directories and filenames. Reference and description JSON remain private even when the original posts are public. Do not upload the machine's reconstructible cache.

This repo includes the public description-service address, but no account ID, upload token, private object endpoint, profile or credentials. Presigned URLs grant temporary object access; do not commit them as permanent references.

Sources: [R2 S3 API](https://developers.cloudflare.com/r2/api/s3/api/), [public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/), and [rclone with R2](https://developers.cloudflare.com/r2/examples/rclone/).
