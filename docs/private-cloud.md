# Private inspiration service

**Architecture for the next implementation, not a deployed feature.** The current release captures and searches a local library. R2 has not been connected to the extension or skill. No personal library has been uploaded or made public.

## The product

Someone asks their coding agent to design a page or component. They install the skill, not a reference browser. The skill understands the intent and requests relevant visual guidance from the owner's inspiration service. The service consults the private collection internally and returns guidance the agent can apply.

There are two deployment profiles:

| Profile | Reader experience | Administration |
| --- | --- | --- |
| Hosted collection | Install the skill and describe a design task, without an invitation or library browsing. | The collection owner captures, uploads, and manages references. |
| Bring your own vault | Use the same skill against a self-hosted service, or retain local mode. | Install Design Shelf, connect your own service and private bucket, and manage your own collection. |

Do not confuse a private bucket with private delivery. Sending originals to another person's local agent makes those files available on their machine, even if the interface does not display them. A universal client-side token or an unadvertised image URL cannot prevent this.

For originals to remain private, image selection and visual interpretation must run **server-side**. That model returns derived design guidance rather than original files. This changes the remote mode's contract: the user's local agent receives the visual analysis, while local mode can inspect originals directly. If the local agent must receive original images, the product must explicitly accept that recipients can access them.

## Request flow

```text
User's brief
    → skill identifies intent and needed components
    → POST /v1/inspiration with a bounded design brief
    → service searches private metadata by component
    → service selects a small, diverse set of references
    → server-side model inspects only those images
    → validated design guidance returns to the agent
    → agent builds the requested page and reviews it
```

The consumer needs no bucket name, S3 credentials, private manifest, or personal notes. The service exposes no anonymous image-download, object-list, arbitrary-key, or presigned-URL endpoint. It must not return raw images, storage paths, base64 data, or source records in model output.

Example request contract:

```json
{
  "brief": "Warm bakery landing with three products and a simple order form",
  "components": ["hero", "product-cards", "order-form"],
  "constraints": ["minimal", "mobile-friendly"],
  "session": "bakery-home-v1"
}
```

Example derived response, illustrating the contract rather than a real model result:

```json
{
  "direction": "Warm editorial composition with large product photography",
  "components": [
    {
      "role": "product-cards",
      "recommendations": [
        "Give each bread image enough room to show its shape",
        "Keep quantity controls adjacent to the product name"
      ]
    }
  ],
  "coverage": ["Hero and product cards covered; no relevant form reference"],
  "session": "bakery-home-v1"
}
```

No response should claim unsupported interaction, fonts, results, or business facts. Do not fill missing component coverage with unrelated references.

## Retrieval at scale

- Build the private metadata index at ingestion, not by opening every original during a design request.
- Track images independently, including source post, category, tags, current visual description, and file freshness.
- Map intent to component queries, deduplicate the shared candidate budget, and usually inspect 3–5 originals for the whole request.
- Preserve direction during iterations through a short-lived service session. Explore alternatives only for new projects or explicit changes.
- Keep personal notes server-side. Share only purpose-built design guidance, not an opaque dump of notes or post text.
- Treat briefs, captions, and notes as untrusted data. Enforce output schemas and response limits outside the model. A prompt alone is not a privacy control.

## Owner capture and upload

The extension remains an administration tool, separate from the consumer skill.

1. The owner connects their own service URL with an owner-scoped upload credential. The backend binds that deployment to its private R2 bucket.
2. Capture keeps the current note, category, tags, image selection, and skip flow.
3. Save locally first and queue a separate remote upload. Show distinct states: **Saved locally**, **Uploading**, **Synced**, or **Retry upload**. A failed upload must not claim remote success or discard the local copy.
4. Upload selected image bytes through the authenticated owner API. Never give a website content script S3 credentials or an arbitrary fetch capability.
5. Validate MIME, size, filenames, IDs, and ownership server-side. Stage objects, then commit reference metadata only after every image is present. Use an idempotency key so retries cannot duplicate captures.
6. Index committed metadata. Partial uploads stay outside search and are cleaned up with an explicit retention policy.

The settings UI should expose **Local folder** and **My cloud vault** when both actually work. Connecting cloud storage should ask for a service URL and scoped upload credential, not a raw R2 endpoint. The hosted collection's consumer path has no upload credential or library-management UI.

Credentials belong in extension-private background storage and server secret bindings, never in content scripts, URLs, logs, the skill, or the public repo. Limit extension host permissions to the configured service. A new connection must not silently move pending captures to another owner or bucket.

## Anonymous access and operating limits

Anyone can use the hosted reader without an invitation. That makes abuse control and cost boundaries part of the service, not optional finishing work.

- Apply per-client rate limits, concurrency limits, bounded input size, maximum references per call, and model-output limits.
- Set a hard service-wide inference budget and graceful unavailable responses. Anonymous public inference cannot be made free or restricted to genuine skill users by hiding a token in open-source code.
- Cache reusable derived guidance without sharing project briefs or session state between users. Keep raw originals and private metadata outside public caches.
- Define short session retention, minimal operational logs, model-provider data handling, and an owner kill switch before launch.
- Missing relevant references should return a coverage gap; provider failures should not trigger unbounded paid retries.

## Delivery gates

Before calling this remote flow ready, implement and verify:

1. Private bucket binding and an authenticated owner upload API.
2. Staged/committed upload recovery and a private searchable index.
3. Server-side model access with approved provider credentials and cost limits.
4. An anonymous, bounded inspiration endpoint with validated derived output.
5. Skill configuration for hosted, self-hosted, and local modes without credentials in distributed files.
6. Extension cloud settings and truthful per-reference upload states.
7. End-to-end tests proving original bytes and private metadata cannot be retrieved by consumer requests, including prompt-injection and arbitrary-object probes.

The current code supplies the local capture/retrieval foundation and portable package. This document defines the cloud architecture; it does not claim those service gates have passed.
