# Private R2 service

The shared service is live at `https://design-vault.nachoestevo.workers.dev`. Anyone can install the skill and search selected descriptions without an invitation. Owners can deploy the same code with their own private bucket.

## Privacy contract

Original pixels cannot be sent to another person's local model while remaining inaccessible to that person. Shared mode therefore returns **reviewed descriptions and tags**, not images. The user's Codex or Claude interprets them. Descriptions and tags are public response data even though the originals and raw notes remain private. They are not a confidential sharing channel.

There are no AI API calls, embeddings, provider secrets, image download routes, signed URLs, public bucket domains or client-side reader tokens. The public repository contains code and guidelines, not the personal library.

```text
Owner capture → local save → authenticated upload → private R2 objects + catalog
Owner agent → selected local originals → reviewed descriptions → authenticated sync
Reader brief → POST /v1/search → 3–5 reference descriptions → reader's own model
```

New captures have metadata-only coverage until the owner reviews them with their own agent. The service never invents a visual analysis. Existing observations survive metadata-only uploads. Owners can inspect a bounded new batch, use the local skill's `describe` command, then synchronize with `scripts/upload-vault.py`.

## Deploy your own

Requirements: Node 22+, a Cloudflare account with R2 available, and permission to deploy a Worker. No inference key is needed.

1. Clone the repository and run `npm ci`.
2. Run `npx wrangler login`. If the localhost callback fails, use `npx wrangler login --device`.
3. Create a private R2 bucket with `npx wrangler r2 bucket create your-vault`. Keep public access disabled.
4. Edit `service/wrangler.jsonc`: choose a unique Worker name and set `r2_buckets[0].bucket_name` to your bucket. The `VAULT` binding name stays unchanged. Select the intended account through `CLOUDFLARE_ACCOUNT_ID` when needed; do not commit account configuration or secrets.
5. Generate a random upload credential of at least 32 printable characters with your password manager. Run `npx wrangler secret put OWNER_TOKEN --config service/wrangler.jsonc` and supply it at the prompt. Never paste it in a chat, source file or URL.
6. Run `npx wrangler deploy --config service/wrangler.jsonc`. Keep the secret and returned HTTPS service URL in a private owner configuration file outside the repository:

   ```json
   {"service_url":"https://your-vault.workers.dev","upload_token":"YOUR_PRIVATE_RANDOM_OWNER_TOKEN"}
   ```

7. In Design Shelf, open **Cloud vault**, import the private file or enter its values, and click **Connect cloud vault**. Allow only that service origin, then **Sync saved references**. Local saving remains the recovery source. Failed uploads can be retried without duplicating references.
8. Readers install with `python scripts/install.py --service "https://your-vault.workers.dev"` or the equivalent npx arguments. They never receive your upload credential.

For an existing exported local library, run:

```sh
python scripts/upload-vault.py --root "/path/to/Design Shelf" --service "https://your-vault.workers.dev" --dry-run
python scripts/upload-vault.py --root "/path/to/Design Shelf" --service "https://your-vault.workers.dev" --credentials "/private/owner.json"
```

The first command reads metadata only. The second reads validated originals, uploads content-addressed objects, and commits a reference only after all its images exist. Existing posts with different image content are preserved and rejected for manual review. Repeating an identical upload is safe. The importer also synchronizes current reviewed descriptions; the extension does not run vision.

Use `--post-id <known-post-id>` to synchronize one reviewed local reference. Interrupted imports consult the authenticated inventory and do not retransmit existing originals.

## API and ownership

| Route | Access | Result |
| --- | --- | --- |
| `GET /health` | Anonymous | Schema, mode and `inference: false`. |
| `POST /v1/search` | Anonymous | Bounded reference descriptions, tags and coverage. |
| `GET /admin/status` | Owner Bearer token | Counts only. |
| `GET /admin/inventory` | Owner Bearer token | Post IDs and object digests for resumable imports; never anonymous. |
| `PUT /admin/objects/<sha256>` | Owner | Validate digest, type and size; immutable original storage. |
| `POST /admin/references` | Owner | Commit complete metadata and reviewed observations. |

Search accepts `query`, `components` (up to eight), `session`, and `limit` (1–12, default 5). It searches notes privately and ranks tags, categories and existing observations. Results explicitly allowlist fields; raw notes, original post IDs, author, post copy, paths and object keys are excluded. A maximum of two images per post and digest deduplication keep selection varied. Session-based weighting changes alternatives between projects; the client caches an exact query/session to preserve a design's direction. It does not track cross-user usage or perform semantic vision search.

The R2 catalog is private and capped at 5 MB / 5,000 references. Reader responses are bounded by selection size. Catalog commits use conditional R2 writes to prevent concurrent uploads from losing references. Briefs are not persisted by the service. An isolate caches the private catalog for 30 seconds, so another isolate's new upload may take up to that interval to enter search.

Owner credentials are stored in extension-private settings and the Worker secret binding. X content scripts can save references but cannot configure cloud access, trigger a full sync, inspect owner credentials or fetch arbitrary URLs. Disconnect removes the active credential; originals are preserved. Rotate a compromised token with `wrangler secret put OWNER_TOKEN`, then reconnect the extension. Browser storage and owner's machine access remain part of the trust boundary.

## Limits and cost

The service has no AI inference bill. Workers and R2 requests/storage still count against Cloudflare's quotas. The default native reader limiter is 30 requests per minute per IP and is approximate across locations; it is not a global spending cap. Free-plan limits and availability apply. Do not enable a paid plan merely to run the demo. Monitor usage in the Cloudflare dashboard before wider distribution. There is no automatic upgrade or billing integration in this project.

No original-deletion API is exposed. Failed partial uploads can leave unreferenced private objects. Automatic garbage collection and retention/version history are not implemented. Removing an item from a local folder does not remove its cloud record. Keep the exported local library as your recoverable source.

## Validation

`npm run test:service` exercises native local workerd/R2 behavior, including idempotency, concurrent commits and preservation of observations. Unit tests cover access control, strict public output, body limits and failed retries. Production deployment, private bucket settings, actual imports and authenticated X capture must also be checked separately; local test success alone does not prove these.

References: [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).
