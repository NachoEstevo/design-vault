import {
  HttpError,
  fail,
  reference,
  requestBrief,
  imageType,
  digest,
  boundedBody,
  jsonBody,
} from "./contracts.js";
import { retrieve } from "./retrieval.js";

const CATALOG_KEY = "v1/private/catalog.json";
function response(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
export function createService() {
  let cache = null;
  async function catalog(env, fresh = false) {
    if (!fresh && cache && cache.expires > Date.now()) return cache;
    const object = await env.VAULT.get(CATALOG_KEY);
    fail(object && object.size > 5 * 1024 * 1024, "Catalog unavailable", 503);
    const value = object
      ? await object.json()
      : { schemaVersion: 1, references: [] };
    fail(
      value.schemaVersion !== 1 || !Array.isArray(value.references),
      "Catalog unavailable",
      503,
    );
    return (cache = { value, etag: object?.etag, expires: Date.now() + 30000 });
  }
  async function owner(request, env) {
    fail(
      typeof env.OWNER_TOKEN !== "string" || env.OWNER_TOKEN.length < 32,
      "Owner access is not configured",
      503,
    );
    const expected = await digest(`Bearer ${env.OWNER_TOKEN}`);
    const actual = await digest(request.headers.get("authorization") || "");
    fail(actual !== expected, "Unauthorized", 401);
  }
  return {
    async fetch(request, env) {
      try {
        const url = new URL(request.url);
        if (request.method === "OPTIONS")
          return new Response(null, {
            status: 204,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type,Authorization",
              "Access-Control-Max-Age": "600",
            },
          });
        if (url.pathname === "/health" && request.method === "GET")
          return response({
            ok: true,
            service: "design-vault",
            schemaVersion: 1,
            mode: "descriptions",
            inference: false,
          });
        if (url.pathname === "/v1/search" && request.method === "POST") {
          if (env.READER_LIMIT) {
            const result = await env.READER_LIMIT.limit({
              key: request.headers.get("CF-Connecting-IP") || "unknown",
            });
            fail(!result.success, "Too many requests. Try again later.", 429);
          }
          const brief = requestBrief(await jsonBody(request, 8192));
          return response(
            await retrieve((await catalog(env)).value.references, brief),
          );
        }
        if (url.pathname.startsWith("/admin/")) {
          await owner(request, env);
          if (url.pathname === "/admin/status" && request.method === "GET") {
            const refs = (await catalog(env, true)).value.references;
            return response({
              references: refs.length,
              images: refs.reduce((sum, r) => sum + r.images.length, 0),
              reviewed: refs.reduce(
                (sum, r) => sum + r.images.filter((i) => i.observation).length,
                0,
              ),
            });
          }
          if (url.pathname === "/admin/inventory" && request.method === "GET") {
            return response({
              references: (await catalog(env, true)).value.references.map(
                (ref) => ({
                  postId: ref.postId,
                  images: ref.images.map((image) => image.sha256),
                }),
              ),
            });
          }
          const upload = url.pathname.match(
            /^\/admin\/objects\/([a-f0-9]{64})$/,
          );
          if (upload && request.method === "PUT") {
            const bytes = await boundedBody(request, 20 * 1024 * 1024);
            const mimeType = imageType(bytes);
            fail(
              request.headers.get("content-type") !== mimeType,
              "Image type does not match content",
            );
            fail(
              (await digest(bytes)) !== upload[1],
              "Image digest does not match content",
            );
            await env.VAULT.put(`v1/objects/${upload[1]}`, bytes, {
              onlyIf: { etagDoesNotMatch: "*" },
              httpMetadata: { contentType: mimeType },
            });
            return response({ ok: true });
          }
          if (
            url.pathname === "/admin/references" &&
            request.method === "POST"
          ) {
            const ref = reference(await jsonBody(request));
            for (const [index, image] of ref.images.entries())
              image.id = (await digest(`${ref.postId}:${index}`)).slice(0, 24);
            for (const image of ref.images) {
              const object = await env.VAULT.head(`v1/objects/${image.sha256}`);
              fail(
                !object ||
                  object.size !== image.size ||
                  object.httpMetadata?.contentType !== image.mimeType,
                "Upload every image before committing its reference",
                409,
              );
            }
            // Optimistic R2 conditions serialize commits across isolates without a paid inference/DB service.
            for (let attempt = 0; attempt < 6; attempt++) {
              const current = await catalog(env, true);
              const existing = current.value.references.find(
                (r) => r.postId === ref.postId,
              );
              if (existing) {
                fail(
                  existing.images.map((i) => i.sha256).join() !==
                    ref.images.map((i) => i.sha256).join(),
                  "Existing reference has different images; it was preserved",
                  409,
                );
                for (const [index, image] of ref.images.entries())
                  image.observation ||= existing.images[index].observation;
              }
              const refs = current.value.references.filter(
                (r) => r.postId !== ref.postId,
              );
              refs.push(ref);
              fail(refs.length > 5000, "Catalog capacity reached", 507);
              const body = JSON.stringify({
                schemaVersion: 1,
                references: refs,
              });
              fail(
                new TextEncoder().encode(body).length > 5 * 1024 * 1024,
                "Catalog capacity reached",
                507,
              );
              const committed = await env.VAULT.put(CATALOG_KEY, body, {
                onlyIf: current.etag
                  ? { etagMatches: current.etag }
                  : { etagDoesNotMatch: "*" },
                httpMetadata: { contentType: "application/json" },
              });
              if (committed) {
                cache = null;
                return response({
                  ok: true,
                  status: existing ? "updated" : "saved",
                });
              }
            }
            throw new HttpError(
              503,
              "Another upload is committing. Retry this reference.",
            );
          }
        }
        // There is intentionally no catalog, original, proxy, arbitrary-key or signed-URL reader route.
        return response({ error: "Not found" }, 404);
      } catch (error) {
        return response(
          {
            error:
              error instanceof HttpError
                ? error.message
                : "Service unavailable",
          },
          error instanceof HttpError ? error.status : 503,
        );
      }
    },
  };
}
export default createService();
