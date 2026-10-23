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
    config = {"schemaVersion": 1}
    if vault:
        config["vault_root"] = str(vault)
    else:
        config["service_url"] = service or json.loads((source / "vault.example.json").read_text(encoding="utf-8"))["service_url"]
    (destination / "vault.json").write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    destination_group = parser.add_mutually_exclusive_group()
    destination_group.add_argument("--vault-root", help="Use your own local Design Shelf library")
    destination_group.add_argument("--service", help="Use a self-hosted HTTPS service instead of the shared vault")
    parser.add_argument("--skills-root", help="Agent skills directory; defaults to CODEX_HOME/skills")
    args = parser.parse_args()
    try:
        destination = install(args.vault_root, args.skills_root, args.service)
    except (OSError, ValueError) as error:
        parser.exit(1, f"{error}\n")
    print(f"Design Vault installed at: {destination}")
    print("No images were read or uploaded. Start a new agent session if needed.")


if __name__ == "__main__":
    main()
