import { normalizeReference } from "./reference.js";
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const LIMIT = 20 * 1024 * 1024;
export function isSafeImageFileName(name, mimeType) {
  if (typeof name !== "string" || !name || name.length > 200 ||
      /^[. ]|[. ]$|[\\/<>:"|?*\x00-\x1f]/.test(name) ||
      /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name)) return false;
  const extension = name.split(".").at(-1).toLowerCase();
  return mimeType === "image/jpeg"
    ? ["jpg", "jpeg"].includes(extension)
    : Boolean(TYPES[mimeType]) && extension === TYPES[mimeType];
}
async function digest(blob) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
async function writeOwned(dir, name, data, entry, checkpoint) {
  const blob = data instanceof Blob ? data : new Blob([data]);
  const hash = await digest(blob);
  const previous = entry.journal.files[name];
  let file;
  try {
    file = await dir.getFileHandle(name);
  } catch (error) {
    if (error.name !== "NotFoundError") throw error;
  }
  if (file) {
    const current = await file.getFile();
    if (!previous) throw new Error(`Unowned existing file: ${name}`);
    if (previous.hash !== hash)
      throw new Error(`Expected content changed: ${name}`);
    if ((await digest(current)) === hash) return;
    if (previous.state === "closed" || current.size !== 0)
      throw new Error(`File changed: ${name}`);
  }
  // Persist intent before creating an empty handle, so failed writes remain recoverable.
  entry.journal.files[name] = { hash, state: "writing" };
  await checkpoint(entry);
  file ||= await dir.getFileHandle(name, { create: true });
  const writer = await file.createWritable();
  try {
    await writer.write(blob);
    await writer.close();
  } catch (error) {
    await writer.abort().catch(() => {});
    throw error;
  }
  entry.journal.files[name] = { hash, state: "closed" };
  await checkpoint(entry);
}
export async function readLibrary(root) {
  const items = [],
    warnings = [];
  for await (const [category, dir] of root.entries()) {
    if (dir.kind !== "directory") continue;
    try {
      for await (const [name, handle] of dir.entries()) {
        if (handle.kind !== "directory") continue;
        let hasMetadata = false;
        try {
          const file = await handle.getFileHandle("reference.json");
          hasMetadata = true;
          const metadata = await file.getFile();
          if (metadata.size > 256 * 1024)
            throw new Error("Metadata is too large");
          const reference = JSON.parse(await metadata.text());
          const clean = normalizeReference(
            reference,
            new Date(reference.capturedAt),
          );
          if (
            reference.schemaVersion !== 1 ||
            reference.relativePath !== `${category}/${name}` ||
            clean.relativePath !== reference.relativePath
          )
            throw new Error("Invalid path");
          for (const img of reference.images) {
            if (
              !TYPES[img.mimeType] ||
              !isSafeImageFileName(img.fileName, img.mimeType) ||
              !Number.isInteger(img.size) ||
              img.size < 1 ||
              img.size > LIMIT
            )
              throw new Error("Invalid image file");
            await handle.getFileHandle(img.fileName);
          }
          items.push({
            reference: {
              ...clean,
              images: reference.images.map((img, i) => ({
                ...clean.images[i],
                fileName: img.fileName,
                mimeType: img.mimeType,
                size: img.size,
              })),
            },
            handle,
          });
        } catch (error) {
          if (hasMetadata || error.name !== "NotFoundError")
            warnings.push(`${category}/${name}: ${error.message}`);
        }
      }
    } catch (error) {
      warnings.push(`${category}: ${error.message}`);
    }
  }
  return { items, warnings };
}
export async function writeReference(
  root,
  entry,
  fetcher = fetch,
  checkpoint = async () => {},
) {
  if ((await root.queryPermission({ mode: "readwrite" })) !== "granted")
    throw new Error("Renew folder access");
  const reference = normalizeReference(
    entry.reference,
    new Date(entry.reference.capturedAt),
  );
  const library = await readLibrary(root);
  if (library.items.some((item) => item.reference.postId === reference.postId))
    throw Object.assign(new Error("The reference already exists in this folder"), {
      code: "DUPLICATE",
    });
  const category = await root.getDirectoryHandle(reference.category.id, {
    create: true,
  });
  const name = reference.relativePath.split("/")[1];
  const marker = {
    captureId: entry.captureId,
    postId: reference.postId,
    relativePath: reference.relativePath,
    sources: reference.images.map((image) => image.sourceUrl),
  };
  if (!marker.captureId) throw new Error("Missing capture identity");
  let dir;
  try {
    dir = await category.getDirectoryHandle(name);
  } catch (error) {
    if (error.name !== "NotFoundError") throw error;
  }
  if (dir && !entry.journal?.directory) {
    throw new Error("This folder exists and does not belong to this save");
  }
  if (!entry.journal) entry.journal = { directory: true, files: {} };
  await checkpoint(entry);
  if (!dir) dir = await category.getDirectoryHandle(name, { create: true });
  await writeOwned(
    dir,
    ".pending.json",
    JSON.stringify(marker),
    entry,
    checkpoint,
  );
  const images = [];
  for (const [i, img] of reference.images.entries()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetcher(img.sourceUrl, {
        signal: controller.signal,
        redirect: "error",
        credentials: "omit",
      });
      if (!response.ok)
        throw new Error(`Download failed (${response.status})`);
      if (
        response.url &&
        new URL(response.url).origin !== "https://pbs.twimg.com"
      )
        throw new Error("Invalid image destination");
      const mimeType = (response.headers.get("content-type") || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!TYPES[mimeType]) throw new Error("Unsupported image type");
      if (Number(response.headers.get("content-length")) > LIMIT)
        throw new Error("Image is too large");
      const reader = response.body.getReader();
      const chunks = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > LIMIT) {
          await reader.cancel();
          throw new Error("Image is too large");
        }
        chunks.push(value);
      }
      if (!size) throw new Error("Empty image");
      const fileName = `image-${String(i + 1).padStart(2, "0")}.${TYPES[mimeType]}`;
      await writeOwned(
        dir,
        fileName,
        new Blob(chunks, { type: mimeType }),
        entry,
        checkpoint,
      );
      images.push({ ...img, fileName, mimeType, size });
    } finally {
      clearTimeout(timer);
    }
  }
  const final = { ...reference, images };
  await writeOwned(
    dir,
    "note.md",
    `${reference.note}\n\n${reference.url}\n\nTags: ${reference.tags.join(", ")}\n`,
    entry,
    checkpoint,
  );
  await writeOwned(
    dir,
    "reference.json",
    JSON.stringify(final, null, 2),
    entry,
    checkpoint,
  );
  return final;
}
