export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function fail(condition, message, status = 400) {
  if (condition) throw new HttpError(status, message);
}
export function text(value, max, name, empty = false) {
  fail(
    typeof value !== "string" ||
      value.length > max ||
      (!empty && !value.trim()),
    `Invalid ${name}`,
  );
  return value.trim();
}
export function strings(value, maxItems, maxLength, name) {
  fail(!Array.isArray(value) || value.length > maxItems, `Invalid ${name}`);
  return [...new Set(value.map((v) => text(v, maxLength, name)))];
}
const unsafePublic =
  /(?:https?:|data:|file:|[A-Z]:[\\/]|[A-Za-z0-9+/]{100,}={0,2})/i;
export function publicText(value, max, name, empty = false) {
  const result = text(value, max, name, empty);
  fail(
    unsafePublic.test(result),
    `Remove links, paths, or encoded data from ${name}`,
  );
  return result;
}
export function observation(value) {
  if (value == null) return null;
  fail(
    typeof value !== "object" || Array.isArray(value),
    "Invalid observation",
  );
  const result = { summary: publicText(value.summary, 1200, "visual summary") };
  for (const key of ["style", "palette", "components"])
    result[key] = strings(value[key] || [], 20, 80, key).map((v) =>
      publicText(v, 80, key),
    );
  for (const key of ["typography", "uncertainty"])
    result[key] = publicText(value[key] || "", 600, key, true);
  return result;
}
export function reference(value) {
  fail(!value || typeof value !== "object", "Invalid reference");
  const postId = text(value.postId, 25, "post ID");
  fail(!/^[1-9][0-9]{0,24}$/.test(postId), "Invalid post ID");
  const category = value.category;
  fail(
    !category || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(category.id),
    "Invalid category",
  );
  fail(
    !Array.isArray(value.images) ||
      value.images.length < 1 ||
      value.images.length > 4,
    "Select one to four images",
  );
  const images = value.images.map((image) => {
    fail(!/^[a-f0-9]{64}$/.test(image.sha256), "Invalid image digest");
    fail(
      !["image/png", "image/jpeg", "image/webp"].includes(image.mimeType),
      "Invalid image type",
    );
    fail(
      !Number.isInteger(image.size) ||
        image.size < 12 ||
        image.size > 20 * 1024 * 1024,
      "Invalid image size",
    );
    return {
      sha256: image.sha256,
      mimeType: image.mimeType,
      size: image.size,
      observation: observation(image.observation),
    };
  });
  fail(
    new Set(images.map((i) => i.sha256)).size !== images.length,
    "Duplicate images",
  );
  const capturedAt = text(value.capturedAt, 40, "capture date");
  fail(!Number.isFinite(Date.parse(capturedAt)), "Invalid capture date");
  // Deliberate allowlist: original URLs, local paths, author and post copy are not needed.
  return {
    postId,
    category: {
      id: category.id,
      label: publicText(category.label, 80, "category"),
    },
    note: text(value.note || "", 10000, "private note", true),
    tags: strings(value.tags || [], 30, 80, "tags").map((t) =>
      publicText(t, 80, "tag"),
    ),
    capturedAt,
    images,
  };
}
export function requestBrief(value) {
  fail(!value || typeof value !== "object", "Invalid request");
  return {
    query: text(value.query || value.brief, 2000, "query"),
    components: strings(value.components || [], 8, 80, "components"),
    session: text(value.session, 80, "session"),
    limit: value.limit ?? 5,
  };
}
export function imageType(bytes) {
  if (
    bytes.length >= 12 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg";
  if (
    bytes.length >= 12 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  throw new HttpError(400, "Unsupported image signature");
}
export async function digest(value) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export async function boundedBody(request, maximum) {
  fail(
    Number(request.headers.get("content-length")) > maximum,
    "Request too large",
    413,
  );
  fail(!request.body, "Missing request body");
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > maximum) {
      await reader.cancel();
      throw new HttpError(413, "Request too large");
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export async function jsonBody(request, maximum = 65536) {
  fail(
    !request.headers.get("content-type")?.startsWith("application/json"),
    "Expected application/json",
    415,
  );
  try {
    return JSON.parse(
      new TextDecoder().decode(await boundedBody(request, maximum)),
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid JSON");
  }
}
