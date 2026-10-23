import test from "node:test";
import assert from "node:assert/strict";
import { directory } from "./fixtures/handles.js";
import { exportReferenceDownloads } from "../extension/core/downloads.js";

async function fixture() {
  const root = directory();
  const category = await root.getDirectoryHandle("cards", { create: true });
  const dir = await category.getDirectoryHandle("2026-10-10_123", { create: true });
  for (const name of ["image-01.png", "note.md", "reference.json"]) {
    const file = await dir.getFileHandle(name, { create: true });
    const stream = await file.createWritable();
    await stream.write(new Blob([name]));
    await stream.close();
  }
  return { root, entry: { localReference: { relativePath: "cards/2026-10-10_123", images: [{ fileName: "image-01.png", mimeType: "image/png" }] } } };
}

function downloads() {
  const items = new Map();
  let next = 0;
  return {
    items,
    async download({ filename, url, conflictAction, saveAs }) {
      assert.equal(conflictAction, "uniquify");
      assert.equal(saveAs, false);
      assert.match(url, /^data:/);
      const id = ++next;
      items.set(id, { id, filename: `C:/Downloads/${filename}`, state: "complete", exists: true, url });
      return id;
    },
    async search(query) {
      return query.id ? [items.get(query.id)].filter(Boolean) : [];
    },
  };
}

test("downloads export writes images and note before metadata and reuses completed IDs", async () => {
  const { root, entry } = await fixture();
  const api = downloads();
  await exportReferenceDownloads(root, entry, async () => {}, api);
  assert.deepEqual([...api.items.values()].map(i => i.filename.split("/").at(-1)), ["image-01.png", "note.md", "reference.json"]);
  await exportReferenceDownloads(root, entry, async () => {}, api);
  assert.equal(api.items.size, 3);
  assert.equal(entry.downloadPath, "C:/Downloads/Design Shelf");
});

test("interrupted download stays recoverable and metadata is withheld until retry succeeds", async () => {
  const { root, entry } = await fixture();
  const api = downloads();
  const search = api.search;
  api.search = async query => (await search(query)).map(item => ({ ...item, state: "interrupted", error: "FILE_FAILED" }));
  await assert.rejects(exportReferenceDownloads(root, entry, async () => {}, api), /FILE_FAILED/);
  assert.equal(api.items.size, 1);
  api.search = search;
  await exportReferenceDownloads(root, entry, async () => {}, api);
  assert.equal(api.items.size, 3);
});

test("renamed completed image from the old pending entry is reused and metadata points to its real name", async () => {
  const { root, entry } = await fixture();
  const api = downloads();
  api.items.set(41, { id: 41, filename: "C:/Downloads/Design Shelf/cards/2026-10-10_123/rojo.png", state: "complete", exists: true });
  entry.downloads = { "image-01.png": { id: 41, startedAt: "2026-10-10T00:00:00Z" } };
  await exportReferenceDownloads(root, entry, async () => {}, api);
  assert.equal(api.items.size, 3, "Only note and metadata are downloaded on recovery");
  const metadata = JSON.parse(Buffer.from([...api.items.values()].at(-1).url.split(",")[1], "base64").toString());
  assert.equal(metadata.images[0].fileName, "rojo.png");
  assert.equal(entry.localReference.images[0].fileName, "image-01.png", "Private gallery copy retains its own name");
});

test("uniquified image filenames preserve existing files and get recorded in exported metadata", async () => {
  const { root, entry } = await fixture();
  const api = downloads();
  const search = api.search;
  api.search = async query => (await search(query)).map(item => ({ ...item, filename: item.filename.replace(".png", " (1).png") }));
  await exportReferenceDownloads(root, entry, async () => {}, api);
  const metadata = JSON.parse(Buffer.from([...api.items.values()].at(-1).url.split(",")[1], "base64").toString());
  assert.equal(metadata.images[0].fileName, "image-01 (1).png");
  assert.equal(api.items.size, 3);
});

test("files redirected to a different folder do not commit metadata", async () => {
  const { root, entry } = await fixture();
  const api = downloads(), search = api.search;
  api.search = async query => (await search(query)).map(item => ({ ...item, filename: item.filename.replace("/cards/", "/other/") }));
  await assert.rejects(exportReferenceDownloads(root, entry, async () => {}, api), /folder/i);
  assert.equal(api.items.size, 1);
});
