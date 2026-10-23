"""Install Design Vault without replacing an existing skill or reading library images."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil


def install(vault_root=None, skills_root=None, service=None):
    vault = Path(vault_root).expanduser().resolve(strict=True) if vault_root else None
    if vault and not vault.is_dir():
        raise ValueError("Vault root must be a directory")
    from urllib.parse import urlsplit
    if service:
        parsed = urlsplit(service)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.path not in ("", "/") or parsed.query or parsed.fragment:
            raise ValueError("Service must be an HTTPS origin")
    codex = Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex").expanduser()
    target_root = Path(skills_root).expanduser() if skills_root else codex / "skills"
    destination = target_root.resolve() / "design-vault"
    if destination.exists() or destination.is_symlink():
        raise FileExistsError("The skill already exists and was preserved. Review changes before updating.")
    source = Path(__file__).resolve().parents[1] / "skills" / "design-vault"
    required = [source / name for name in ("SKILL.md", "agents", "references", "scripts", "vault.example.json")]
    for resource in required:
        if not resource.exists():
            raise FileNotFoundError(f"Missing installation resource: {resource.name}")
    # Never copy local config, caches, sessions or arbitrary files from the source skill.
    destination.mkdir(parents=True)
    shutil.copy2(source / "SKILL.md", destination / "SKILL.md")
    shutil.copy2(source / "vault.example.json", destination / "vault.example.json")
    for directory, pattern in (("agents", "*.yaml"), ("references", "*.md"), ("scripts", "*.py")):
        (destination / directory).mkdir()
        for resource in (source / directory).glob(pattern):
            if resource.is_file() and not resource.is_symlink():
                shutil.copy2(resource, destination / directory / resource.name)
    # The service stays configured even with a local library, so another machine without it still works.
    config = {"schemaVersion": 1,
              "service_url": service or json.loads((source / "vault.example.json").read_text(encoding="utf-8"))["service_url"]}
    if vault:
        config["vault_root"] = str(vault)
    (destination / "vault.json").write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return destination


def default_library():
    """The capture extension's default export folder, only when it already holds references."""
    folder = Path.home() / "Downloads" / "Design Shelf"
    try:
        return folder if folder.is_dir() and next(folder.glob("*/*/reference.json"), None) else None
    except OSError:
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vault-root", help="Your Design Shelf folder; lets your agent open the original images")
    parser.add_argument("--service", help="Use a self-hosted HTTPS service instead of the shared vault")
    parser.add_argument("--shared-only", action="store_true",
                        help="Do not use the Design Shelf folder found in Downloads; descriptions only")
    parser.add_argument("--skills-root", help="Agent skills directory; defaults to CODEX_HOME/skills")
    args = parser.parse_args()
    # The extension exports here by default; using it lets the agent open originals, not only descriptions.
    found = None if args.vault_root or args.shared_only else default_library()
    try:
        destination = install(args.vault_root or found, args.skills_root, args.service)
    except (OSError, ValueError) as error:
        parser.exit(1, f"{error}\n")
    print(f"Design Vault installed at: {destination}")
    if args.vault_root or found:
        print(f"Your agent opens originals from: {Path(args.vault_root or found).expanduser().resolve()}")
        if found:
            print("Found in Downloads. Reinstall with --shared-only to use descriptions only.")
    else:
        print("Using shared descriptions. Add --vault-root with your Design Shelf folder to let your agent open originals.")
    print("No images were read or uploaded. Start a new agent session if needed.")


if __name__ == "__main__":
    main()
