"""Upload a local Design Shelf library to its owner's private R2 service. Never calls an AI API."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "skills" / "design-vault" / "scripts"))
from catalog import Catalog

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def endpoint(value):
    parsed = urlparse(value)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
            or parsed.query or parsed.fragment or parsed.path not in ("", "/")):
        raise ValueError("Use the HTTPS origin of your own service, without credentials or a path")
    return value.rstrip("/")


def call(service, token, path, data=None, mime="application/json"):
    request = Request(service + path, data=data,
                      headers={"Authorization": "Bearer " + token, "Content-Type": mime,
                               "User-Agent":"DesignVault/0.2 (+https://github.com/NachoEstevo/design-vault)"},
                      method="GET" if data is None else ("PUT" if "/objects/" in path else "POST"))
    try:
        with build_opener(NoRedirect()).open(request, timeout=90) as result:
            return json.load(result)
    except HTTPError as error:
        # Server errors are generic and never contain the credential; avoid printing request headers.
        raise ValueError(f"Upload failed (HTTP {error.code}): {error.read(2048).decode('utf-8', errors='replace')}") from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True)
    parser.add_argument("--service", required=True)
    parser.add_argument("--credentials", help="Private JSON file containing upload_token; never place it in the repo")
    parser.add_argument("--limit", type=int, default=10000)
    parser.add_argument("--post-id", help="Synchronize one known local post, including reviewed descriptions")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    service = endpoint(args.service)
    token = os.environ.get("DESIGN_VAULT_UPLOAD_TOKEN", "")
    if args.credentials:
        token = json.loads(Path(args.credentials).read_text(encoding="utf-8-sig"))["upload_token"]
    if not args.dry_run and len(token) < 32:
        raise ValueError("Set DESIGN_VAULT_UPLOAD_TOKEN or supply an owner credentials file")
    catalog = Catalog(args.root)
    try:
        stats = catalog.refresh()
        groups = {}
        for row in catalog.db.execute("SELECT data FROM images ORDER BY id"):
            image = json.loads(row[0])
            groups.setdefault(image["post_id"], []).append(image)
        selected = list(groups.values())[:args.limit]
        if args.post_id:
            selected = [group for group in selected if group[0]["post_id"] == args.post_id]
            if not selected:
                raise ValueError("Post ID was not found in the validated local library")
        print(json.dumps({"references": len(selected), "images":sum(map(len, selected)),
                          "reviewed":sum(bool(i.get("analysis")) for group in selected for i in group),
                          "warnings":stats["warning_count"], "dry_run":args.dry_run}))
        if args.dry_run:
            return
        # Resume interrupted imports without retransmitting immutable original bytes.
        inventory = call(service, token, "/admin/inventory")
        uploaded = {digest for ref in inventory["references"] for digest in ref["images"]}
        for number, images in enumerate(selected, 1):
            first = images[0]
            reference = {"postId":first["post_id"], "capturedAt":first["captured_at"],
                         "category":{"id":first["category"], "label":first["category"]},
                         "note":first["note"], "tags":first["tags"], "images":[]}
            for image in images:
                # Catalog validates containment and freshness before a file may be read.
                current = catalog.image(image["id"])
                data = Path(current["path"]).read_bytes()
                sha = hashlib.sha256(data).hexdigest()
                suffix = Path(current["path"]).suffix.lower()
                mime = {".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".png":"image/png", ".webp":"image/webp"}[suffix]
                if sha not in uploaded:
                    call(service, token, "/admin/objects/" + sha, data, mime)
                    uploaded.add(sha)
                reference["images"].append({"sha256":sha, "mimeType":mime, "size":len(data),
                                            "observation":current.get("analysis")})
            call(service, token, "/admin/references", json.dumps(reference).encode("utf-8"))
            print(f"Committed {number}/{len(selected)} references", flush=True)
        print(json.dumps(call(service, token, "/admin/status")))
    finally:
        catalog.close()


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
