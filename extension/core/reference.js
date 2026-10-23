export const DEFAULT_CATEGORIES = [
  "Cards",
  "Landings",
  "Dashboards",
  "Colores",
  "Tipografía",
  "Componentes",
  "Layouts",
  "Ilustraciones",
  "Branding",
  "Otros",
].map(normalizeCategory);
function string(value, max, name) {
  if (typeof value !== "string" || value.length > max)
    throw new Error(`${name} inválido`);
  return value.trim();
}
export function normalizeCategory(label) {
  label = string(label, 80, "Categoría");
  if (!label || /[\\/<>:"|?*\x00-\x1f]/.test(label) || label.includes(".."))
    throw new Error("Categoría insegura");
  const id = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!id || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(id))
    throw new Error("Categoría inválida");
  return { id, label };
}
export function normalizeImageUrl(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    throw new Error("URL de imagen inválida");
  }
  if (
    u.protocol !== "https:" ||
    u.hostname !== "pbs.twimg.com" ||
    u.port ||
    u.username ||
    u.password ||
    !/^\/media\/[A-Za-z0-9_-]+(?:\.(?:jpg|jpeg|png|webp))?$/.test(u.pathname)
  )
    throw new Error("URL de imagen inválida");
  u.hash = "";
  const format = u.searchParams.get("format");
  u.search = "";
  if (format && ["jpg", "jpeg", "png", "webp"].includes(format))
    u.searchParams.set("format", format);
  u.searchParams.set("name", "orig");
  return u.href;
}
export function normalizeReference(input, now = new Date()) {
  if (!input || typeof input !== "object")
    throw new Error("Referencia inválida");
  let u;
  try {
    u = new URL(input.url);
  } catch {
    throw new Error("URL inválida");
  }
  const match = u.pathname.match(
    /^\/([A-Za-z0-9_]+)\/status\/([1-9][0-9]{0,24})\/?$/,
  );
  if (
    u.protocol !== "https:" ||
    !["x.com", "twitter.com", "www.x.com", "www.twitter.com"].includes(
      u.hostname,
    ) ||
    u.port ||
    u.username ||
    u.password ||
    !match
  )
    throw new Error("Post inválido");
  const postId = match[2];
  if (input.postId !== undefined && String(input.postId) !== postId)
    throw new Error("ID inconsistente");
  const note = string(input.note, 10000, "Nota");
  if (!note) throw new Error("La nota es obligatoria");
  const category = normalizeCategory(
    typeof input.category === "string" ? input.category : input.category?.label,
  );
  if (input.category?.id && input.category.id !== category.id)
    throw new Error("Categoría inconsistente");
  if (
    !Array.isArray(input.images) ||
    input.images.length < 1 ||
    input.images.length > 4
  )
    throw new Error("Elegí entre 1 y 4 imágenes");
  const images = input.images.map((i) => ({
    sourceUrl: normalizeImageUrl(typeof i === "string" ? i : i.sourceUrl),
  }));
  if (new Set(images.map((i) => i.sourceUrl)).size !== images.length)
    throw new Error("Imágenes duplicadas");
  if (input.tags !== undefined && !Array.isArray(input.tags))
    throw new Error("Etiquetas inválidas");
  if ((input.tags || []).length > 30) throw new Error("Demasiadas etiquetas");
  const tags = [
    ...new Set(
      (input.tags || []).map((t) => string(t, 80, "Etiqueta")).filter(Boolean),
    ),
  ];
  const capturedAt = now.toISOString();
  return {
    schemaVersion: 1,
    postId,
    url: `https://x.com/${match[1]}/status/${postId}`,
    author: string(input.author || match[1], 200, "Autor"),
    text: string(input.text || "", 20000, "Texto"),
    capturedAt,
    note,
    category,
    tags,
    images,
    relativePath: `${category.id}/${capturedAt.slice(0, 10)}_${postId}`,
  };
}
