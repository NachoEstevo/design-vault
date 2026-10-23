import * as database from "./db.js";
import { readLibrary } from "./files.js";

export function cloudConfig(input) {
  let url;
  try {
    url = new URL(input?.service_url);
  } catch {
    throw new Error("Enter a valid service URL");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["", "/"].includes(url.pathname)
  )
    throw new Error("Use an HTTPS service origin without a path");
  if (
    typeof input.upload_token !== "string" ||
    !/^[\x21-\x7e]{32,256}$/.test(input.upload_token)
  )
    throw new Error("Enter the owner upload token (32–256 characters)");
  return { service_url: url.origin, upload_token: input.upload_token };
}
export function createCloudService({
  db = database,
  fetcher = globalThis.fetch,
  library = readLibrary,
} = {}) {
  let tail = Promise.resolve();
  const serial = (fn) => {
    const result = tail.then(fn);
    tail = result.catch(() => {});
    return result;
  };
  async function call(config, path, method = "GET", body) {
    let response;
    try {
      response = await fetcher(config.service_url + path, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(60000),
        headers: {
          Authorization: `Bearer ${config.upload_token}`,
          ...(body
            ? {
                "Content-Type":
                  body instanceof Blob ? body.type : "application/json",
              }
            : {}),
        },
        ...(body
          ? { body: body instanceof Blob ? body : JSON.stringify(body) }
          : {}),
      });
    } catch {
      throw new Error(
        "Cloud service could not be reached. Local files are safe; retry the upload.",
      );
    }
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "Owner token rejected. Reconnect your cloud vault."
          : `Cloud upload failed (${response.status}). Local files are safe; retry the upload.`,
      );
    return response.json();
  }
  async function state() {
    const config = await db.getSetting("cloudConfig");
    const records = (await db.getSetting("cloudStates")) || {};
    const current = Object.values(records).filter(
      (r) => r.service_url === config?.service_url,
    );
    return {
      connected: Boolean(config),
      service_url: config?.service_url || "",
      saved: current.filter((r) => r.status === "saved").length,
      failed: current.filter((r) => r.status === "failed").length,
    };
  }
  async function upload(item, config) {
    const ref = item.reference,
      images = [];
    for (const image of ref.images) {
      const file = await (
        await item.handle.getFileHandle(image.fileName)
      ).getFile();
      if (file.size !== image.size || file.size > 20 * 1024 * 1024)
        throw new Error(
          "Local image changed; refresh the library before retrying",
        );
      const sha256 = [
        ...new Uint8Array(
          await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
        ),
      ]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
      const blob = new Blob([file], { type: image.mimeType });
      await call(config, `/admin/objects/${sha256}`, "PUT", blob);
      images.push({ sha256, size: file.size, mimeType: image.mimeType });
    }
    await call(config, "/admin/references", "POST", {
      postId: ref.postId,
      category: ref.category,
      capturedAt: ref.capturedAt,
      note: ref.note,
      tags: ref.tags,
      images,
    });
  }
  async function sync(postId) {
    const config = await db.getSetting("cloudConfig");
    if (!config) return state();
    const root = await db.getSetting("folder");
    if (!root) throw new Error("Choose local storage before syncing");
    const { items, warnings } = await library(root);
    if (warnings.length)
      throw new Error(
        "Some local references need attention. Refresh the library before syncing.",
      );
    const records = (await db.getSetting("cloudStates")) || {};
    const pending = new Set(
      (await db.getEntries())
        .filter((entry) => entry.status === "pending")
        .map((entry) => entry.postId),
    );
    for (const item of items) {
      if (pending.has(item.reference.postId)) continue;
      if (postId && item.reference.postId !== postId) continue;
      const previous = records[item.reference.postId];
      if (
        previous?.service_url === config.service_url &&
        previous.status === "saved"
      )
        continue;
      let error = "",
        status = "saved";
      try {
        await upload(item, config);
      } catch (failure) {
        status = "failed";
        error = failure.message;
      }
      records[item.reference.postId] = {
        service_url: config.service_url,
        status,
        error,
        at: new Date().toISOString(),
      };
      await db.setSetting("cloudStates", records);
    }
    return state();
  }
  return {
    state,
    connect: (input) =>
      serial(async () => {
        const config = cloudConfig(input);
        const health = await call(config, "/admin/status");
        if (!Number.isInteger(health.references))
          throw new Error("This is not a compatible Design Vault service");
        await db.setSetting("cloudConfig", config);
        return state();
      }),
    disconnect: () =>
      serial(async () => {
        await db.setSetting("cloudConfig", null);
        return state();
      }),
    sync: (postId) => serial(() => sync(postId)),
  };
}
export const cloud = createCloudService();
