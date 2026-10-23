import {
  saveReference,
  retryPending,
  getSettings,
  addCategory,
  setFolder,
  useDownloads,
} from "./core/capture-service.js";
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const own = sender.id === chrome.runtime.id;
  let page = false,
    x = false;
  try {
    const url = new URL(sender.url);
    page =
      url.protocol === "chrome-extension:" && url.host === chrome.runtime.id;
    x =
      url.protocol === "https:" &&
      ["x.com", "twitter.com"].includes(url.hostname);
  } catch {}
  const handlers = {
    GET_SETTINGS: () => getSettings(),
    SAVE_REFERENCE: () => saveReference(message.reference),
    ADD_CATEGORY: () => addCategory(message.label),
    RETRY_PENDING: () => retryPending(),
    SET_FOLDER: () => setFolder(message.candidateKey),
    USE_DOWNLOADS: () => useDownloads(),
    OPEN_LIBRARY: () =>
      chrome.tabs
        .create({ url: chrome.runtime.getURL("library.html") })
        .then(() => ({ opened: true })),
  };
  if (
    !own ||
    (!page && !x) ||
    !message ||
    !handlers[message.type] ||
    (!page &&
      ![
        "GET_SETTINGS",
        "SAVE_REFERENCE",
        "OPEN_LIBRARY",
        "ADD_CATEGORY",
      ].includes(message.type))
  ) {
    respond({
      ok: false,
      error: { code: "INVALID_MESSAGE", message: "Solicitud no permitida" },
    });
    return false;
  }
  Promise.resolve()
    .then(handlers[message.type])
    .then(
      (result) => respond({ ok: true, result }),
      (error) =>
        respond({
          ok: false,
          error: {
            code: error.code || "CAPTURE_ERROR",
            message: error.message,
          },
        }),
    );
  return true;
});
chrome.action.onClicked.addListener(() =>
  chrome.tabs.create({ url: chrome.runtime.getURL("library.html") }),
);
