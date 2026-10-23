import test from "node:test";
import assert from "node:assert/strict";
test("authenticated X can add categories, untrusted senders cannot", async () => {
  let listener;
  globalThis.chrome = {
    runtime: {
      id: "test-extension",
      onMessage: {
        addListener(fn) {
          listener = fn;
        },
      },
      getURL: (path) => `chrome-extension://test-extension/${path}`,
    },
    action: { onClicked: { addListener() {} } },
    tabs: { create: async () => ({}) },
  };
  await import("../extension/background.js");
  // Unsafe labels exercise real normalization before IndexedDB, proving allowed dispatch.
  const dispatch = (message, sender) =>
    new Promise((resolve) => listener(message, sender, resolve));
  const trusted = await dispatch(
    { type: "ADD_CATEGORY", label: "../unsafe" },
    { id: "test-extension", url: "https://x.com/home" },
  );
  assert.equal(trusted.error.code, "CAPTURE_ERROR");
  assert.match(trusted.error.message, /Categoría/);
  const foreign = await dispatch(
    { type: "ADD_CATEGORY", label: "Cards" },
    { id: "other", url: "https://x.com/home" },
  );
  assert.equal(foreign.error.code, "INVALID_MESSAGE");
  const restricted = await dispatch(
    { type: "SET_FOLDER", candidateKey: "a" },
    { id: "test-extension", url: "https://x.com/home" },
  );
  assert.equal(restricted.error.code, "INVALID_MESSAGE");
  const downloads = await dispatch(
    { type: "USE_DOWNLOADS" },
    { id: "test-extension", url: "https://x.com/home" },
  );
  assert.equal(downloads.error.code, "INVALID_MESSAGE");
});
