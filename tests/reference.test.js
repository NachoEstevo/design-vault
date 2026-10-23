import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeReference,
  normalizeCategory,
  normalizeImageUrl,
} from "../extension/core/reference.js";
export const valid = {
  url: "https://twitter.com/alice/status/123",
  note: " Layout ",
  category: { id: "cards", label: "Cards" },
  images: [
    { sourceUrl: "https://pbs.twimg.com/media/abc?format=jpg&name=small" },
  ],
  tags: [" dark ", "dark", "B2B"],
};
test("normalizes identity, tags and CDN original size", () => {
  const r = normalizeReference(valid);
  assert.equal(r.postId, "123");
  assert.equal(r.url, "https://x.com/alice/status/123");
  assert.deepEqual(r.tags, ["dark", "B2B"]);
  assert.match(r.images[0].sourceUrl, /name=orig/);
});
test("rejects unsafe input and empty notes", () => {
  assert.throws(() => normalizeReference({ ...valid, note: " " }), /nota/i);
  assert.throws(() => normalizeCategory("../bad"));
  assert.throws(() => normalizeImageUrl("https://example.com/a.png"));
  assert.throws(() => normalizeReference({ ...valid, postId: "999" }));
});
