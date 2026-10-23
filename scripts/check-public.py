"""Check the tracked publication surface for accidental private files and obvious secrets."""
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
ROOT_FILES = {"README.md", "LICENSE", "CONTRIBUTING.md", ".gitignore", ".gitattributes",
              "package.json", "package-lock.json"}
DIRECTORIES = {"skills", "extension", "scripts", "tests", "docs", "templates", ".github", "bin"}
PRIVATE_NAMES = {"vault.json", "reference.json", "note.md", ".pending.json", "rclone.conf", ".npmrc"}
PRIVATE_PARTS = {"_design-vault", "node_modules", "output", "__pycache__", "private", "data", "vault"}
FORBIDDEN_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".zip", ".sqlite", ".db", ".pem", ".key"}
PATTERNS = [
    re.compile(r"(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})"),
    re.compile(r"AKIA[A-Z0-9]{16}"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"[A-Za-z]:[\\/](?:Users|GithubProjects)[\\/]", re.I),
]


def main():
    result = subprocess.run(["git", "ls-files", "-z", "--cached"], cwd=ROOT, capture_output=True, check=True)
    paths = [value.decode("utf-8") for value in result.stdout.split(b"\0") if value]
    if not paths:
        raise SystemExit("No tracked files to review; stage files first.")
    errors = []
    for relative in paths:
        path = PurePosixPath(relative)
        file = ROOT / relative
        if (path.parts[0] not in DIRECTORIES and relative not in ROOT_FILES
                or path.name in PRIVATE_NAMES or set(path.parts) & PRIVATE_PARTS
                or path.suffix.lower() in FORBIDDEN_EXTENSIONS or path.name.startswith(".env")):
            errors.append(f"File outside the allowed public surface: {relative}")
            continue
        if file.is_symlink() or file.stat().st_size > 500_000:
            errors.append(f"Unreviewed symlink or large file: {relative}")
            continue
        try:
            content = file.read_text(encoding="utf-8")
        except UnicodeError:
            errors.append(f"Binary file not allowed: {relative}")
            continue
        if any(pattern.search(content) for pattern in PATTERNS):
            errors.append(f"Possible secret or personal path: {relative}")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"{len(paths)} files checked; no libraries, personal configuration, binaries, or recognized secrets.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
