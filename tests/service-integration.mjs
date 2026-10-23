// Exercise native R2 conditions in workerd, without touching a remote bucket.
import assert from "node:assert/strict";
import { unstable_dev } from "wrangler";
import { digest } from "../service/contracts.js";
delete process.env.CLOUDFLARE_API_TOKEN;
const token = "local-test-owner-".repeat(3);
const worker = await unstable_dev("service/worker.js", {
  config: "service/wrangler.jsonc",
  local: true,
  persist: false,
  vars: { OWNER_TOKEN: token },
  logLevel: "error",
  experimental: { disableExperimentalWarning: true, watch: false },
});
try {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const sha256 = await digest(bytes);
  const put = () =>
    worker.fetch(`/admin/objects/${sha256}`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "image/png" },
      body: bytes,
    });
  assert.equal((await put()).status, 200);
  assert.equal((await put()).status, 200);
  const ref = {
    postId: "12345",
    capturedAt: new Date().toISOString(),
    category: { id: "cards", label: "Cards" },
    tags: ["cards"],
    note: "private note",
    images: [
      {
        sha256,
        size: 12,
        mimeType: "image/png",
        observation: {
          summary: "Airy cards with warm colors",
          components: ["cards"],
        },
      },
    ],
  };
  const commit = (value) =>
    worker.fetch("/admin/references", {
      method: "POST",
      headers,
      body: JSON.stringify(value),
    });
  const results = await Promise.all([
    commit(ref),
    commit({ ...ref, postId: "67890" }),
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    [200, 200],
  );
  const metadata = structuredClone(ref);
  delete metadata.images[0].observation;
  assert.equal((await commit(metadata)).status, 200);
  assert.deepEqual(
    await (await worker.fetch("/admin/status", { headers })).json(),
    { references: 2, images: 2, reviewed: 2 },
  );
  assert.equal((await worker.fetch("/admin/status")).status, 401);
  const search = await (
    await worker.fetch("/v1/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "warm cards", session: "s" }),
    })
  ).json();
  assert.equal(search.references.length, 1);
  assert.equal(search.references[0].reviewed, true);
  assert.equal((await worker.fetch(`/v1/objects/${sha256}`)).status, 404);
  console.log(
    "Native R2: immutable uploads, concurrent catalog commits, observation preservation and private routes passed.",
  );
} finally {
  await worker.stop();
}
