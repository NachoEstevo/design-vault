import test from "node:test";
import assert from "node:assert/strict";
import { db, directory, input, fetcher } from "./fixtures/handles.js";
import { createCaptureService } from "../extension/core/capture-service.js";
test("persist failure, only explicit retry, duplicate identity", async () => {
  const store = db();
  await store.setSetting("folder", directory());
  await store.setSetting("folderToken", "one");
  let fail = true,
    calls = 0;
  const service = createCaptureService({
    db: store,
    writeReference: async (root, e) => {
      calls++;
      assert.equal((await store.getEntry(e.postId)).status, "pending");
      if (fail) throw new Error("disk full");
      return e.reference;
    },
  });
  assert.equal((await service.saveReference(input)).status, "pending");
  assert.equal(
    (await service.saveReference({ ...input, note: "changed" })).status,
    "pending",
  );
  assert.equal(calls, 1);
  fail = false;
  assert.equal((await service.retryPending())[0].status, "saved");
  assert.equal((await service.saveReference(input)).status, "duplicate");
  assert.equal(calls, 2);
});
test("category collisions and pending destination changes blocked", async () => {
  const store = db();
  const service = createCaptureService({ db: store, fetcher });
  await assert.rejects(service.addCategory("Cárds"), /already exists/);
  await store.setSetting("folder", directory());
  await store.setSetting("folderToken", "one");
  await store.putEntry({
    postId: "123",
    status: "pending",
    folderToken: "one",
    reference: input,
  });
  const key = "folderCandidate:12345678-1234-1234-1234-123456789012";
  await store.setSetting(key, directory());
  await assert.rejects(service.setFolder(key), /pending/);
  assert.equal(await store.getSetting(key), null);
});

test("concurrent captures serialize and preserve one identity", async () => {
  const store = db();
  await store.setSetting("folder", directory());
  await store.setSetting("folderToken", "one");
  let calls = 0;
  const service = createCaptureService({
    db: store,
    writeReference: async (root, e) => {
      calls++;
      return e.reference;
    },
  });
  const results = await Promise.all([
    service.saveReference(input),
    service.saveReference(input),
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    ["saved", "duplicate"],
  );
  assert.equal(calls, 1);
});
test("missing destination is rejected without creating stuck pending work", async () => {
  const store = db();
  const service = createCaptureService({ db: store });
  await assert.rejects(service.saveReference(input), /folder/i);
  assert.equal((await store.getEntries()).length, 0);
});
test("destination switch persists handle and token, repeat pick preserves token", async () => {
  const store = db();
  const service = createCaptureService({ db: store });
  const root = directory();
  const key = "folderCandidate:12345678-1234-1234-1234-123456789012";
  await store.setSetting(key, root);
  await service.setFolder(key);
  const token = await store.getSetting("folderToken");
  assert.ok(token);
  await store.setSetting(key, root);
  await service.setFolder(key);
  assert.equal(await store.getSetting("folderToken"), token);
});
test("recreated service retries persisted file journal without rewriting closed images", async () => {
  const store = db(),
    root = directory();
  await store.setSetting("folder", root);
  await store.setSetting("folderToken", "one");
  const entries = new Map();
  store.putEntry = async (entry) =>
    entries.set(entry.postId, structuredClone(entry));
  store.getEntry = async (id) => structuredClone(entries.get(id));
  store.getEntries = async () => structuredClone([...entries.values()]);
  let calls = 0;
  const selected = {
    ...input,
    images: [
      ...input.images,
      { sourceUrl: "https://pbs.twimg.com/media/def?format=jpg" },
    ],
  };
  const service = createCaptureService({
    db: store,
    fetcher: async () => {
      if (++calls === 2) throw new Error("network interrupted");
      return fetcher();
    },
  });
  assert.equal((await service.saveReference(selected)).status, "pending");
  const pending = await store.getEntry("123");
  assert.equal(pending.journal.files["image-01.jpg"].state, "closed");
  const restarted = createCaptureService({ db: store, fetcher });
  assert.equal((await restarted.retryPending())[0].status, "saved");
});

test("downloads setup and export failure survive restart without fetching images again", async () => {
  const store = db(), root = directory();
  let fetches = 0, fail = true;
  const options = {
    db: store,
    privateDirectory: async () => root,
    fetcher: async () => { fetches++; return fetcher(); },
    exportDownloads: async (folder, entry) => {
      assert.equal(entry.localReference.images[0].fileName, "image-01.jpg");
      if (fail) throw new Error("download interrupted");
    },
  };
  const service = createCaptureService(options);
  assert.equal((await service.useDownloads()).folder.mode, "downloads");
  const token = await store.getSetting("folderToken");
  await service.useDownloads();
  assert.equal(await store.getSetting("folderToken"), token);
  assert.equal((await service.saveReference(input)).status, "pending");
  assert.equal((await service.saveReference(input)).status, "pending");
  fail = false;
  const restarted = createCaptureService(options);
  assert.equal((await restarted.retryPending())[0].status, "saved");
  assert.equal(fetches, 1);
  assert.equal((await restarted.saveReference(input)).status, "duplicate");
});

test("downloads setup cannot move pending work from an external folder", async () => {
  const store = db();
  await store.setSetting("folder", directory());
  await store.setSetting("folderToken", "one");
  await store.putEntry({ postId: "123", status: "pending", folderToken: "one", reference: input });
  const service = createCaptureService({ db: store, privateDirectory: async () => directory() });
  await assert.rejects(service.useDownloads(), /pending/);
  assert.equal(await store.getSetting("folderToken"), "one");
});

test("cloud upload failure cannot undo a completed local capture",async()=>{
  const store=db();await store.setSetting("folder",directory());await store.setSetting("folderToken","one");
  let statusAtUpload;
  const service=createCaptureService({db:store,writeReference:async(root,entry)=>entry.reference,
    syncCloud:async postId=>{statusAtUpload=(await store.getEntry(postId)).status;throw new Error("Cloud offline");}});
  const result=await service.saveReference(input);
  assert.equal(result.status,"saved");
  assert.equal(statusAtUpload,"saved");
  assert.equal((await store.getEntries())[0].status,"saved");
});
