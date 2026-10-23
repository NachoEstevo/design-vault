import { fail } from "./contracts.js";

const groups = [
  "cards card tarjeta tarjetas",
  "landing landings hero portada",
  "dashboard dashboards panel tablero",
  "warm warmth calido calida calidez",
  "airy spacious whitespace spacing espacio aire espaciado",
  "agency agencia studio estudio",
  "minimal minimalist minimalista simple sencillo",
  "color colors colour colores palette paleta",
  "typography font fonts tipografia fuente fuentes",
  "layout layouts composition composicion grid grilla",
  "form forms formulario contacto contact",
  "footer footers pie cierre",
  "green verde",
  "white blanco",
  "black negro",
  "texture textura papel paper",
  "product products producto productos",
  "bakery bread pan panaderia",
  "saas software ai agents agentes",
];
const stopwords = new Set(
  "a an the and or for with of to in on from this some is it una un de del el la los las para con y o que en es su por algo".split(
    " ",
  ),
);
function tokens(value) {
  return new Set(
    (
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .match(/[a-z0-9]+/g) || []
    ).filter((word) => !stopwords.has(word)),
  );
}
function expanded(value) {
  const result = tokens(value);
  for (const group of groups) {
    const words = group.split(" ");
    if (words.some((word) => result.has(word)))
      for (const word of words) result.add(word);
  }
  return result;
}
function score(query, value) {
  return [...tokens(value)].filter((word) => query.has(word)).length;
}
function fraction(value) {
  let hash = 2166136261;
  for (const char of value)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 0xffffffff;
}
export async function retrieve(references, brief) {
  fail(
    !Number.isInteger(brief.limit) || brief.limit < 1 || brief.limit > 12,
    "Limit must be between one and twelve",
  );
  const query = expanded(brief.query + " " + brief.components.join(" "));
  const candidates = [];
  for (const ref of references) {
    for (const [index, image] of ref.images.entries()) {
      const visual = image.observation;
      const relevance =
        score(query, ref.note) * 4 +
        score(query, ref.tags.join(" ")) * 3 +
        score(query, ref.category.id) * 2 +
        score(query, JSON.stringify(visual || {})) * 5;
      if (!relevance) continue;
      const id = image.id;
      // Session-stable tie breaking; a different session can explore alternatives.
      const tie = fraction(`${brief.session}:${id}`);
      candidates.push({
        ref,
        image,
        id,
        relevance,
        priority: relevance * (0.75 + tie * 0.5) + (visual ? 1 : 0),
      });
    }
  }
  candidates.sort((a, b) => b.priority - a.priority);
  // Give requested roles a reviewed candidate before filling with general inspiration.
  const roleCandidates = [];
  const matchesRole = (candidate, component) =>
    candidate.image.observation &&
    score(
      expanded(component),
      candidate.image.observation.components.join(" ") +
        " " +
        candidate.ref.category.id,
    ) > 0;
  for (const component of brief.components) {
    if (roleCandidates.some((candidate) => matchesRole(candidate, component)))
      continue;
    const candidate = candidates.find((candidate) =>
      matchesRole(candidate, component),
    );
    if (candidate) roleCandidates.push(candidate);
  }
  const perPost = new Map(),
    hashes = new Set(),
    picked = [];
  const look = (candidate) => {
    const visual = candidate.image.observation;
    return visual
      ? tokens([...visual.style, ...visual.palette, ...visual.components].join(" "))
      : new Set();
  };
  // Overlap of style, palette and components; near-duplicates crowd out complements.
  const similar = (candidate) => {
    const own = look(candidate);
    if (!own.size) return false;
    return picked.some(({ candidate: other }) => {
      const prior = look(other);
      const shared = [...own].filter((word) => prior.has(word)).length;
      return shared / (own.size + prior.size - shared || 1) > 0.5;
    });
  };
  const take = (candidate, role) => {
    if (picked.length >= brief.limit || picked.some((item) => item.candidate.id === candidate.id))
      return;
    if (
      (perPost.get(candidate.ref.postId) || 0) >= 2 ||
      hashes.has(candidate.image.sha256)
    )
      return;
    perPost.set(candidate.ref.postId, (perPost.get(candidate.ref.postId) || 0) + 1);
    hashes.add(candidate.image.sha256);
    picked.push({ candidate, role });
  };
  // The strongest match sets the direction; each requested role then gets its own reference.
  if (candidates[0]) take(candidates[0], "direction");
  for (const candidate of roleCandidates)
    take(
      candidate,
      brief.components.find((component) => matchesRole(candidate, component)),
    );
  for (const candidate of candidates)
    if (!similar(candidate)) take(candidate, "complement");
  for (const candidate of candidates) take(candidate, "complement");
  const selected = picked.map(({ candidate, role }) => {
    const visual = candidate.image.observation;
    // No spreads of private records: notes, post IDs, digests and object keys never cross this boundary.
    return {
      id: candidate.id,
      role,
      category: candidate.ref.category.id,
      tags: candidate.ref.tags,
      reviewed: Boolean(visual),
      description:
        visual?.summary ||
        "Metadata match only. No reviewed visual description is available.",
      style: visual?.style || [],
      palette: visual?.palette || [],
      components: visual?.components || [],
      typography: visual?.typography || "",
      layout: visual?.layout || "",
      signature: visual?.signature || "",
      recipe: visual?.recipe || "",
      colors: visual?.colors || [],
      uncertainty:
        visual?.uncertainty ||
        "Original pixels are not provided to this client.",
    };
  });
  return {
    schemaVersion: 1,
    mode: "descriptions",
    session: brief.session,
    references: selected,
    coverage: brief.components.map((component) => ({
      component,
      reviewed: selected.some(
        (item) =>
          item.reviewed &&
          score(
            expanded(component),
            item.components.join(" ") + " " + item.category,
          ) > 0,
      ),
    })),
    limits: [
      "Use these visual descriptions with your own model. Original images and private notes are not returned.",
      "Metadata-only matches are not evidence that an image was visually inspected. No inference API is called by this service.",
    ],
  };
}
