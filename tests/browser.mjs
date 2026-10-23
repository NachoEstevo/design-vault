import { chromium } from "playwright";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  writeFile,
  access,
} from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";

const output = resolve("output/playwright");
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "design-shelf-browser-"));
const downloadDir = await mkdtemp(join(tmpdir(), "design-shelf-downloads-"));
await mkdir(join(profile, "Default"), { recursive: true });
await writeFile(join(profile, "Default", "Preferences"), JSON.stringify({
  download: { default_directory: downloadDir, prompt_for_download: false },
}));
let executablePath =
  process.env.DESIGN_SHELF_CHROMIUM || chromium.executablePath();
try {
  await access(executablePath);
} catch {
  const cache = dirname(dirname(dirname(chromium.executablePath())));
  const versions = (await readdir(cache))
    .filter((s) => /^chromium-\d+$/.test(s))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  if (process.platform !== "win32" || !versions.length)
    throw new Error(
      "Install Chromium with npx playwright install chromium or set DESIGN_SHELF_CHROMIUM.",
    );
  executablePath = join(cache, versions[0], "chrome-win64", "chrome.exe");
}
const extensionPath = resolve("extension");
const context = await chromium.launchPersistentContext(profile, {
  executablePath,
  headless: true,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
  viewport: { width: 1360, height: 1000 },
});
const failures = [];
const checks = [];
context.on("page", (page) =>
  page.on("pageerror", (error) => failures.push(error.message)),
);
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jYl8AAAAASUVORK5CYII=",
  "base64",
);
let failingMedia = false;
try {
  await context.route("https://x.com/**", async (route) =>
    route.fulfill({
      contentType: "text/html",
      body: await readFile("tests/fixtures/x-feed.html", "utf8"),
    }),
  );
  await context.route("https://pbs.twimg.com/**", async (route) => {
    if (failingMedia && route.request().url().includes("TestShelfTwo"))
      return route.fulfill({ status: 503, body: "Fixture unavailable" });
    return route.fulfill({ contentType: "image/png", body: png });
  });
  let worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  const library = await context.newPage();
  await library.goto(`chrome-extension://${id}/library.html`);
  await library.getByRole("button", { name: "Connect folder" }).waitFor();
  await library.locator("summary").click();
  await library.getByRole("button", { name: "Connect cloud vault" }).waitFor();
  await library.screenshot({path:join(output,"library-cloud.png"),fullPage:true});
  await library.locator("summary").click();
  await library.screenshot({
    path: join(output, "library-empty.png"),
    fullPage: true,
  });
  await library.evaluate(() => { window.showDirectoryPicker = undefined; });
  await library.getByRole("button", { name: "Connect folder" }).click();
  await library.getByText(/cannot select a folder/).waitFor({ timeout: 3000 });
  await library.getByRole("button", { name: "Use Downloads" }).waitFor();
  checks.push("Unavailable directory picker explains limitation and offers Downloads instead of TypeError");
  checks.push(
    "Real MV3 worker and library loaded without authenticated X actions",
  );
  if (process.argv.includes("--gallery")) {
    console.log("Empty gallery rendered");
  } else {
    const feed = await context.newPage();
    await feed.goto("https://x.com/home");
    await feed.locator('#primary [data-testid="like"]').click();
    const dialog = feed.getByRole("dialog");
    await dialog.waitFor();
    await dialog
      .getByRole("textbox", { name: /remember/i })
      .first()
      .fill("I want to remember this B2B dashboard hierarchy and spacing.");
    await dialog.getByRole("button", { name: /Save reference/i }).click();
    await dialog
      .getByText("Connect a folder in the library, then save again.")
      .waitFor();
    assert.equal(
      (
        await library.evaluate(async () =>
          (await import("./core/db.js")).getEntries(),
        )
      ).length,
      0,
    );
    checks.push(
      "Missing folder preserves modal draft, creates no stuck queue; setup can complete while modal remains open",
    );
    const settings = await library.evaluate(async () => {
      const db = await import("./core/db.js");
      const root = await navigator.storage.getDirectory();
      const chosen = await root.getDirectoryHandle("test-library", {
        create: true,
      });
      const candidateKey = `folderCandidate:${crypto.randomUUID()}`;
      await db.setSetting(candidateKey, chosen);
      return chrome.runtime.sendMessage({ type: "SET_FOLDER", candidateKey });
    });
    assert.equal(settings.ok, true, JSON.stringify(settings));
    assert.equal(settings.result.folder.permission, "granted");
    checks.push(
      "Directory handle stored in IndexedDB and connected through real runtime message (OPFS test directory)",
    );
    await library.getByRole("button", { name: "Refresh" }).click();
    await library.getByText("test-library", { exact: true }).waitFor();
    await dialog.getByRole("button", { name: "+ New category" }).click();
    await dialog
      .getByRole("textbox", { name: "New category name" })
      .fill("SaaS UI");
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await dialog.getByText("Category created.", { exact: true }).waitFor();
    await dialog.locator("#ds-tags").fill("dark, B2B");
    await dialog
      .getByRole("button", { name: "Spacing", exact: true })
      .click();
    await feed.screenshot({
      path: join(output, "capture-modal.png"),
      fullPage: true,
    });
    const mediaCount = await dialog.locator('input[type="checkbox"]').count();
    assert.equal(mediaCount >= 1, true);
    const preview = await dialog.locator("img").getAttribute("src");
    assert(!preview.includes("QuotedShelf"));
    await dialog
      .getByRole("textbox", { name: /remember/i })
      .first()
      .fill("I want to remember this B2B dashboard hierarchy and spacing.");
    const save = dialog.getByRole("button", { name: /Save reference/i });
    await save.click();
    await dialog.waitFor({ state: "hidden", timeout: 30000 });
    const entries = await library.evaluate(async () =>
      (await import("./core/db.js")).getEntries(),
    );
    assert.equal(entries.length, 1);
    assert.equal(entries[0].status, "saved", JSON.stringify(entries));
    assert.equal(
      entries[0].reference.images.length,
      1,
      "Quoted image must be excluded",
    );
    assert.equal(entries[0].reference.category.id, "saas-ui");
    assert.deepEqual(entries[0].reference.tags, ["dark", "B2B", "Spacing"]);
    const saved = await library.evaluate(async () => {
      const root = await (await import("./core/db.js")).getSetting("folder");
      const { items } = await (
        await import("./core/files.js")
      ).readLibrary(root);
      const item = items[0];
      const notes = await (
        await (await item.handle.getFileHandle("note.md")).getFile()
      ).text();
      const image = await (
        await item.handle.getFileHandle(item.reference.images[0].fileName)
      ).getFile();
      const json = await (
        await (await item.handle.getFileHandle("reference.json")).getFile()
      ).text();
      return { reference: JSON.parse(json), notes, imageSize: image.size };
    });
    assert.equal(saved.imageSize, png.length);
    assert(saved.notes.includes("hierarchy"));
    assert(saved.reference.url.includes("/12345678901"));
    await writeFile(
      join(output, "saved-reference.json"),
      JSON.stringify(saved, null, 2),
    );
    checks.push(
      "Fixture X like → isolated modal → confirmed PNG bytes + note.md + validated reference.json; quoted image excluded",
    );
    checks.push(
      "X content creates custom category; free tags and aspect chips persist in metadata",
    );
    await library.getByRole("button", { name: "Refresh" }).click();
    await library.locator(".reference-card").waitFor();
    await library.screenshot({
      path: join(output, "library-saved.png"),
      fullPage: true,
    });
    await library.getByRole("searchbox").fill("no-match");
    await library.locator(".reference-card").waitFor({ state: "hidden" });
    await library.getByRole("searchbox").fill("hierarchy");
    await library.locator(".reference-card").click();
    await library.getByRole("dialog").waitFor();
    assert.equal(await library.getByRole("dialog").locator("img").count(), 1);
    await library.getByRole("button", { name: "Close reference" }).click();
    checks.push(
      "Gallery uses local image blobs; note search + detail + original link",
    );
    // Unlike never opens a new dialog. Re-like duplicates keep the stored note.
    await feed.locator('#primary [data-testid="unlike"]').click();
    await feed.locator('#primary [data-testid="like"]').waitFor();
    assert.equal(await feed.getByRole("dialog").count(), 0);
    await feed.locator('#primary [data-testid="like"]').click();
    await dialog.waitFor();
    await feed.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(
      (
        await library.evaluate(async () =>
          (await import("./core/db.js")).getEntries(),
        )
      ).length,
      1,
    );
    await feed.locator('#primary [data-testid="unlike"]').click();
    await feed.locator('#primary [data-testid="like"]').waitFor();
    await feed.locator('#primary [data-testid="like"]').click();
    await dialog.waitFor();
    await dialog
      .getByRole("textbox", { name: /remember/i })
      .first()
      .fill("This second note must never overwrite the original.");
    await dialog.getByRole("button", { name: /Save reference/i }).click();
    await dialog.waitFor({ state: "hidden" });
    const duplicate = await library.evaluate(async () =>
      (await import("./core/db.js")).getEntries(),
    );
    assert.equal(duplicate.length, 1);
    assert.equal(duplicate[0].reference.note, entries[0].reference.note);
    checks.push(
      "Unlike ignored; repeat like save does not overwrite original files/note",
    );
    await feed.locator('#secondary [data-testid="like"]').click();
    await dialog.waitFor();
    await dialog.getByRole("button", { name: "Skip", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(
      (
        await library.evaluate(async () =>
          (await import("./core/db.js")).getEntries(),
        )
      ).length,
      1,
    );
    await feed.locator('#secondary [data-testid="unlike"]').click();
    await feed.locator('#secondary [data-testid="like"]').waitFor();
    checks.push(
      "Escape and Skip preserve likes and create no files/queue entries",
    );
    await feed.evaluate(() => {
      const media = document.createElement("div");
      media.dataset.testid = "tweetPhoto";
      const image = document.createElement("img");
      image.src =
        "https://pbs.twimg.com/media/TestShelfThree?format=png&name=small";
      image.alt = "Third own image";
      media.append(image);
      document.querySelector('#secondary [role="group"]').before(media);
    });
    failingMedia = true;
    await feed.locator('#secondary [data-testid="like"]').click();
    await dialog.waitFor();
    assert.equal(await dialog.locator("img").count(), 2);
    await dialog.getByRole("checkbox", { name: "Save image 2" }).uncheck();
    await dialog
      .getByRole("textbox", { name: /remember/i })
      .first()
      .fill(
        "Another reference to test recovery after a failed download.",
      );
    await dialog.getByRole("button", { name: /Save reference/i }).click();
    await dialog.waitFor({ state: "hidden", timeout: 30000 });
    await library.getByRole("button", { name: "Refresh" }).click();
    await library
      .getByRole("heading", { name: "Pending saves" })
      .waitFor();
    let pending = await library.evaluate(async () =>
      (await import("./core/db.js")).getEntries(),
    );
    assert.equal(
      pending.find((e) => e.postId === "22345678901").status,
      "pending",
    );
    // Restart just the extension worker using DevTools, keeping IndexedDB and the folder handle.
    const cdp = await context.newCDPSession(library);
    await cdp.send("ServiceWorker.enable");
    await cdp.send("ServiceWorker.stopAllWorkers");
    failingMedia = false;
    await library.getByRole("button", { name: "Retry saves" }).click();
    await library
      .locator("#pending-panel")
      .waitFor({ state: "hidden", timeout: 30000 });
    pending = await library.evaluate(async () =>
      (await import("./core/db.js")).getEntries(),
    );
    assert(pending.every((e) => e.status === "saved"));
    assert.equal(
      pending.find((e) => e.postId === "22345678901").reference.images.length,
      1,
    );
    checks.push(
      "503 keeps persisted pending entry; worker restart + explicit retry recovers folder handle and saves without duplicates",
    );
    checks.push(
      "Multiple own image previews and per-image selection save only chosen images",
    );
    const multi = await library.evaluate(() =>
      chrome.runtime.sendMessage({
        type: "SAVE_REFERENCE",
        reference: {
          postId: "42345678901",
          url: "https://x.com/multi/status/42345678901",
          author: "@multi",
          note: "Two images to test quick changes between reference details.",
          category: { id: "cards", label: "Cards" },
          tags: [],
          images: [
            {
              sourceUrl: "https://pbs.twimg.com/media/TestShelfFour?format=png",
            },
            {
              sourceUrl: "https://pbs.twimg.com/media/TestShelfFive?format=png",
            },
          ],
        },
      }),
    );
    assert.equal(multi.result.status, "saved");
    await library.getByRole("searchbox").fill("");
    await library.getByRole("button", { name: "Refresh" }).click();
    await library.waitForFunction(
      () => document.querySelectorAll(".reference-card").length === 3,
    );
    await library.evaluate(() => {
      const original = FileSystemDirectoryHandle.prototype.getFileHandle;
      FileSystemDirectoryHandle.prototype.getFileHandle = async function (
        name,
        options,
      ) {
        if (this.name.endsWith("_42345678901") && name === "image-01.png")
          await new Promise((resolve) => setTimeout(resolve, 350));
        return original.call(this, name, options);
      };
    });
    await library
      .locator(".reference-card")
      .filter({ hasText: "@multi" })
      .click();
    await library.getByRole("button", { name: "Close reference" }).click();
    await library
      .locator(".reference-card")
      .filter({ hasText: "@designer" })
      .click();
    await library.waitForTimeout(450);
    assert.equal(
      await library.locator("#detail-images img").count(),
      1,
      "Previous detail reads cannot append into new reference",
    );
    await library.getByRole("button", { name: "Close reference" }).click();
    checks.push(
      "Closing a slow multi-image detail and opening another reference does not mix image elements",
    );
    await feed.locator('#text-only [data-testid="like"]').click();
    await feed.locator('#text-only [data-testid="unlike"]').waitFor();
    assert.equal(await feed.getByRole("dialog").count(), 0);
    checks.push("Text-only like preserves X behavior without modal");
    await feed.locator('#primary [data-testid="unlike"]').click();
    await feed.locator('#primary [data-testid="like"]').waitFor();
    await feed
      .locator('#primary [data-testid="like"]')
      .evaluate((button) => (button.dataset.fixtureRerender = "true"));
    await feed.locator('#primary [data-testid="like"]').click();
    await dialog.waitFor();
    await dialog.getByRole("button", { name: "Skip", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await feed.locator('#primary [data-testid="unlike"]').click();
    await feed.locator('#primary [data-testid="like"]').waitFor();
    await feed
      .locator('#primary [data-testid="like"]')
      .evaluate((button) => delete button.dataset.fixtureRerender);
    await feed.locator('#secondary [data-testid="unlike"]').click();
    await feed.locator('#secondary [data-testid="like"]').waitFor();
    await feed.evaluate(() => (window.fixtureLikeDelay = 500));
    await feed.locator('#primary [data-testid="like"]').click();
    await feed.locator('#secondary [data-testid="like"]').click();
    await dialog.waitFor();
    await dialog.locator(".source").filter({ hasText: "@designer" }).waitFor();
    assert.equal(await dialog.count(), 1, "Only one queued dialog shown");
    await dialog.getByRole("button", { name: "Skip", exact: true }).click();
    await dialog.locator(".source").filter({ hasText: "@second" }).waitFor();
    assert.equal(await dialog.count(), 1);
    await dialog.getByRole("button", { name: "Skip", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    checks.push(
      "Tweet DOM replacement is detected; rapid confirmed likes queue sequential dialogs without stacking",
    );
    await feed.evaluate(() => (window.fixtureLikeDelay = 50));
    await feed.locator('#primary [data-testid="unlike"]').click();
    await feed.locator('#primary [data-testid="like"]').waitFor();
    await feed
      .locator('#primary [data-testid="like"]')
      .evaluate((button) => (button.dataset.fixtureNoConfirm = "true"));
    await feed.locator('#primary [data-testid="like"]').click();
    await feed.waitForTimeout(4200);
    assert.equal(await dialog.count(), 0);
    checks.push("Like that never reaches unlike confirmation opens no modal");
    await library.setViewportSize({ width: 390, height: 844 });
    await library.screenshot({
      path: join(output, "library-mobile.png"),
      fullPage: true,
    });
    const overflow = await library.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    assert.equal(overflow, false);
    checks.push("390px library layout has no horizontal overflow");
    await library.setViewportSize({ width: 1360, height: 1000 });
    const downloadSession = await context.newCDPSession(library);
    // DevTools "allow" replaces the extension's requested filename with the
    // server suggestion. Use the fresh test profile's normal download manager.
    await downloadSession.send("Browser.setDownloadBehavior", { behavior: "default" });
    await library.getByRole("button", { name: "Use Downloads" }).click();
    await library.getByText("Downloads / Design Shelf", { exact: true }).waitFor();
    const exported = await library.evaluate(async () => chrome.runtime.sendMessage({
      type: "SAVE_REFERENCE",
      reference: {
        url: "https://x.com/fixture/status/777999",
        note: "Test reference for Brave without a directory picker.",
        category: { id: "cards", label: "Cards" },
        tags: ["brave"],
        images: [{ sourceUrl: "https://pbs.twimg.com/media/DownloadShelf?format=png" }],
      },
    }));
    assert.equal(exported.ok, true, JSON.stringify(exported));
    assert.equal(exported.result.status, "saved", JSON.stringify(exported));
    const savedPath = join(downloadDir, "Design Shelf", exported.result.reference.relativePath);
    assert.deepEqual(await readFile(join(savedPath, "image-01.png")), png);
    assert.match(await readFile(join(savedPath, "note.md"), "utf8"), /Brave without a directory picker/);
    assert.equal(JSON.parse(await readFile(join(savedPath, "reference.json"), "utf8")).postId, "777999");
    await library.getByRole("button", { name: "Refresh" }).click();
    await library.locator(".reference-card").filter({ hasText: "Brave without a directory picker" }).waitFor();
    await library.reload();
    await library.locator(".reference-card").filter({ hasText: "Brave without a directory picker" }).waitFor();
    checks.push("Without picker, Downloads mode exports real image/note/JSON in category folders and persists gallery across reload");
    const renamedRelative = `cards/${new Date().toISOString().slice(0, 10)}_777998`;
    const renamedPath = join(downloadDir, "Design Shelf", renamedRelative);
    await mkdir(renamedPath, { recursive: true });
    await writeFile(join(renamedPath, "rojo.png"), "Existing user file");
    await library.evaluate(relative => {
      window.renameTestDownload = (item, suggest) => {
        if (item.byExtensionId !== chrome.runtime.id) return suggest();
        const name = item.mime === "image/png" ? "rojo.png"
          : item.mime === "application/json" ? "reference.json" : "note.md";
        suggest({ filename: `Design Shelf/${relative}/${name}`, conflictAction: "uniquify" });
      };
      chrome.downloads.onDeterminingFilename.addListener(window.renameTestDownload);
    }, renamedRelative);
    const renamed = await library.evaluate(async () => chrome.runtime.sendMessage({
      type: "SAVE_REFERENCE", reference: {
        url: "https://x.com/fixture/status/777998", note: "The color palette",
        category: { id: "cards", label: "Cards" },
        images: [{ sourceUrl: "https://pbs.twimg.com/media/RenameShelf?format=png" }],
      },
    }));
    assert.equal(renamed.result?.status, "saved", JSON.stringify(renamed));
    const renamedMetadata = JSON.parse(await readFile(join(renamedPath, "reference.json"), "utf8"));
    assert.equal(renamedMetadata.images[0].fileName, "rojo (1).png");
    assert.deepEqual(await readFile(join(renamedPath, renamedMetadata.images[0].fileName)), png);
    assert.equal(await readFile(join(renamedPath, "rojo.png"), "utf8"), "Existing user file");
    await library.evaluate(() => chrome.downloads.onDeterminingFilename.removeListener(window.renameTestDownload));
    checks.push("Real renamed/uniquified download records actual image name in metadata and preserves the preexisting user file");
  }
  assert.deepEqual(failures, [], "No uncaught page exceptions");
  const evidence = {
    passed: true,
    checks,
    browserVersion: context.browser()?.version(),
    limits: [
      "Synthetic X fixture; authenticated live X extraction remains unverified",
      "OPFS genuine directory handles; native external folder picker/permissions remain manual",
      "CDN fixture PNG, not real post download",
      "Google Drive synchronization not exercised",
    ],
    profile,
  };
  await writeFile(
    join(output, "browser-results.json"),
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await context.close();
}
