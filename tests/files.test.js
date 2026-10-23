import test from "node:test";
import assert from "node:assert/strict";
import { directory, input, fetcher } from "./fixtures/handles.js";
import { normalizeReference } from "../extension/core/reference.js";
import { writeReference, readLibrary } from "../extension/core/files.js";

test("library reads metadata referring to a renamed image in the same directory", async () => {
  const root = directory();
  const final = await writeReference(root, { reference: normalizeReference(input), captureId: "test-owner" }, fetcher);
  const dir = await (await root.getDirectoryHandle("cards")).getDirectoryHandle(final.relativePath.split("/")[1]);
  const original = await (await dir.getFileHandle(final.images[0].fileName)).getFile();
  const image = await (await dir.getFileHandle("rojo.jpg", { create: true })).createWritable();
  await image.write(original);
  await image.close();
  const meta = await (await dir.getFileHandle("reference.json")).createWritable();
  await meta.write(JSON.stringify({ ...final, images: [{ ...final.images[0], fileName: "rojo.jpg" }] }));
  await meta.close();
  const library = await readLibrary(root);
  assert.equal(library.items.length, 1);
  assert.equal(library.items[0].reference.images[0].fileName, "rojo.jpg");
});
test("commits complete metadata last and prevents duplicate across category", async () => {
  const root = directory();
  const reference = normalizeReference(input);
  await writeReference(root, { reference, captureId: "test-owner" }, fetcher);
  assert.equal((await readLibrary(root)).items.length, 1);
  await assert.rejects(
    writeReference(
      root,
      {
        reference: normalizeReference({
          ...input,
          category: { id: "otros", label: "Otros" },
        }),
      },
      fetcher,
    ),
    /existe/,
  );
});
test("partial failure has no final metadata and retry recovers", async () => {
  const root = directory();
  const entry = {
    reference: normalizeReference(input),
    captureId: "test-owner",
  };
  await assert.rejects(
    writeReference(
      root,
      entry,
      async () =>
        new Response("bad", { headers: { "content-type": "text/html" } }),
    ),
    /Tipo/,
  );
  assert.equal((await readLibrary(root)).items.length, 0);
  await writeReference(root, entry, fetcher);
  root.permission = "prompt";
  await assert.rejects(writeReference(root, entry, fetcher), /permiso/);
});
test("rejects redirected hosts and oversized headers", async () => {
  const root = directory(),
    entry = { reference: normalizeReference(input), captureId: "test-owner" };
  await assert.rejects(
    writeReference(root, entry, async () => ({
      ok: true,
      url: "https://evil.test/a",
      headers: new Headers({ "content-type": "image/jpeg" }),
    })),
    /Destino/,
  );
  await assert.rejects(
    writeReference(
      root,
      entry,
      async () =>
        new Response("a", {
          headers: {
            "content-type": "image/jpeg",
            "content-length": String(21 * 1024 * 1024),
          },
        }),
    ),
    /grande/,
  );
});
test("reader skips metadata with traversal filenames", async () => {
  const root = directory();
  const final = await writeReference(
    root,
    { reference: normalizeReference(input), captureId: "test-owner" },
    fetcher,
  );
  const dir = await (
    await root.getDirectoryHandle("cards")
  ).getDirectoryHandle(final.relativePath.split("/")[1]);
  const writable = await (
    await dir.getFileHandle("reference.json")
  ).createWritable();
  await writable.write(
    JSON.stringify({
      ...final,
      images: [{ ...final.images[0], fileName: "../secret" }],
    }),
  );
  await writable.close();
  const result = await readLibrary(root);
  assert.equal(result.items.length, 0);
  assert.equal(result.warnings.length, 1);
});

test("foreign existing folders and malformed completed metadata never overwrite", async () => {
  const root = directory(),
    reference = normalizeReference(input),
    entry = { reference, captureId: "owner" };
  const category = await root.getDirectoryHandle("cards", { create: true });
  const dir = await category.getDirectoryHandle(
    reference.relativePath.split("/")[1],
    { create: true },
  );
  await assert.rejects(writeReference(root, entry, fetcher), /no pertenece/);
  const writer = await (
    await dir.getFileHandle("reference.json", { create: true })
  ).createWritable();
  await writer.write("{broken");
  await writer.close();
  await assert.rejects(writeReference(root, entry, fetcher), /no pertenece/);
  assert.equal(
    await (await (await dir.getFileHandle("reference.json")).getFile()).text(),
    "{broken",
  );
});
test("retry ownership survives service restart and rejects another owner", async () => {
  const root = directory(),
    entry = { reference: normalizeReference(input), captureId: "owner" };
  await assert.rejects(
    writeReference(root, entry, async () => {
      throw new Error("offline");
    }),
  );
  await assert.rejects(
    writeReference(root, { ...entry, captureId: "foreign" }, fetcher),
    /previsto/,
  );
  await writeReference(root, JSON.parse(JSON.stringify(entry)), fetcher);
  assert.equal((await readLibrary(root)).items.length, 1);
});

function failOnce(dir, name, stage) {
  const get = dir.getFileHandle.bind(dir);
  let failed = false;
  dir.getFileHandle = async (...args) => {
    const handle = await get(...args);
    if (args[0] !== name) return handle;
    return {
      ...handle,
      createWritable: async () => {
        const writer = await handle.createWritable();
        return {
          ...writer,
          [stage]: async (...values) => {
            if (!failed) {
              failed = true;
              throw new Error("injected disk failure");
            }
            return writer[stage](...values);
          },
        };
      },
    };
  };
}
for (const name of [".pending.json", "reference.json"]) {
  for (const stage of ["write", "close"]) {
    test(`failed ${name} ${stage} retries after serialized journal restart`, async () => {
      const root = directory(),
        reference = normalizeReference(input);
      const category = await root.getDirectoryHandle("cards", { create: true });
      const original = category.getDirectoryHandle.bind(category);
      category.getDirectoryHandle = async (...args) => {
        const dir = await original(...args);
        if (args[1]?.create) failOnce(dir, name, stage);
        return dir;
      };
      let persisted = { reference, captureId: "owner" };
      const checkpoint = async (entry) => {
        persisted = structuredClone(entry);
      };
      await assert.rejects(
        writeReference(root, structuredClone(persisted), fetcher, checkpoint),
        /injected/,
      );
      category.getDirectoryHandle = original;
      await writeReference(
        root,
        structuredClone(persisted),
        fetcher,
        checkpoint,
      );
      assert.equal((await readLibrary(root)).items.length, 1);
    });
  }
}
test("partial retry preserves inserted note and modified owned image", async () => {
  for (const target of ["image-01.jpg", "note.md"]) {
    const root = directory(),
      entry = {
        reference: normalizeReference({
          ...input,
          images: [
            ...input.images,
            { sourceUrl: "https://pbs.twimg.com/media/def?format=jpg" },
          ],
        }),
        captureId: "owner",
      };
    let calls = 0;
    await assert.rejects(
      writeReference(root, entry, async () => {
        if (++calls === 2) throw new Error("offline");
        return fetcher();
      }),
    );
    const dir = await (
      await root.getDirectoryHandle("cards")
    ).getDirectoryHandle(entry.reference.relativePath.split("/")[1]);
    const file = await dir.getFileHandle(target, { create: true });
    const writer = await file.createWritable();
    await writer.write("my user work");
    await writer.close();
    await assert.rejects(
      writeReference(root, structuredClone(entry), fetcher),
      /Archivo/,
    );
    assert.equal(await (await file.getFile()).text(), "my user work");
  }
});
