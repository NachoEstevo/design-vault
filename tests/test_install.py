"""Installation and public CLI regressions, using isolated synthetic folders."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("vault_install", REPO / "scripts" / "install.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.base = Path(self.temporary.name)
        self.vault = self.base / "test library"
        self.vault.mkdir()
        self.skills = self.base / "skills"

    def tearDown(self):
        self.temporary.cleanup()

    def test_installs_only_resources_and_preserves_existing_configuration(self):
        target = installer.install(self.vault, self.skills)
        config = target / "vault.json"
        self.assertEqual(json.loads(config.read_text(encoding="utf-8"))["vault_root"], str(self.vault.resolve()))
        config.write_text("private custom config", encoding="utf-8")
        with self.assertRaises(FileExistsError):
            installer.install(self.vault, self.skills)
        self.assertEqual(config.read_text(encoding="utf-8"), "private custom config")
        self.assertEqual({item.name for item in target.iterdir()},
                         {"SKILL.md", "agents", "references", "scripts", "vault.example.json", "vault.json"})

    def test_invalid_library_does_not_create_destination(self):
        with self.assertRaises(FileNotFoundError):
            installer.install(self.vault / "missing", self.skills)
        self.assertFalse(self.skills.exists())

    def test_respects_codex_home_and_installed_cli_works(self):
        with patch.dict(os.environ, {"CODEX_HOME": str(self.base / "codex")}, clear=False):
            target = installer.install(self.vault)
        result = subprocess.run([sys.executable, str(target / "scripts" / "vault.py"),
                                 "--cache", str(self.base / "cache"), "status"],
                                capture_output=True, text=True, encoding="utf-8", env={
                                    **os.environ, "DESIGN_VAULT_ROOT": ""})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["images"], 0)

    def test_explicit_root_and_environment_work_without_local_config(self):
        cli = str(REPO / "skills" / "design-vault" / "scripts" / "vault.py")
        environment = {**os.environ, "DESIGN_VAULT_ROOT": str(self.base / "missing")}
        explicit = subprocess.run([sys.executable, cli, "--root", str(self.vault),
                                   "--cache", str(self.base / "explicit-cache"), "status"],
                                  capture_output=True, text=True, env=environment)
        self.assertEqual(explicit.returncode, 0, explicit.stderr)
        environment["DESIGN_VAULT_ROOT"] = str(self.vault)
        implicit = subprocess.run([sys.executable, cli, "--cache", str(self.base / "env-cache"), "status"],
                                  capture_output=True, text=True, env=environment)
        self.assertEqual(implicit.returncode, 0, implicit.stderr)

    def test_example_config_fallback_after_manual_copy(self):
        target = installer.install(self.vault, self.skills)
        (target / "vault.json").unlink()
        (target / "vault.example.json").write_text(
            json.dumps({"schemaVersion": 1, "vault_root": str(self.vault)}), encoding="utf-8")
        result = subprocess.run([sys.executable, str(target / "scripts" / "vault.py"),
                                 "--cache", str(self.base / "fallback-cache"), "status"],
                                capture_output=True, text=True,
                                env={**os.environ, "DESIGN_VAULT_ROOT": ""})
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
