"""Read-only reference indexing and separate, versioned visual observations."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import unicodedata
from datetime import datetime
from urllib.parse import urlparse

ANALYSIS_VERSION = 1
MAX_IMAGE_BYTES = 20 * 1024 * 1024
EXTENSIONS = {"image/jpeg": {"jpg", "jpeg"}, "image/png": {"png"}, "image/webp": {"webp"}}


def folded(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text.lower())
                   if not unicodedata.combining(c))


def signature(path):
    stat = path.stat()
    return f"{stat.st_mtime_ns}:{stat.st_size}"


def read_json(path, maximum=256 * 1024):
    if path.stat().st_size > maximum:
        raise ValueError("JSON is too large")
    return json.loads(path.read_text(encoding="utf-8-sig"))


def contained(root, path):
    resolved = path.resolve()
    if not resolved.is_relative_to(root) or resolved == root:
        raise ValueError("Path is outside the vault")
    return resolved


def safe_name(name, mime):
    if not isinstance(name, str) or not 1 <= len(name) <= 200:
        return False
    if re.search(r'[\\/<>:"|?*\x00-\x1f]', name) or name[0] in ". " or name[-1] in ". ":
        return False
    if re.match(r"^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)", name, re.I):
        return False
    return name.rsplit(".", 1)[-1].lower() in EXTENSIONS.get(mime, set())


def text(value, maximum):
    if not isinstance(value, str) or len(value) > maximum:
        raise ValueError("Invalid text")
    return value.strip()


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive temporary sibling; never reuse a file owned by another process.
    import tempfile
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                     prefix=".vault-", suffix=".tmp", delete=False) as stream:
        temporary = Path(stream.name)
        json.dump(data, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


class Catalog:
    def __init__(self, root, cache=None):
        self.root = Path(root).expanduser().resolve()
        if not self.root.is_dir():
            raise ValueError(f"Configured library does not exist: {self.root}")
        identity = hashlib.sha256(str(self.root).encode()).hexdigest()[:16]
        default = Path(os.environ.get("LOCALAPPDATA", Path.home() / ".cache")) / "DesignVault" / identity
        self.cache = Path(cache).expanduser().resolve() if cache else default
        if self.cache.is_relative_to(self.root):
            raise ValueError("SQLite cache must stay outside the synchronized vault")
        self.cache.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.cache / "catalog.sqlite3")
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE IF NOT EXISTS sources (path TEXT PRIMARY KEY, stamp TEXT, data TEXT);
            CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, data TEXT);
            CREATE TABLE IF NOT EXISTS usage (id TEXT PRIMARY KEY, count INTEGER, last_used TEXT);
            CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, data TEXT);
            CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(id UNINDEXED, note, tags, visual, context);
        """)
        old = self.db.execute("SELECT value FROM config WHERE key='root'").fetchone()
        if old and old[0] != str(self.root):
            self.db.close()
            raise ValueError("This cache belongs to another library; choose another cache directory")
        self.db.execute("INSERT OR IGNORE INTO config VALUES ('root', ?)", (str(self.root),))
        self.db.commit()
        self.stats = {}

    def close(self):
        self.db.close()

    def cached_json(self, path, stats):
        stamp = signature(path)
        key = str(path)
        cached = self.db.execute("SELECT stamp, data FROM sources WHERE path=?", (key,)).fetchone()
        if cached and cached[0] == stamp:
            return json.loads(cached[1])
        value = read_json(path)
        stats["metadata_reads"] += 1
        self.db.execute("INSERT OR REPLACE INTO sources VALUES (?, ?, ?)",
                        (key, stamp, json.dumps(value, ensure_ascii=False)))
        return value

    def observation_path(self, image_id):
        if not re.fullmatch(r"[1-9][0-9]{0,24}:[0-3]", image_id):
            raise ValueError("Invalid image ID")
        return contained(self.root, self.root / "_design-vault" / "descriptions" /
                         (image_id.replace(":", "-") + ".json"))

    def reference_images(self, path, value):
        if not isinstance(value, dict) or value.get("schemaVersion") != 1:
            raise ValueError("Invalid reference schema")
        post_id = str(value.get("postId", ""))
        if not re.fullmatch(r"[1-9][0-9]{0,24}", post_id):
            raise ValueError("Invalid post ID")
        category = value.get("category", {})
        if not isinstance(category, dict) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", str(category.get("id", ""))):
            raise ValueError("Invalid category")
        date = datetime.fromisoformat(text(value.get("capturedAt"), 64).replace("Z", "+00:00"))
        relative = f"{category['id']}/{date.date().isoformat()}_{post_id}"
        if value.get("relativePath") != relative or path.parent.relative_to(self.root).as_posix() != relative:
            raise ValueError("Ruta de referencia inconsistente")
        url = text(value.get("url"), 512)
        parsed = urlparse(url)
        if (parsed.scheme != "https" or parsed.netloc not in {"x.com", "twitter.com"} or
                not re.fullmatch(r"/[A-Za-z0-9_]+/status/" + post_id, parsed.path)):
            raise ValueError("Invalid post link")
        note = text(value.get("note"), 10000)
        if not note:
            raise ValueError("Referencia sin nota")
        tags = value.get("tags", [])
        if not isinstance(tags, list) or len(tags) > 30:
            raise ValueError("Invalid tags")
        tags = [text(tag, 80) for tag in tags]
        images = value.get("images")
        if not isinstance(images, list) or not 1 <= len(images) <= 4:
            raise ValueError("Invalid image list")
        result, names = [], set()
        for index, image in enumerate(images):
            if not isinstance(image, dict) or not safe_name(image.get("fileName"), image.get("mimeType")):
                raise ValueError("Invalid image name or type")
            name = image["fileName"]
            if name.casefold() in names:
                raise ValueError("Duplicate image filename")
            names.add(name.casefold())
            file = contained(self.root, path.parent / name)
            if not file.is_file() or not 0 < file.stat().st_size <= MAX_IMAGE_BYTES:
                raise ValueError("Image is missing, empty, or too large")
            result.append({"id": f"{post_id}:{index}", "post_id": post_id,
                           "path": str(file), "signature": signature(file), "category": category["id"],
                           "note": note, "tags": tags, "url": url, "captured_at": value["capturedAt"],
                           "post_text": text(value.get("text", ""), 20000), "analysis": None})
        return result

    def refresh(self):
        stats = {"references": 0, "images": 0, "analysed": 0, "metadata_reads": 0,
                 "original_image_reads": 0, "warnings": [], "warning_count": 0}
        seen, sources, posts = set(), set(), set()
        paths = sorted(self.root.glob("*/*/reference.json"))
        for path in paths:
            if path.parts[-3].startswith("_"):
                continue
            try:
                path = contained(self.root, path)
                value = self.cached_json(path, stats)
                sources.add(str(path))
                images = self.reference_images(path, value)
                post_id = images[0]["post_id"]
                if post_id in posts:
                    raise ValueError("Duplicate post ID in the library")
                posts.add(post_id)
                for image in images:
                    observation = self.observation_path(image["id"])
                    if observation.exists():
                        try:
                            payload = self.cached_json(observation, stats)
                            sources.add(str(observation))
                            if (isinstance(payload, dict) and payload.get("schemaVersion") == ANALYSIS_VERSION and payload.get("image_id") == image["id"] and
                                    payload.get("signature") == image["signature"]):
                                if not re.fullmatch(r"[a-f0-9]{64}", str(payload.get("sha256", ""))):
                                    raise ValueError("Invalid observation hash")
                                image["analysis"] = validate_observation(payload["observation"])
                                image["hash"] = payload["sha256"]
                        except (ValueError, KeyError, TypeError, OSError) as error:
                            self.warn(stats, f"{image['id']}: observation ignored ({error})")
                    serialized = json.dumps(image, ensure_ascii=False, sort_keys=True)
                    previous = self.db.execute("SELECT data FROM images WHERE id=?", (image["id"],)).fetchone()
                    if not previous or previous[0] != serialized:
                        self.db.execute("INSERT OR REPLACE INTO images VALUES (?, ?)", (image["id"], serialized))
                        self.db.execute("DELETE FROM search WHERE id=?", (image["id"],))
                        self.db.execute("INSERT INTO search VALUES (?, ?, ?, ?, ?)",
                                        (image["id"], folded(image["note"]), folded(" ".join(image["tags"])),
                                         folded(json.dumps(image["analysis"] or {}, ensure_ascii=False)),
                                         folded(image["category"] + " " + image["post_text"])))
                    seen.add(image["id"])
                    stats["analysed"] += bool(image["analysis"])
                stats["references"] += 1
            except (ValueError, TypeError, KeyError, OSError, AttributeError) as error:
                self.warn(stats, f"{path.relative_to(self.root) if path.is_relative_to(self.root) else path.name}: {error}")
        for row in self.db.execute("SELECT id FROM images").fetchall():
            if row[0] not in seen:
                self.db.execute("DELETE FROM images WHERE id=?", (row[0],))
                self.db.execute("DELETE FROM search WHERE id=?", (row[0],))
        for row in self.db.execute("SELECT path FROM sources").fetchall():
            if row[0] not in sources:
                self.db.execute("DELETE FROM sources WHERE path=?", (row[0],))
        stats["images"] = len(seen)
        self.db.commit()
        self.stats = stats
        return stats

    @staticmethod
    def warn(stats, message):
        stats["warning_count"] += 1
        if len(stats["warnings"]) < 5:
            stats["warnings"].append(message[:300])

    def image(self, image_id):
        row = self.db.execute("SELECT data FROM images WHERE id=?", (image_id,)).fetchone()
        if not row:
            raise ValueError(f"Image unavailable: {image_id}")
        image = json.loads(row[0])
        path = contained(self.root, Path(image["path"]))
        if signature(path) != image["signature"]:
            raise ValueError("The image changed during this operation; search again")
        return image

    def describe(self, image_id, observation):
        observation = validate_observation(observation)
        image = self.image(image_id)
        file = Path(image["path"])
        sha256 = hashlib.sha256(file.read_bytes()).hexdigest()
        if signature(file) != image["signature"]:
            raise ValueError("The image changed during analysis")
        path = self.observation_path(image_id)
        if path.exists():
            previous = read_json(path)
            if not isinstance(previous, dict) or previous.get("image_id") != image_id or previous.get("schemaVersion") != ANALYSIS_VERSION:
                raise ValueError("An unowned observation file was preserved")
        atomic_json(path, {"schemaVersion": ANALYSIS_VERSION, "image_id": image_id,
                           "signature": image["signature"], "sha256": sha256,
                           "observation": observation})
        self.refresh()
        return {"image_id": image_id, "analysis_path": str(path), "sha256": sha256}


def validate_observation(value):
    if not isinstance(value, dict):
        raise ValueError("Invalid observation")
    result = {"summary": text(value.get("summary"), 1200)}
    if len(result["summary"]) < 10:
        raise ValueError("Describe what you observed using at least ten characters")
    for field in ("style", "palette", "components"):
        values = value.get(field, [])
        if not isinstance(values, list) or len(values) > 20:
            raise ValueError(f"{field} is invalid")
        result[field] = [text(item, 100) for item in values]
    for field in ("typography", "uncertainty"):
        result[field] = text(value.get(field, ""), 600)
    # Reconstruction detail: geometry, the device worth taking, how to rebuild it, sampled colors.
    for field, limit in (("layout", 600), ("signature", 400), ("recipe", 1200)):
        if field in value:
            result[field] = text(value.get(field, ""), limit)
    if "colors" in value:
        colors = value["colors"]
        if not isinstance(colors, list) or len(colors) > 8 or not all(
                isinstance(item, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", item) for item in colors):
            raise ValueError("colors must be up to eight #rrggbb values")
        result["colors"] = [item.lower() for item in colors]
    return result
