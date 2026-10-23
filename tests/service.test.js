import test from "node:test";
import assert from "node:assert/strict";
import { createService } from "../service/worker.js";
import { digest, reference } from "../service/contracts.js";
import { retrieve } from "../service/retrieval.js";

// Conditional writes model R2's compare-and-swap contract, including contention.
class Bucket {
  data = new Map();
  sequence = 0;
  conflicts = 0;
  async get(key) {
    const value = this.data.get(key);
    return (
      value && {
        ...value,
        json: async () => JSON.parse(new TextDecoder().decode(value.body)),
      }
    );
  }
  async head(key) {
    return this.get(key);
  }
  async delete(key) {
    this.data.delete(key);
  }
  async put(key, body, options = {}) {
    const old = this.data.get(key),
      condition = options.onlyIf;
    if (
      (condition?.etagMatches && condition.etagMatches !== old?.etag) ||
      (condition?.etagDoesNotMatch === "*" && old)
    )
      return null;
    if (key.includes("catalog") && this.conflicts-- > 0) return null;
    const bytes =
      typeof body === "string" ? new TextEncoder().encode(body) : body;
    const value = {
      body: bytes,
      size: bytes.length,
      etag: String(++this.sequence),
      httpMetadata: options.httpMetadata,
    };
    this.data.set(key, value);
    return value;
  }
}
const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const token = "test-owner-credential-".repeat(3);
async function fixture() {
  const env = { VAULT: new Bucket(), OWNER_TOKEN: token };
  const service = createService();
  const sha256 = await digest(bytes);
  const ref = {
    postId: "12345",
    capturedAt: new Date().toISOString(),
    category: { id: "cards", label: "Cards" },
    note: "PRIVATE owner secret warm cards",
    tags: ["cards", "warm"],
    images: [
      {
        sha256,
        size: bytes.length,
        mimeType: "image/png",
        observation: {
          summary: "Warm editorial cards with generous spacing",
          style: ["editorial"],
          palette: ["cream"],
          components: ["cards"],
          typography: "Serif headings",
          layout: "Three cards on a wide row",
          signature: "Cards overlap a full-bleed photograph",
          colors: ["#F2EDE4", "#24483c"],
        },
      },
    ],
  };
  const call = async (path, method = "GET", body, auth = true, headers = {}) =>
    service.fetch(
      new Request(`https://service.test${path}`, {
        method,
        headers: {
          ...(auth ? { Authorization: `Bearer ${token}` } : {}),
          ...(body
            ? {
                "Content-Type":
                  body instanceof Uint8Array ? "image/png" : "application/json",
              }
            : {}),
          ...headers,
        },
        ...(body
          ? { body: body instanceof Uint8Array ? body : JSON.stringify(body) }
          : {}),
      }),
      env,
    );
  return { env, ref, call, sha256 };
}
test("private upload commits only complete references; anonymous retrieval excludes private fields and originals", async () => {
  const { call, ref, sha256 } = await fixture();
  assert.equal((await call("/admin/references", "POST", ref)).status, 409);
  assert.equal(
    (await call(`/admin/objects/${sha256}`, "PUT", bytes, false)).status,
    401,
  );
  assert.equal(
    (await call(`/admin/objects/${sha256}`, "PUT", bytes)).status,
    200,
  );
  assert.equal((await call("/admin/references", "POST", ref)).status, 200);
  assert.equal((await call("/admin/references", "POST", ref)).status, 200);
  assert.deepEqual(await (await call("/admin/status")).json(), {
    references: 1,
    images: 1,
    reviewed: 1,
  });
  const result = await (
    await call(
      "/v1/search",
      "POST",
      { query: "warm cards", components: ["cards"], session: "test" },
      false,
    )
  ).json();
  assert.equal(result.references.length, 1);
  assert.equal(result.references[0].reviewed, true);
  assert.equal(result.references[0].signature, "Cards overlap a full-bleed photograph");
  assert.deepEqual(result.references[0].colors, ["#f2ede4", "#24483c"]);
  assert.equal(result.coverage[0].reviewed, true);
  assert(
    !/PRIVATE|secret|12345|sha256|https:|v1\/objects|note/.test(
      JSON.stringify(result.references),
    ),
  );
  for (const path of [
    "/v1/catalog",
    `/v1/objects/${sha256}`,
    "/v1/private/catalog.json",
    "/originals/12345",
  ])
    assert.equal((await call(path)).status, 404);
  assert.equal(
    (await call("/admin/status", "GET", undefined, false)).status,
    401,
  );
  assert.equal(
    (await call("/admin/inventory", "GET", undefined, false)).status,
    401,
  );
});
test("content addressing, type checks, immutable references and bounded inputs", async () => {
  const { call, ref, sha256 } = await fixture();
  assert.equal(
    (await call(`/admin/objects/${"0".repeat(64)}`, "PUT", bytes)).status,
    400,
  );
  const badColors = structuredClone(ref);
  badColors.images[0].observation.colors = ["blue"];
  await call(`/admin/objects/${sha256}`, "PUT", bytes);
  assert.equal((await call("/admin/references", "POST", badColors)).status, 400);
  assert.equal(
    (
      await call(`/admin/objects/${sha256}`, "PUT", bytes, true, {
        "Content-Type": "image/jpeg",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(`/admin/objects/${sha256}`, "PUT", bytes, true, {
        "Content-Length": "99999999",
      })
    ).status,
    413,
  );
  await call(`/admin/objects/${sha256}`, "PUT", bytes);
  await call("/admin/references", "POST", ref);
  const different = new Uint8Array([...bytes, 1]);
  const other = await digest(different);
  await call(`/admin/objects/${other}`, "PUT", different);
  assert.equal(
    (
      await call("/admin/references", "POST", {
        ...ref,
        images: [{ ...ref.images[0], sha256: other, size: different.length }],
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        "/v1/search",
        "POST",
        { query: "cards", session: "s", limit: 100 },
        false,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/v1/search",
        "POST",
        { query: "a".repeat(9000), session: "s" },
        false,
      )
    ).status,
    413,
  );
  assert.throws(() =>
    reference({ ...ref, tags: ["https://original.test/file"] }),
  );
  assert.throws(() =>
    reference({
      ...ref,
      images: [
        {
          ...ref.images[0],
          observation: { summary: "data:image/png;base64,abc" },
        },
      ],
    }),
  );
});
test("bounded contention retry preserves complete catalog and rate limit is enforced", async () => {
  const { call, ref, sha256, env } = await fixture();
  await call(`/admin/objects/${sha256}`, "PUT", bytes);
  env.VAULT.conflicts = 2;
  assert.equal((await call("/admin/references", "POST", ref)).status, 200);
  env.VAULT.conflicts = 10;
  assert.equal(
    (await call("/admin/references", "POST", { ...ref, postId: "67890" }))
      .status,
    503,
  );
  assert.equal((await (await call("/admin/status")).json()).references, 1);
  env.READER_LIMIT = { limit: async () => ({ success: false }) };
  assert.equal(
    (await call("/v1/search", "POST", { query: "cards", session: "s" }, false))
      .status,
    429,
  );
});
test("retrieval sets a direction, covers each requested role and avoids near-duplicate complements", async () => {
  const look = (id, components, style, palette, tags = ["warm"]) => ({
    postId: id,
    category: { id: "landings" },
    note: "warm",
    tags,
    images: [
      {
        id: `${id}:0`,
        sha256: id.padStart(64, "0"),
        observation: { summary: "Warm landing", style, palette, components },
      },
    ],
  });
  const result = await retrieve(
    [
      look("1", ["hero", "cards"], ["editorial", "warm"], ["cream", "brown"]),
      look("2", ["hero", "cards"], ["editorial", "warm"], ["cream", "brown"]),
      look("3", ["hero", "cards"], ["dark", "technical"], ["black", "green"]),
      look("4", ["footer"], ["quiet"], ["white"], ["warm", "footer"]),
    ],
    { query: "warm landing cards", components: ["footer"], session: "roles", limit: 3 },
  );
  const roles = Object.fromEntries(result.references.map((item) => [item.id, item.role]));
  assert.equal(result.references[0].role, "direction");
  assert.equal(Object.values(roles).filter((role) => role === "footer").length, 1);
  assert.equal(roles["4:0"], "footer");
  // Two identical warm editorial looks never fill the remaining slot together.
  assert(!("1:0" in roles && "2:0" in roles));
});
test("owner deletes a reference and its originals; readers and strangers cannot", async () => {
  const { call, ref, sha256, env } = await fixture();
  await call(`/admin/objects/${sha256}`, "PUT", bytes);
  await call("/admin/references", "POST", ref);
  assert.equal((await call("/admin/references/12345", "DELETE", undefined, false)).status, 401);
  assert.equal((await call("/admin/references/12345", "DELETE")).status, 200);
  assert.equal(env.VAULT.data.has(`v1/objects/${sha256}`), false);
  assert.deepEqual(await (await call("/admin/status")).json(), { references: 0, images: 0, reviewed: 0 });
  assert.equal((await call("/admin/references/12345", "DELETE")).status, 404);
});
