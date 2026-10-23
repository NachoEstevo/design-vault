import test from "node:test";
import assert from "node:assert/strict";
import { createCloudService, cloudConfig } from "../extension/core/cloud.js";
test("cloud configuration is HTTPS-only and never accepts embedded credentials or paths", () => {
  for (const url of [
    "http://vault.test",
    "https://secret@vault.test",
    "https://vault.test/private",
    "https://vault.test/?token=secret",
  ])
    assert.throws(() =>
      cloudConfig({ service_url: url, upload_token: "x".repeat(40) }),
    );
});
test("cloud failures preserve retry state; retries are idempotent and status never contains token", async () => {
  const settings = new Map();
  const db = {
    getSetting: async (k) => settings.get(k),
    setSetting: async (k, v) => settings.set(k, v),
    getEntries: async () => [],
  };
  settings.set("folder", {});
  const reference = {
    postId: "12345",
    capturedAt: new Date().toISOString(),
    relativePath: "cards/post",
    category: { id: "cards", label: "Cards" },
    note: "Private note",
    tags: ["cards"],
    images: [{ fileName: "image.png", size: 12, mimeType: "image/png" }],
  };
  const file = new Blob([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
  ]);
  const item = {
    reference,
    handle: { getFileHandle: async () => ({ getFile: async () => file }) },
  };
  let fail = false;
  const calls = [];
  const service = createCloudService({
    db,
    library: async () => ({ items: [item], warnings: [] }),
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return new Response(
        JSON.stringify(
          url.endsWith("/status") ? { references: 0 } : { ok: true },
        ),
        { status: fail ? 503 : 200 },
      );
    },
  });
  const config = {
    service_url: "https://vault.test",
    upload_token: "secret".repeat(8),
  };
  await service.connect(config);
  fail = true;
  assert.equal((await service.sync()).failed, 1);
  assert(!JSON.stringify(await service.state()).includes(config.upload_token));
  fail = false;
  assert.equal((await service.sync()).saved, 1);
  const total = calls.length;
  await service.sync();
  assert.equal(calls.length, total);
  const commit = calls.find((c) => c.url.endsWith("/references"));
  assert.deepEqual(Object.keys(JSON.parse(commit.options.body)).sort(), [
    "capturedAt",
    "category",
    "images",
    "note",
    "postId",
    "tags",
  ]);
  await service.disconnect();
  assert.equal((await service.state()).connected, false);
});
