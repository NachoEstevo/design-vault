"""Bounded retrieval, reproducible sessions and visual selection for Design Vault."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import random
import re
import secrets
import sys

from catalog import Catalog, folded, read_json

STOP = set("a an and the de del el la las los y para por una un con que en lo muy algo quiero hacer crea crear create design disena disen a mi me my for with to of is it us use using".split())
GROUPS = [
    "cards card tarjetas tarjeta", "landing landings hero portada", "dashboard dashboards panel tableros tablero",
    "warm warmth calido calida calidez acogedor cozy", "airy air spacious whitespace spacing espaciado espacio aire amplitud",
    "agency agencies agencia agencias studio estudio", "minimal minimalist minimalista simple simplicity sencillo",
    "green verde", "red rojo roja", "blue azul", "purple violeta morado purpura", "white blanco blanca",
    "black negro negra", "transparent transparency transparencia transparente glass cristal vidrio",
    "gradient gradients gradiente gradientes", "texture textures textura texturas paper papel",
    "professional profesional profesionales", "premium luxury lujo high-end", "typography tipografia font fonts fuente fuentes",
    "color colors colourful colorful colores colour palette paleta", "layout layouts composicion composition grilla grid",
    "branding brand marca identidad", "illustration illustrations ilustracion ilustraciones", "natural nature naturaleza landscape paisaje fields campo",
]
ALIASES = {term: set(group.split()) for group in GROUPS for term in group.split()}
GENERIC = {"premium", "modern", "moderno", "design", "color", "colors", "colores", "professional", "profesional"}


def tokens(value):
    return set(re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)?", folded(value)))


def query_groups(query):
    unique = []
    for word in sorted(tokens(query) - STOP):
        group = ALIASES.get(word, {word})
        if group not in unique:
            unique.append(group)
    return unique[:20]


def session_key(value):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,79}", value):
        raise ValueError("Invalid session ID: use letters, numbers, hyphens, or dots")
    return value


def load_session(catalog, key):
    row = catalog.db.execute("SELECT data FROM sessions WHERE id=?", (session_key(key),)).fetchone()
    return json.loads(row[0]) if row else None


def save_session(catalog, key, data):
    catalog.db.execute("INSERT OR REPLACE INTO sessions VALUES (?, ?)",
                       (session_key(key), json.dumps(data)))
    catalog.db.commit()


def brief(image, score=None):
    analysis = image.get("analysis")
    result = {"id": image["id"], "post_id": image["post_id"], "category": image["category"],
              "path": image["path"], "source": image["url"], "note": image["note"][:300],
              "tags": image["tags"][:12], "analysed": bool(analysis)}
    if analysis:
        result["visual_summary"] = analysis["summary"][:500]
        for field in ("layout", "signature", "recipe", "colors", "typography"):
            if analysis.get(field):
                result[field] = analysis[field]
    if score is not None:
        result["relevance"] = round(score, 3)
    return result


def retrieve(catalog, query, category=None):
    groups = query_groups(query)
    if not groups:
        raise ValueError("Use concrete terms to search for references")
    expression = " OR ".join('"' + word + '"' for word in sorted(set.union(*groups)))
    # FTS narrows candidates without returning the whole vault to the model.
    rows = catalog.db.execute("SELECT id FROM search WHERE search MATCH ? ORDER BY bm25(search, 0, 6, 3, 5, 1) LIMIT 72",
                              (expression,)).fetchall()
    # Tied FTS scores must not hide new or unused references behind old rows at scale.
    rows += catalog.db.execute("""SELECT search.id FROM search JOIN images i ON i.id=search.id
        WHERE search MATCH ? ORDER BY json_extract(i.data, '$.captured_at') DESC, i.id DESC LIMIT 24""",
                               (expression,)).fetchall()
    rows += catalog.db.execute("""SELECT search.id FROM search JOIN images i ON i.id=search.id
        LEFT JOIN usage u ON u.id=search.id WHERE search MATCH ?
        ORDER BY COALESCE(u.count, 0), i.id DESC LIMIT 24""", (expression,)).fetchall()
    candidates = []
    for image_id in dict.fromkeys(row[0] for row in rows):
        image = catalog.image(image_id)
        fields = [(tokens(image["note"]), 6), (tokens(" ".join(image["tags"])), 3),
                  (tokens(json.dumps(image["analysis"] or {}, ensure_ascii=False)), 5),
                  (tokens(image["category"]), 2), (tokens(image["post_text"]), .5)]
        score = sum(max((weight for words, weight in fields if words & group), default=0) *
                    (.35 if group & GENERIC else 1) for group in groups)
        if category and image["category"] == category:
            score += 1
        if score > 0:
            candidates.append((image, score))
    return sorted(candidates, key=lambda item: (-item[1], item[0]["id"]))


def select(catalog, candidates, limit, seed):
    rng = random.Random(seed)
    if not candidates:
        return []
    top = candidates[0][1]
    # A complementary reference may match one concrete aspect, not the full brief.
    remaining = [(image, score) for image, score in candidates if score >= top * .25]
    chosen, per_post, known_hashes = [], Counter(), set()
    now = datetime.now(timezone.utc)
    usage = {}
    for row in catalog.db.execute("SELECT id, count, last_used FROM usage"):
        used_at = datetime.fromisoformat(row[2].replace("Z", "+00:00"))
        if used_at.tzinfo is None:
            used_at = used_at.replace(tzinfo=timezone.utc)
        age = max(0, (now - used_at).days)
        usage[row[0]] = row[1] * max(0, 1 - age / 30)
    while remaining and len(chosen) < limit:
        weighted = []
        for image, score in remaining:
            if per_post[image["post_id"]] >= 2 or (image.get("hash") and image["hash"] in known_hashes):
                continue
            captured = datetime.fromisoformat(image["captured_at"].replace("Z", "+00:00"))
            if captured.tzinfo is None:
                captured = captured.replace(tzinfo=timezone.utc)
            age = max(0, (now - captured).days)
            freshness = .15 if age <= 14 else 0
            weight = (.2 + (score / top) ** 3 + freshness) / (1 + usage.get(image["id"], 0) * .3)
            weight *= .2 if per_post[image["post_id"]] else 1
            style = tokens(json.dumps(image.get("analysis") or {}, ensure_ascii=False))
            if style and chosen:
                similarities = []
                for previous, _ in chosen:
                    prior = tokens(json.dumps(previous.get("analysis") or {}, ensure_ascii=False))
                    similarities.append(len(style & prior) / max(1, len(style | prior)))
                weight *= 1 - .4 * max(similarities)
            weighted.append((rng.random() ** (1 / max(.001, weight)), image, score))
        if not weighted:
            break
        _, image, score = max(weighted, key=lambda value: value[0])
        chosen.append((image, score))
        per_post[image["post_id"]] += 1
        if image.get("hash"):
            known_hashes.add(image["hash"])
        remaining = [(other, value) for other, value in remaining if other["id"] != image["id"]]
    return chosen


def search(catalog, query, key, limit=12, seed=None, category=None):
    if not 1 <= limit <= 12:
        raise ValueError("Candidate limit must be between 1 and 12")
    session_key(key)
    query_hash = hashlib.sha256(json.dumps([folded(query), category, limit]).encode()).hexdigest()
    previous = load_session(catalog, key)
    if previous:
        if previous["query_hash"] != query_hash:
            raise ValueError("This session has a different brief; use a new ID for the alternative")
        ids = previous.get("chosen") or previous["candidates"]
        return {"session": key, "seed": previous["seed"], "reused": True,
                "candidates": [brief(catalog.image(image_id)) for image_id in ids], "stats": catalog.stats}
    candidates = retrieve(catalog, query, category)
    seed = secrets.randbits(32) if seed is None else seed
    selection = select(catalog, candidates, limit, seed)
    state = {"query_hash": query_hash, "seed": seed, "candidates": [image["id"] for image, _ in selection],
             "chosen": [], "created_at": datetime.now(timezone.utc).isoformat()}
    save_session(catalog, key, state)
    return {"session": key, "seed": seed, "reused": False, "matched": len(candidates),
            "candidates": [brief(image, score) for image, score in selection], "stats": catalog.stats}


def choose(catalog, key, ids):
    state = load_session(catalog, key)
    if not state:
        raise ValueError("Search candidates before choosing references")
    if not 1 <= len(ids) <= 5 or len(set(ids)) != len(ids):
        raise ValueError("Choose one to five images with unique IDs")
    if any(image_id not in state["candidates"] for image_id in ids):
        raise ValueError("Selection must use candidates from this session")
    if state["chosen"] and state["chosen"] != ids:
        raise ValueError("This session already has a direction; create another for an alternative")
    images = [catalog.image(image_id) for image_id in ids]
    if not state["chosen"]:
        for image_id in ids:
            catalog.db.execute("INSERT INTO usage VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET count=count+1, last_used=excluded.last_used",
                               (image_id, datetime.now(timezone.utc).isoformat()))
        state["chosen"] = ids
        save_session(catalog, key, state)
    return {"session": key, "seed": state["seed"],
            "selected": [{**brief(image), "role": "primary" if index == 0 else "complementary"}
                         for index, image in enumerate(images)]}


def contact_sheet(catalog, key, output):
    try:
        from PIL import Image, ImageDraw, ImageFont, ImageOps
    except ImportError as error:
        raise ValueError("Contact sheets require Pillow. You can open a few selected originals directly.") from error
    state = load_session(catalog, key)
    if not state or not state["candidates"]:
        raise ValueError("This session has no candidate images")
    ids = state["chosen"] or state["candidates"]
    output = Path(output).expanduser().resolve()
    if output.is_relative_to(catalog.root):
        raise ValueError("Save the contact sheet outside the original vault")
    if output.exists():
        raise ValueError("Destination already exists; use a new name")
    cell_width, cell_height, columns = 400, 300, min(3, len(ids))
    sheet = Image.new("RGB", (columns * cell_width, math.ceil(len(ids) / columns) * cell_height), "#f2f0eb")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=15)
    for position, image_id in enumerate(ids):
        image = catalog.image(image_id)
        file = Path(image["path"])
        thumbnail = catalog.cache / "thumbnails" / (hashlib.sha256((str(file) + image["signature"]).encode()).hexdigest() + ".png")
        if not thumbnail.exists():
            with Image.open(file) as original:
                original.thumbnail((cell_width - 20, cell_height - 60))
                preview = ImageOps.exif_transpose(original).convert("RGB")
                thumbnail.parent.mkdir(parents=True, exist_ok=True)
                preview.save(thumbnail)
        with Image.open(thumbnail) as preview:
            x, y = position % columns * cell_width, position // columns * cell_height
            sheet.paste(preview, (x + (cell_width - preview.width) // 2, y + 10))
            draw.text((x + 10, y + cell_height - 42), image_id, fill="#111111", font=font)
            draw.text((x + 10, y + cell_height - 22), image["category"], fill="#555555", font=font)
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, format="PNG")
    return {"sheet": str(output), "images": len(ids), "session": key}


def sample_colors(catalog, image_id, count=6):
    """Measure dominant colors from the original's pixels so observations cite real values."""
    try:
        from PIL import Image, ImageOps
    except ImportError as error:
        raise ValueError("Color sampling requires Pillow.") from error
    image = catalog.image(image_id)
    with Image.open(Path(image["path"])) as original:
        preview = ImageOps.exif_transpose(original).convert("RGB")
        preview.thumbnail((200, 200))
        quantized = preview.quantize(colors=count, method=Image.Quantize.MEDIANCUT)
        palette = quantized.getpalette()[:count * 3]
        counts = sorted(quantized.getcolors(), reverse=True)
    total = sum(n for n, _ in counts)
    colors = [{"hex": "#%02x%02x%02x" % tuple(palette[index * 3:index * 3 + 3]),
               "share": round(n / total, 3)} for n, index in counts]
    return {"image_id": image_id, "colors": colors}


def parser():
    command = argparse.ArgumentParser(description=__doc__)
    command.add_argument("--root", help="Vault root; overrides local configuration for this command")
    command.add_argument("--cache", help="Isolated cache outside the vault")
    commands = command.add_subparsers(dest="command", required=True)
    commands.add_parser("status")
    finder = commands.add_parser("search")
    finder.add_argument("--query", required=True)
    finder.add_argument("--session", required=True)
    finder.add_argument("--limit", type=int, default=12)
    finder.add_argument("--seed", type=int)
    finder.add_argument("--category")
    selection = commands.add_parser("choose")
    selection.add_argument("--session", required=True)
    selection.add_argument("--ids", nargs="+", required=True)
    sheet = commands.add_parser("sheet")
    sheet.add_argument("--session", required=True)
    sheet.add_argument("--out", required=True)
    describe = commands.add_parser("describe")
    describe.add_argument("--image", required=True)
    describe.add_argument("--input", required=True)
    colors = commands.add_parser("colors")
    colors.add_argument("--image", required=True)
    colors.add_argument("--count", type=int, default=6)
    state = commands.add_parser("session")
    state.add_argument("--session", required=True)
    return command


def main():
    args = parser().parse_args()
    catalog = None
    try:
        root = args.root or os.environ.get("DESIGN_VAULT_ROOT")
        if not root:
            skill = Path(__file__).resolve().parents[1]
            config_path = skill / "vault.json"
            config = read_json(config_path if config_path.exists() else skill / "vault.example.json")
            if config.get("schemaVersion") != 1:
                raise ValueError("Invalid skill configuration")
            root = config["vault_root"]
        catalog = Catalog(root, args.cache)
        stats = catalog.refresh()
        if args.command == "status":
            categories = Counter(json.loads(row[0])["category"] for row in catalog.db.execute("SELECT data FROM images"))
            result = {"root": str(catalog.root), "cache": str(catalog.cache), **stats, "categories": dict(categories)}
        elif args.command == "search":
            result = search(catalog, args.query, args.session, args.limit, args.seed, args.category)
        elif args.command == "choose":
            result = choose(catalog, args.session, args.ids)
        elif args.command == "sheet":
            result = contact_sheet(catalog, args.session, args.out)
        elif args.command == "colors":
            result = sample_colors(catalog, args.image, max(2, min(args.count, 8)))
        elif args.command == "describe":
            result = catalog.describe(args.image, read_json(Path(args.input), 16 * 1024))
        else:
            state = load_session(catalog, args.session)
            if not state:
                raise ValueError("Session not found")
            result = {"session": args.session, **state,
                      "images": [brief(catalog.image(image_id)) for image_id in state["chosen"] or state["candidates"]]}
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1
    finally:
        if catalog:
            catalog.close()
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
