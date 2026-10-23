"""Install Design Vault without replacing an existing skill or reading library images."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil


def install(vault_root, skills_root=None):
    vault = Path(vault_root).expanduser().resolve(strict=True)
    if not vault.is_dir():
        raise ValueError("La raíz del vault debe ser una carpeta")
    codex = Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex").expanduser()
    target_root = Path(skills_root).expanduser() if skills_root else codex / "skills"
    destination = target_root.resolve() / "design-vault"
    if destination.exists() or destination.is_symlink():
        raise FileExistsError("La skill ya existe; se preservó la instalación. Revisá los cambios antes de actualizar.")
    source = Path(__file__).resolve().parents[1] / "skills" / "design-vault"
    required = [source / name for name in ("SKILL.md", "agents", "references", "scripts", "vault.example.json")]
    for resource in required:
        if not resource.exists():
            raise FileNotFoundError(f"Falta un recurso de instalación: {resource.name}")
    # Never copy local config, caches, sessions or arbitrary files from the source skill.
    destination.mkdir(parents=True)
    shutil.copy2(source / "SKILL.md", destination / "SKILL.md")
    shutil.copy2(source / "vault.example.json", destination / "vault.example.json")
    for directory, pattern in (("agents", "*.yaml"), ("references", "*.md"), ("scripts", "*.py")):
        (destination / directory).mkdir()
        for resource in (source / directory).glob(pattern):
            if resource.is_file() and not resource.is_symlink():
                shutil.copy2(resource, destination / directory / resource.name)
    (destination / "vault.json").write_text(
        json.dumps({"schemaVersion": 1, "vault_root": str(vault)}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vault-root", required=True, help="Carpeta local exportada por Design Shelf")
    parser.add_argument("--skills-root", help="Carpeta de skills del agente; por defecto CODEX_HOME/skills")
    args = parser.parse_args()
    try:
        destination = install(args.vault_root, args.skills_root)
    except (OSError, ValueError) as error:
        parser.exit(1, f"{error}\n")
    print(f"Design Vault instalada en: {destination}")
    print("No se leyeron ni subieron imágenes. Reiniciá la sesión del agente si es necesario.")


if __name__ == "__main__":
    main()
