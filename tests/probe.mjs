import { chromium } from "playwright";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";

const profile = await mkdtemp(join(tmpdir(), "design-shelf-probe-"));
const executablePath = process.env.DESIGN_SHELF_CHROMIUM;
const extensionPath = resolve("extension");
const context = await chromium.launchPersistentContext(profile, {
  ...(executablePath ? { executablePath } : { channel: "chromium" }),
  headless: true,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});
try {
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/library.html`);
  const support = await page.evaluate(async () => {
    const folder = await navigator.storage.getDirectory();
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("probe", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("settings");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("settings", "readwrite");
      tx.objectStore("settings").put(folder, "folder");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return { picker: typeof showDirectoryPicker, kind: folder.kind };
  });
  assert.equal(support.picker, "function");
  await page.close();
  const result = await worker.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("probe", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const folder = await new Promise((resolve, reject) => {
      const request = db
        .transaction("settings")
        .objectStore("settings")
        .get("folder");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const file = await folder.getFileHandle("worker-probe.txt", {
      create: true,
    });
    const writer = await file.createWritable();
    await writer.write("worker-write-ok");
    await writer.close();
    const text = await (await file.getFile()).text();
    db.close();
    return {
      permission: await folder.queryPermission({ mode: "readwrite" }),
      text,
    };
  });
  assert.equal(result.text, "worker-write-ok");
  await mkdir("output/playwright", { recursive: true });
  const evidence = {
    support,
    result,
    limits:
      "OPFS handle tested in real extension worker after closing page. Native external directory picker and external-folder permission require manual acceptance.",
    browserVersion: context.browser()?.version(),
    profile,
  };
  await writeFile(
    "output/playwright/probe.json",
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await context.close();
}
