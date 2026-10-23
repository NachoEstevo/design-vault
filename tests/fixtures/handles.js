export function directory(name = "Library") {
  const children = new Map();
  return {
    name,
    kind: "directory",
    permission: "granted",
    async queryPermission() {
      return this.permission;
    },
    async isSameEntry(other) {
      return this === other;
    },
    async *entries() {
      yield* children;
    },
    async getDirectoryHandle(name, { create = false } = {}) {
      if (!children.has(name) && create) children.set(name, directory(name));
      if (!children.has(name))
        throw Object.assign(new Error("missing"), { name: "NotFoundError" });
      return children.get(name);
    },
    async getFileHandle(name, { create = false } = {}) {
      if (!children.has(name) && create) {
        let data = "";
        children.set(name, {
          name,
          kind: "file",
          async getFile() {
            return new Blob([data]);
          },
          async createWritable() {
            let next;
            return {
              async write(value) {
                next = value;
              },
              async close() {
                data = next;
              },
              async abort() {},
            };
          },
        });
      }
      if (!children.has(name))
        throw Object.assign(new Error("missing"), { name: "NotFoundError" });
      return children.get(name);
    },
  };
}
export function db() {
  const settings = new Map(),
    entries = new Map();
  return {
    getSetting: async (k) => settings.get(k),
    setFolderSettings: async (folder, token, mode = "directory") => {
      settings.set("folder", folder);
      settings.set("folderToken", token);
      settings.set("storageMode", mode);
    },
    setSetting: async (k, v) => settings.set(k, v),
    getEntries: async () => [...entries.values()],
    getEntry: async (k) => entries.get(k),
    putEntry: async (e) => entries.set(e.postId, e),
  };
}
export const input = {
  url: "https://x.com/alice/status/123",
  note: "Layout",
  category: { id: "cards", label: "Cards" },
  images: [{ sourceUrl: "https://pbs.twimg.com/media/abc?format=jpg" }],
};
export const fetcher = async () =>
  new Response(new Uint8Array([1, 2, 3]), {
    headers: { "content-type": "image/jpeg" },
  });
