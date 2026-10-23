"""Retrieve bounded visual descriptions from Design Vault. No originals or paid model calls."""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import sys
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None

def validated(value, session, limit):
    if not isinstance(value,dict) or value.get("schemaVersion") != 1 or value.get("mode") != "descriptions" or value.get("session") != session:
        raise ValueError("Invalid inspiration response")
    references=value.get("references")
    if not isinstance(references,list) or len(references)>limit:
        raise ValueError("Invalid inspiration references")
    allowed={"id","category","tags","reviewed","description","style","palette","components","typography","uncertainty"}
    for item in references:
        if not isinstance(item,dict) or set(item)!=allowed or not re.fullmatch(r"[a-f0-9]{24}",str(item.get("id"))):
            raise ValueError("Unexpected reference fields; originals are not supported")
        if not isinstance(item["reviewed"],bool):
            raise ValueError("Invalid review status")
        for key in ("category","description","typography","uncertainty"):
            if not isinstance(item[key],str) or len(item[key])>2000:
                raise ValueError("Invalid reference description")
        for key in ("tags","style","palette","components"):
            if not isinstance(item[key],list) or len(item[key])>30 or any(not isinstance(text,str) or len(text)>80 for text in item[key]):
                raise ValueError("Invalid reference metadata")
    return value


def origin(value):
    url = urlparse(value)
    if (url.scheme != "https" or not url.hostname or url.username or url.password
            or url.path not in ("", "/") or url.query or url.fragment):
        raise ValueError("Configure the HTTPS origin of the inspiration service")
    return value.rstrip("/")


def search(service, query, session, components, limit=5):
    if not 1 <= limit <= 12 or len(query) > 2000 or len(session) > 80 or len(components) > 8:
        raise ValueError("Keep the query/session bounded and request one to twelve references")
    payload = {"query":query, "session":session, "components":components, "limit":limit}
    service = origin(service)
    root = Path(os.environ.get("LOCALAPPDATA", Path.home() / ".cache")) / "DesignVault" / "remote"
    identity = hashlib.sha256((service + json.dumps(payload, sort_keys=True)).encode()).hexdigest()
    cache = root / (identity + ".json")
    if cache.exists():
        if cache.stat().st_size>100000:
            raise ValueError("Cached response exceeds the expected size; use a new session")
        return validated(json.loads(cache.read_text(encoding="utf-8")),session,limit)
    request = Request(service + "/v1/search", json.dumps(payload).encode(), {"Content-Type":"application/json",
                      "User-Agent":"DesignVault/0.2 (+https://github.com/NachoEstevo/design-vault)"})
    try:
        with build_opener(NoRedirect()).open(request, timeout=40) as result:
            data = result.read(100001)
    except HTTPError as error:
        raise ValueError(f"Inspiration service returned HTTP {error.code}. Try again later or use a configured local vault.") from None
    if len(data) > 100000:
        raise ValueError("Service response exceeds the expected size")
    value = validated(json.loads(data),session,limit)
    root.mkdir(parents=True, exist_ok=True)
    if value.get("references"):
        cache.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--service")
    parser.add_argument("--query", required=True)
    parser.add_argument("--session", required=True)
    parser.add_argument("--components", nargs="*", default=[])
    parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args()
    try:
        skill = Path(__file__).resolve().parents[1]
        config_file = skill / "vault.json"
        config = json.loads((config_file if config_file.exists() else skill / "vault.example.json").read_text(encoding="utf-8-sig"))
        service = args.service or os.environ.get("DESIGN_VAULT_SERVICE") or config.get("service_url")
        if not service:
            raise ValueError("No hosted service is configured. Set service_url or --service.")
        print(json.dumps(search(service, args.query, args.session, args.components, args.limit), ensure_ascii=False, indent=2))
    except (ValueError, OSError) as error:
        print(json.dumps({"error":str(error)}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
