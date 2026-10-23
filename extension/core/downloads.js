// Downloads is the supported disk boundary when the browser has no external
// directory picker. The gallery uses a private local copy; this exports it.
import { isSafeImageFileName } from "./files.js";
function suffixPattern(path) {
  return path.split("/").map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\\\/]") + "$";
}

async function dataUrl(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

async function completed(api, id) {
  const deadline = Date.now() + 60000;
  do {
    const [item] = await api.search({ id });
    if (!item) throw new Error("No se encuentra la descarga. Conservamos la referencia para reintentar.");
    if (item.state === "complete") return item;
    if (item.state === "interrupted") throw new Error(`Descarga interrumpida: ${item.error || "error de archivo"}. Reintentá desde la biblioteca.`);
    await new Promise(resolve => setTimeout(resolve, 250));
  } while (Date.now() < deadline);
  throw new Error("La descarga sigue pendiente. Revisá las descargas de Brave y reintentá.");
}

export async function exportReferenceDownloads(root, entry, checkpoint, api = chrome.downloads) {
  const reference = entry.localReference;
  // Private copy filenames belong to the gallery. Disk metadata must point to
  // the names actually chosen by the browser, including user renames.
  const diskReference = { ...reference, images: reference.images.map(image => ({ ...image })) };
  const [category, name] = reference.relativePath.split("/");
  const dir = await (await root.getDirectoryHandle(category)).getDirectoryHandle(name);
  entry.downloads ||= {};
  const names = [...reference.images.map(image => image.fileName), "note.md", "reference.json"];
  for (const name of names) {
    const filename = `Design Shelf/${reference.relativePath}/${name}`;
    const record = entry.downloads[name] ||= { startedAt: new Date().toISOString() };
    await checkpoint(entry);
    if (!record.id) {
      // Recover the small gap between download creation and the ID checkpoint.
      const candidates = await api.search({ filenameRegex: suffixPattern(filename), startedAfter: record.startedAt });
      const extensionId = globalThis.chrome?.runtime?.id;
      const own = candidates.filter(item => !extensionId || item.byExtensionId === extensionId);
      if (own.length > 1) throw new Error("Hay varias descargas para este archivo. Revisá el conflicto antes de reintentar.");
      record.id = own[0]?.id;
    }
    if (record.id) {
      const [previous] = await api.search({ id: record.id });
      if (previous?.state === "interrupted") {
        if (previous.canResume) await api.resume(record.id);
        else record.id = null;
      }
    }
    if (!record.id) {
      const file = name === "reference.json"
        ? new Blob([JSON.stringify(diskReference, null, 2)], { type: "application/json" })
        : await (await dir.getFileHandle(name)).getFile();
      record.id = await api.download({ url: await dataUrl(file), filename, conflictAction: "uniquify", saveAs: false });
    }
    await checkpoint(entry);
    const item = await completed(api, record.id);
    if (item.exists === false) throw new Error("El archivo descargado ya no está en disco. Revisá la carpeta antes de reintentar.");
    const actualPath = item.filename.replaceAll("\\", "/");
    const split = actualPath.lastIndexOf("/");
    const actualDirectory = actualPath.slice(0, split);
    const actualName = actualPath.slice(split + 1);
    if (!actualDirectory.endsWith(`/Design Shelf/${reference.relativePath}`))
      throw new Error("El archivo se guardó en otra carpeta. Conservamos el pendiente; revisá el destino de la descarga.");
    const rootPath = actualDirectory.slice(0, -(`/${reference.relativePath}`).length);
    if (entry.downloadPath && entry.downloadPath.replaceAll("\\", "/") !== rootPath)
      throw new Error("Los archivos se guardaron en carpetas de Descargas diferentes. Revisá el destino antes de reintentar.");
    const imageIndex = reference.images.findIndex(image => image.fileName === name);
    if (imageIndex >= 0) {
      if (!isSafeImageFileName(actualName, reference.images[imageIndex].mimeType))
        throw new Error("El nombre de la imagen no es válido para su formato. Revisá la descarga antes de reintentar.");
      diskReference.images[imageIndex].fileName = actualName;
    } else if (actualName !== name) {
      throw new Error(`El archivo ${name} debe conservar su nombre para leer la biblioteca. Se guardó como ${actualName}; revisá la carpeta antes de reintentar.`);
    }
    entry.downloadPath = rootPath;
    record.fileName = actualName;
    record.complete = true;
    await checkpoint(entry);
  }
}
