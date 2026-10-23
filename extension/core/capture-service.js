import * as database from "./db.js";
import {
  DEFAULT_CATEGORIES,
  normalizeCategory,
  normalizeReference,
} from "./reference.js";
import { writeReference as writer, readLibrary } from "./files.js";
import { exportReferenceDownloads } from "./downloads.js";
export function createCaptureService({
  db = database,
  writeReference = writer,
  fetcher = globalThis.fetch,
  exportDownloads = exportReferenceDownloads,
  privateDirectory = () => navigator.storage.getDirectory(),
} = {}) {
  let tail = Promise.resolve();
  const serial = (fn) => {
    const next = tail.then(fn);
    tail = next.catch(() => {});
    return next;
  };
  async function getSettings() {
    const [categories, folder, entries, mode] = await Promise.all([
      db.getSetting("categories"),
      db.getSetting("folder"),
      db.getEntries(),
      db.getSetting("storageMode"),
    ]);
    return {
      categories: categories || DEFAULT_CATEGORIES,
      folder: folder
        ? {
            name: mode === "downloads" ? "Downloads / Design Shelf" : folder.name,
            mode: mode || "directory",
            permission: await folder.queryPermission({ mode: "readwrite" }),
          }
        : null,
      pendingCount: entries.filter((e) => e.status === "pending").length,
    };
  }
  async function execute(entry) {
    try {
      const token = await db.getSetting("folderToken");
      if (entry.folderToken !== token)
        throw new Error("The destination folder changed");
      const folder = await db.getSetting("folder");
      if (!folder) throw new Error("Choose a folder in the library");
      const mode = await db.getSetting("storageMode");
      let reference = entry.localReference;
      if (!reference) {
        try {
          reference = await writeReference(folder, entry, fetcher, next => db.putEntry(next));
        } catch (error) {
          if (error.code !== "DUPLICATE" || mode !== "downloads") throw error;
          const library = await readLibrary(folder);
          reference = library.items.find(item => item.reference.postId === entry.postId)?.reference;
          if (!reference) throw error;
        }
      }
      if (mode === "downloads") {
        entry.localReference = reference;
        await db.putEntry(entry);
        await exportDownloads(folder, entry, next => db.putEntry(next));
      }
      await db.putEntry({
        ...entry,
        reference,
        status: "saved",
        error: undefined,
      });
      return { status: "saved", reference };
    } catch (error) {
      if (error.code === "DUPLICATE") {
        const library = await readLibrary(await db.getSetting("folder"));
        const found = library.items.find(
          (i) => i.reference.postId === entry.postId,
        );
        if (found) {
          await db.putEntry({
            ...entry,
            reference: found.reference,
            status: "saved",
            error: undefined,
          });
          return { status: "duplicate", reference: found.reference };
        }
      }
      await db.putEntry({ ...entry, status: "pending", error: error.message });
      return {
        status: "pending",
        reference: entry.reference,
        error: error.message,
      };
    }
  }
  return {
    getSettings,
    useDownloads: () => serial(async () => {
      const settings = await getSettings();
      if (settings.folder?.mode === "downloads") return settings;
      if (settings.pendingCount) throw new Error("Resolve pending saves before changing the destination");
      const root = await (await privateDirectory()).getDirectoryHandle("downloads-library", { create: true });
      await db.setFolderSettings(root, crypto.randomUUID(), "downloads");
      return getSettings();
    }),
    saveReference: (input) =>
      serial(async () => {
        const reference = normalizeReference(input);
        const settings = await getSettings();
        if (!settings.folder)
          throw new Error("Choose a folder in the library");
        if (
          !settings.categories.some(
            (c) =>
              c.id === reference.category.id &&
              c.label === reference.category.label,
          )
        )
          throw new Error("Unknown category");
        const token = await db.getSetting("folderToken");
        const existing = await db.getEntry(reference.postId);
        if (
          existing &&
          (existing.status === "pending" || existing.folderToken === token)
        )
          return {
            status: existing.status === "saved" ? "duplicate" : "pending",
            reference: existing.reference,
            error: existing.error,
          };
        if (settings.pendingCount >= 20)
          throw new Error("The pending queue is full");
        const entry = {
          captureId: crypto.randomUUID(),
          postId: reference.postId,
          reference,
          status: "pending",
          folderToken: token,
        };
        await db.putEntry(entry);
        return execute(entry);
      }),
    retryPending: () =>
      serial(async () => {
        const results = [];
        for (const entry of await db.getEntries())
          if (entry.status === "pending") results.push(await execute(entry));
        return results;
      }),
    addCategory: (label) =>
      serial(async () => {
        const category = normalizeCategory(label);
        const { categories } = await getSettings();
        if (categories.some((c) => c.id === category.id))
          throw new Error("A category with this name already exists");
        const next = [...categories, category];
        await db.setSetting("categories", next);
        return { category, categories: next };
      }),
    setFolder: (candidateKey) =>
      serial(async () => {
        if (!/^folderCandidate:[0-9a-f-]{36}$/.test(candidateKey))
          throw new Error("Invalid candidate folder");
        const root = await db.getSetting(candidateKey);
        try {
          if (!root || root.kind !== "directory")
            throw new Error("Invalid folder");
          const settings = await getSettings();
          const current = await db.getSetting("folder");
          if (settings.folder?.mode !== "downloads" && current && (await root.isSameEntry(current))) return settings;
          if (settings.pendingCount)
            throw new Error(
              "Resolve pending saves before switching folders",
            );
          if ((await root.queryPermission({ mode: "readwrite" })) !== "granted")
            throw new Error("Folder access is required");
          await db.setFolderSettings(root, crypto.randomUUID());
          return getSettings();
        } finally {
          await db.setSetting(candidateKey, null);
        }
      }),
  };
}
const service = createCaptureService();
export const {
  saveReference,
  retryPending,
  getSettings,
  addCategory,
  setFolder,
  useDownloads,
} = service;
