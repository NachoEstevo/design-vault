import { getSetting, setSetting, getEntries } from "./core/db.js";
import { readLibrary } from "./core/files.js";

const $ = (id) => document.getElementById(id);
let folder = null;
let items = [];
let currentCategory = "";
let settings = { categories: [], folder: null, pendingCount: 0 };
let galleryUrls = [];
let detailUrls = [];
let visibleLimit = 60;
let refreshing = false;

async function message(type, data = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...data });
  if (!response?.ok)
    throw new Error(
      response?.error?.message ||
        "The extension could not complete this action. Try reloading it.",
    );
  return response.result;
}

function status(text = "", error = false) {
  $("status").textContent = text;
  $("status").classList.toggle("error", error);
}

function revoke(urls) {
  for (const url of urls) URL.revokeObjectURL(url);
  urls.length = 0;
}

async function localImage(item, image, urls) {
  const handle = await item.handle.getFileHandle(image.fileName);
  const file = await handle.getFile();
  const url = URL.createObjectURL(file);
  urls.push(url);
  return url;
}

function renderCategories() {
  const counts = new Map();
  for (const { reference } of items)
    counts.set(
      reference.category.id,
      (counts.get(reference.category.id) || 0) + 1,
    );
  const choices = new Map(settings.categories.map((c) => [c.id, c.label]));
  for (const { reference } of items)
    choices.set(reference.category.id, reference.category.label);
  $("categories").replaceChildren();
  for (const [id, label, count] of [
    ["", "All", items.length],
    ...Array.from(choices, ([id, label]) => [id, label, counts.get(id) || 0]),
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-pressed", String(currentCategory === id));
    const name = document.createElement("span");
    name.textContent = label;
    name.style.color = "inherit";
    const total = document.createElement("span");
    total.textContent = count;
    button.append(name, total);
    button.addEventListener("click", () => {
      currentCategory = id;
      visibleLimit = 60;
      renderCategories();
      renderGallery();
    });
    $("categories").append(button);
  }
  $("total-count").textContent = items.length;
}

function renderGallery() {
  revoke(galleryUrls);
  galleryUrls = [];
  const query = $("search").value.toLocaleLowerCase().trim();
  const filtered = items.filter(
    ({ reference: r }) =>
      (!currentCategory || r.category.id === currentCategory) &&
      `${r.note} ${r.author} ${r.text} ${r.tags.join(" ")} ${r.category.label}`
        .toLocaleLowerCase()
        .includes(query),
  );
  $("gallery").replaceChildren();
  $("results-label").textContent = filtered.length
    ? `${filtered.length} ${filtered.length === 1 ? "reference" : "references"} · sorted by date`
    : "";
  $("empty").hidden = filtered.length > 0;
  $("empty-help").textContent =
    query || currentCategory
      ? "No references match these filters. Try another search."
      : folder
        ? "Like a post with images on X to save your first reference."
        : "Connect a folder, open X, and like a post with images.";
  $("load-more").hidden = filtered.length <= visibleLimit;
  const urls = galleryUrls;
  for (const item of filtered.slice(0, visibleLimit)) {
    const r = item.reference;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "reference-card";
    const image = document.createElement("img");
    image.className = "reference-thumb";
    image.alt = `Reference: ${r.category.label}`;
    image.loading = "lazy";
    const info = document.createElement("span");
    info.className = "reference-info";
    for (const [className, text] of [
      ["reference-category", r.category.label],
      ["reference-note", r.note],
      [
        "reference-author",
        `${r.author || "X post"} · ${new Date(r.capturedAt).toLocaleDateString("en-US")}`,
      ],
    ]) {
      const part = document.createElement("span");
      part.className = className;
      part.textContent = text;
      info.append(part);
    }
    card.append(image, info);
    card.addEventListener("click", () => openDetails(item));
    $("gallery").append(card);
    localImage(item, r.images[0], urls)
      .then((url) => {
        if (urls !== galleryUrls) {
          URL.revokeObjectURL(url);
          return;
        }
        image.src = url;
      })
      .catch(() => {
        image.alt = "Image not available in the folder";
      });
  }
  // An earlier asynchronous image read may finish after this render. Its URL is
  // revoked by the generation check above, never attached to a stale card.
}

async function openDetails(item) {
  revoke(detailUrls);
  detailUrls = [];
  const urls = detailUrls;
  const r = item.reference;
  $("detail-heading").textContent = r.author || "X reference";
  $("detail-category").textContent = r.category.label;
  $("detail-note").textContent = r.note;
  $("detail-tags").replaceChildren(
    ...r.tags.map((text) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = text;
      return tag;
    }),
  );
  $("detail-images").replaceChildren();
  $("detail-meta").textContent =
    `Saved on ${new Date(r.capturedAt).toLocaleString("en-US")} · ${r.relativePath}`;
  $("detail-link").href = r.url;
  if (!$("details").open) $("details").showModal();
  for (const [index, image] of r.images.entries()) {
    if (urls !== detailUrls || !$("details").open) break;
    const img = document.createElement("img");
    img.alt = `Reference image ${index + 1}`;
    $("detail-images").append(img);
    try {
      const url = await localImage(item, image, urls);
      if (urls !== detailUrls || !$("details").open) {
        URL.revokeObjectURL(url);
        break;
      }
      img.src = url;
    } catch {
      img.alt = "This image is not available in the folder.";
    }
  }
}

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  $("refresh").disabled = true;
  try {
    settings = await message("GET_SETTINGS");
    folder = await getSetting("folder");
    $("folder-name").textContent =
      settings.folder?.name || "Choose a storage folder";
    $("choose-folder").firstChild.textContent = folder
      ? "Change folder "
      : "Connect folder ";
    const downloads = settings.folder?.mode === "downloads";
    $("use-downloads").hidden = downloads;
    $("choose-folder").hidden = downloads && typeof window.showDirectoryPicker !== "function";
    $("renew-permission").hidden =
      !folder || settings.folder?.permission === "granted";
    $("folder-help").textContent = downloads
      ? "Images and notes are saved in Downloads/Design Shelf. Sync that folder with Drive if needed. The gallery uses a private browser copy."
      : !folder
      ? "A folder you control. Optionally sync it with Drive for desktop."
      : settings.folder?.permission !== "granted"
        ? "Renew folder access to read and save references."
        : "Files are saved here. Drive for desktop can sync this folder.";
    const entries = await getEntries();
    const pending = entries.filter((entry) => entry.status === "pending");
    $("pending-panel").hidden = pending.length === 0;
    $("pending-list").replaceChildren(
      ...pending.map((entry) => {
        const li = document.createElement("li");
        li.textContent = `${entry.reference?.note || entry.postId} — ${entry.error?.message || entry.error || "Waiting to save"}`;
        return li;
      }),
    );
    let warnings = [];
    items = [];
    if (folder && settings.folder?.permission === "granted") {
      const library = await readLibrary(folder);
      // An export can fail after the private copy was written. Show that entry
      // in pending, not as a successfully saved reference in the gallery.
      const pendingIds = new Set(pending.map(entry => entry.postId));
      items = settings.folder?.mode === "downloads"
        ? library.items.filter(item => !pendingIds.has(item.reference.postId))
        : library.items;
      warnings = library.warnings;
      items.sort((a, b) =>
        b.reference.capturedAt.localeCompare(a.reference.capturedAt),
      );
    }
    if (warnings.length)
      status(
        `${warnings.length} ${warnings.length === 1 ? "reference could not be read" : "references could not be read"}. ${warnings.slice(0, 3).join(" ")}`,
        true,
      );
    renderCategories();
    renderGallery();
  } catch (error) {
    status(error.message, true);
  } finally {
    refreshing = false;
    $("refresh").disabled = false;
  }
}

$("choose-folder").addEventListener("click", async () => {
  if (typeof window.showDirectoryPicker !== "function") {
    status("This browser cannot select a folder. Choose Use Downloads to save in Downloads/Design Shelf.", true);
    return;
  }
  if (settings.pendingCount > 0) {
    status(
      "Retry pending saves before switching folders.",
      true,
    );
    return;
  }
  let candidateKey;
  try {
    // The picker must be the first asynchronous call inside the user's click.
    const selected = await window.showDirectoryPicker({
      id: "design-shelf",
      mode: "readwrite",
    });
    candidateKey = `folderCandidate:${crypto.randomUUID()}`;
    await setSetting(candidateKey, selected);
    await message("SET_FOLDER", { candidateKey });
    status("Folder connected. You can now save references from X.");
    await refresh();
  } catch (error) {
    if (error.name !== "AbortError") status(error.message, true);
  } finally {
    if (candidateKey) await setSetting(candidateKey, null);
  }
});
$("use-downloads").addEventListener("click", async () => {
  $("use-downloads").disabled = true;
  try {
    await message("USE_DOWNLOADS");
    await refresh();
    status("Downloads/Design Shelf is ready. You can now save from X.");
  } catch (error) {
    status(error.message, true);
  } finally {
    $("use-downloads").disabled = false;
  }
});
$("renew-permission").addEventListener("click", async () => {
  try {
    if (!folder) return;
    const permission = await folder.requestPermission({ mode: "readwrite" });
    status(
      permission === "granted"
        ? "Access renewed. You can retry pending saves."
        : "Folder access was not granted.",
      permission !== "granted",
    );
    await refresh();
  } catch (error) {
    status(error.message, true);
  }
});
$("retry-pending").addEventListener("click", async () => {
  $("retry-pending").disabled = true;
  status("Retrying saves…");
  try {
    await message("RETRY_PENDING");
    await refresh();
    status(
      settings.pendingCount
        ? "Some saves are still pending. Check the error and folder access."
        : "All pending saves are complete.",
      settings.pendingCount > 0,
    );
  } catch (error) {
    status(error.message, true);
  } finally {
    $("retry-pending").disabled = false;
  }
});
$("refresh").addEventListener("click", () => {
  status();
  refresh();
});
$("search").addEventListener("input", () => {
  visibleLimit = 60;
  renderGallery();
});
$("load-more").addEventListener("click", () => {
  visibleLimit += 60;
  renderGallery();
});
$("close-details").addEventListener("click", () => $("details").close());
$("details").addEventListener("close", () => {
  revoke(detailUrls);
  detailUrls = [];
});
window.addEventListener("pagehide", () => {
  revoke(galleryUrls);
  revoke(detailUrls);
});
refresh();
