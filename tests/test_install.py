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

    def test_local_library_keeps_the_shared_service_as_fallback(self):
        config = json.loads((installer.install(self.vault, self.skills) / "vault.json").read_text(encoding="utf-8"))
        self.assertEqual(config["service_url"], "https://design-vault.nachoestevo.workers.dev")

    def test_cli_uses_the_extension_default_library_unless_shared_only(self):
        shelf = self.base / "home" / "Downloads" / "Design Shelf" / "landings" / "2026-10-10_1"
        shelf.mkdir(parents=True)
        (shelf / "reference.json").write_text("{}", encoding="utf-8")
        environment = {**os.environ, "USERPROFILE": str(self.base / "home"), "HOME": str(self.base / "home")}
        for flags, expected in (([], True), (["--shared-only"], False)):
            skills = self.base / f"skills-{expected}"
            result = subprocess.run([sys.executable, str(REPO / "scripts" / "install.py"), "--skills-root", str(skills), *flags],
                                    capture_output=True, text=True, env=environment)
            self.assertEqual(result.returncode, 0, result.stderr)
            config = json.loads((skills / "design-vault" / "vault.json").read_text(encoding="utf-8"))
            self.assertEqual("vault_root" in config, expected)
            self.assertIn("service_url", config)

    def test_invalid_library_does_not_create_destination(self):
        with self.assertRaises(FileNotFoundError):
            installer.install(self.vault / "missing", self.skills)
        self.assertFalse(self.skills.exists())

    def test_hosted_default_needs_no_local_library_or_credential(self):
        target = installer.install(skills_root=self.skills)
        config = json.loads((target / "vault.json").read_text(encoding="utf-8"))
        self.assertEqual(config["service_url"], "https://design-vault.nachoestevo.workers.dev")
        self.assertNotIn("vault_root", config)
        self.assertNotIn("token", json.dumps(config))
        self.assertTrue((target / "scripts" / "remote.py").is_file())

    def test_rejects_unsafe_self_hosted_service_before_installing(self):
        with self.assertRaises(ValueError):
            installer.install(skills_root=self.skills, service="http://unsafe.test")
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
