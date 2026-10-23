let database;
function open() {
  return (database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open("design-shelf", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("settings");
      request.result.createObjectStore("entries", { keyPath: "postId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
async function operation(store, mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    let result;
    const request = action(tx.objectStore(store));
    request.onsuccess = () => {
      result = request.result;
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction cancelled"));
  });
}
export const getSetting = (key) =>
  operation("settings", "readonly", (s) => s.get(key));
export const setSetting = (key, value) =>
  operation("settings", "readwrite", (s) => s.put(value, key));
export const getEntries = () =>
  operation("entries", "readonly", (s) => s.getAll());
export const getEntry = (id) =>
  operation("entries", "readonly", (s) => s.get(id));
export const putEntry = (entry) =>
  operation("entries", "readwrite", (s) => s.put(entry));
// Folder identity and handle must survive worker suspension together.
export async function setFolderSettings(folder, folderToken, mode = "directory") {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings", "readwrite");
    const settings = tx.objectStore("settings");
    settings.put(folder, "folder");
    settings.put(folderToken, "folderToken");
    settings.put(mode, "storageMode");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction cancelled"));
  });
}
