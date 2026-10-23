"""Behavioral checks for retrieval, persistence and bounded image access."""
import base64
from collections import Counter
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1] / "skills" / "design-vault" / "scripts"
sys.path.insert(0, str(SCRIPTS))
from catalog import Catalog
from vault import choose, contact_sheet, search, select, retrieve

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC0kAAAAASUVORK5CYII=")


class VaultTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.root = self.base / "vault"
        self.root.mkdir()
        self.catalog = Catalog(self.root, self.base / "cache")

    def tearDown(self):
        self.catalog.close()
        self.temp.cleanup()

    def reference(self, post=1001, category="cards", note="Warm agency cards with spacious layout", images=1):
        folder = self.root / category / f"2026-10-10_{post}"
        folder.mkdir(parents=True)
        names = [f"image-{i + 1:02}.png" for i in range(images)]
        for name in names:
            (folder / name).write_bytes(PNG)
        data = {"schemaVersion": 1, "postId": str(post), "url": f"https://x.com/designer/status/{post}",
                "capturedAt": "2026-10-10T12:00:00Z", "note": note, "text": "", "tags": ["layout"],
                "category": {"id": category, "label": category}, "relativePath": f"{category}/{folder.name}",
                "images": [{"fileName": name, "mimeType": "image/png", "size": len(PNG)} for name in names]}
        (folder / "reference.json").write_text(json.dumps(data), encoding="utf-8")
        return folder, data

    def rewrite(self, folder, data):
        (folder / "reference.json").write_text(json.dumps(data), encoding="utf-8")

    def test_index_and_search_never_open_originals_and_only_read_changed_metadata(self):
        folder, data = self.reference()
        with patch.object(Path, "read_bytes", side_effect=AssertionError("Opened original")):
            first = self.catalog.refresh()
            result = search(self.catalog, "calida agencia tarjetas", "first", seed=1)
            second = self.catalog.refresh()
        self.assertEqual(first["metadata_reads"], 1)
        self.assertEqual(second["metadata_reads"], 0)
        self.assertEqual(result["candidates"][0]["id"], "1001:0")
        data["note"] = "Cold dashboard with dense numbers"
        self.rewrite(folder, data)
        self.assertEqual(self.catalog.refresh()["metadata_reads"], 1)
        self.assertEqual(search(self.catalog, "calida", "changed")["candidates"], [])

    def test_categories_cross_and_multiple_images_have_independent_ids(self):
        self.reference(1001, "branding", "Warm agency with airy layouts", 4)
        self.reference(1002, "cards", "Warm agency cards", 2)
        self.catalog.refresh()
        result = search(self.catalog, "warm agency", "cross", seed=10, category="cards")
        self.assertEqual({image["category"] for image in result["candidates"]}, {"cards", "branding"})
        self.assertLessEqual(max(Counter(image["post_id"] for image in result["candidates"]).values()), 2)

    def test_complementary_reference_can_match_one_concrete_aspect(self):
        self.reference(1001, "cards", "Warm agency spacious cards")
        self.reference(1002, "branding", "Warm paper palette")
        self.reference(1003, "dashboards", "Cold dense tables")
        self.catalog.refresh()
        result = search(self.catalog, "warm agency spacious cards", "complement", seed=2)
        self.assertEqual({image["post_id"] for image in result["candidates"]}, {"1001", "1002"})

    def test_seed_variation_and_session_continuity_with_idempotent_usage(self):
        for post in range(1001, 1021):
            self.reference(post)
        self.catalog.refresh()
        first = search(self.catalog, "warm cards", "a", limit=5, seed=1)
        second = search(self.catalog, "warm cards", "b", limit=5, seed=2)
        same = search(self.catalog, "warm cards", "c", limit=5, seed=1)
        ids = [image["id"] for image in first["candidates"]]
        self.assertEqual(ids, [image["id"] for image in same["candidates"]])
        self.assertNotEqual(ids, [image["id"] for image in second["candidates"]])
        choose(self.catalog, "a", ids[:3])
        choose(self.catalog, "a", ids[:3])
        repeated = search(self.catalog, "warm cards", "a", limit=5)
        self.assertEqual([image["id"] for image in repeated["candidates"]], ids[:3])
        self.assertEqual(self.catalog.db.execute("SELECT SUM(count) FROM usage").fetchone()[0], 3)
        with self.assertRaises(ValueError):
            search(self.catalog, "different brief", "a")
        with self.assertRaises(ValueError):
            choose(self.catalog, "a", [ids[3]])

    def test_descriptions_search_independently_and_invalidate_on_image_change(self):
        folder, data = self.reference(images=2, note="Interesting palette")
        self.catalog.refresh()
        reference_bytes = (folder / "reference.json").read_bytes()
        self.catalog.describe("1001:0", {"summary": "Large red geometric shapes", "palette": ["red"]})
        result = search(self.catalog, "rojo", "red")
        self.assertEqual([image["id"] for image in result["candidates"]], ["1001:0"])
        self.assertEqual((folder / "reference.json").read_bytes(), reference_bytes)
        (folder / "image-01.png").write_bytes(PNG + b"changed")
        self.catalog.refresh()
        self.assertIsNone(self.catalog.image("1001:0")["analysis"])
        self.assertEqual(search(self.catalog, "red", "red-after")["candidates"], [])

    def test_changed_note_does_not_invalidate_visual_analysis(self):
        folder, data = self.reference()
        self.catalog.refresh()
        self.catalog.describe("1001:0", {"summary": "Soft green landscape with clear cards"})
        data["note"] = "Updated intention: spacing only"
        self.rewrite(folder, data)
        self.catalog.refresh()
        self.assertIsNotNone(self.catalog.image("1001:0")["analysis"])
        self.assertIn("spacing only", self.catalog.image("1001:0")["note"])

    def test_missing_and_deleted_references_leave_index(self):
        folder, _ = self.reference(images=2)
        self.catalog.refresh()
        (folder / "image-01.png").unlink()
        status = self.catalog.refresh()
        self.assertEqual(status["images"], 0)
        self.assertEqual(status["warning_count"], 1)
        (folder / "reference.json").unlink()
        self.assertEqual(self.catalog.refresh()["warning_count"], 0)

    def test_unsafe_names_paths_and_incomplete_metadata_are_excluded(self):
        folder, data = self.reference()
        data["images"][0]["fileName"] = "../../secret.png"
        self.rewrite(folder, data)
        self.assertEqual(self.catalog.refresh()["images"], 0)
        data["images"][0]["fileName"] = "image-01.png"
        data["relativePath"] = "other/2026-10-10_1001"
        self.rewrite(folder, data)
        self.assertEqual(self.catalog.refresh()["images"], 0)
        (folder / "reference.json").write_text("{invalid", encoding="utf-8")
        self.assertEqual(self.catalog.refresh()["images"], 0)

    def test_no_foreign_observation_overwrites(self):
        self.reference()
        self.catalog.refresh()
        path = self.catalog.observation_path("1001:0")
        path.parent.mkdir(parents=True)
        path.write_text('{"owner":"someone else"}', encoding="utf-8")
        before = path.read_bytes()
        with self.assertRaises(ValueError):
            self.catalog.describe("1001:0", {"summary": "A concrete visual description"})
        self.assertEqual(path.read_bytes(), before)

    def test_renamed_image_has_real_safe_path(self):
        folder, data = self.reference()
        (folder / "image-01.png").rename(folder / "rojo (1).png")
        data["images"][0]["fileName"] = "rojo (1).png"
        self.rewrite(folder, data)
        self.catalog.refresh()
        self.assertTrue(self.catalog.image("1001:0")["path"].endswith("rojo (1).png"))

    def test_limits_unknown_ids_and_zero_matches(self):
        self.reference()
        self.catalog.refresh()
        with self.assertRaises(ValueError):
            search(self.catalog, "warm", "limit", limit=13)
        search(self.catalog, "warm", "valid")
        with self.assertRaises(ValueError):
            choose(self.catalog, "valid", ["9999:0"])
        self.assertEqual(search(self.catalog, "unfindablezz", "none")["candidates"], [])

    def test_800_images_bounded_output_and_no_original_reads(self):
        for post in range(1001, 1201):
            self.reference(post, images=4)
        with patch.object(Path, "read_bytes", side_effect=AssertionError("Opened original")):
            stats = self.catalog.refresh()
            result = search(self.catalog, "warm spacious cards", "scale", seed=42)
            second = self.catalog.refresh()
        self.assertEqual(stats["images"], 800)
        self.assertEqual(stats["original_image_reads"], 0)
        self.assertLessEqual(len(result["candidates"]), 12)
        self.assertLess(len(json.dumps(result)), 18000)
        self.assertEqual(second["metadata_reads"], 0)
        self.assertLessEqual(max(Counter(row["post_id"] for row in result["candidates"]).values()), 2)
        self.reference(9001, images=4)
        self.catalog.refresh()
        new_pool = retrieve(self.catalog, "warm spacious cards")
        self.assertTrue(any(image["post_id"] == "9001" for image, _ in new_pool))
        self.assertLessEqual(len(new_pool), 120)

    def test_new_reference_enters_candidates_without_resetting_session(self):
        self.reference(note="minimal cards")
        self.catalog.refresh()
        old = search(self.catalog, "warm agency", "existing")
        self.assertEqual(old["candidates"], [])
        self.reference(1002, "branding", "Warm agency direction")
        self.catalog.refresh()
        result = search(self.catalog, "warm agency", "new")
        self.assertEqual(result["candidates"][0]["id"], "1002:0")
        self.assertEqual(search(self.catalog, "warm agency", "existing")["candidates"], [])

    def test_less_used_references_get_more_chances(self):
        for post in range(1001, 1011):
            self.reference(post)
        self.catalog.refresh()
        candidates = [(self.catalog.image(f"{post}:0"), 10) for post in range(1001, 1011)]
        self.catalog.db.execute("INSERT INTO usage VALUES ('1001:0', 100, ?)", (datetime.now(timezone.utc).isoformat(),))
        selections = Counter(select(self.catalog, candidates, 1, seed)[0][0]["id"] for seed in range(300))
        self.assertLess(selections["1001:0"], selections["1002:0"])

    def test_contact_sheet_opens_only_candidates_and_preserves_destination(self):
        try:
            from PIL import Image
        except ImportError:
            self.skipTest("Pillow not installed")
        for post in range(1001, 1006):
            self.reference(post)
        self.catalog.refresh()
        search(self.catalog, "warm cards", "sheet", limit=3, seed=2)
        output = self.base / "contact.png"
        with patch.object(Image, "open", wraps=Image.open) as opened:
            contact_sheet(self.catalog, "sheet", output)
        original_calls = [call for call in opened.call_args_list if Path(call.args[0]).resolve().is_relative_to(self.root.resolve())]
        self.assertEqual(len(original_calls), 3)
        before = output.read_bytes()
        with self.assertRaises(ValueError):
            contact_sheet(self.catalog, "sheet", output)
        self.assertEqual(output.read_bytes(), before)
        with self.assertRaises(ValueError):
            contact_sheet(self.catalog, "sheet", self.root / "danger.png")

    def test_cache_cannot_be_synced_or_reused_for_another_library(self):
        with self.assertRaises(ValueError):
            Catalog(self.root, self.root / "cache")
        second = self.base / "second-vault"
        second.mkdir()
        with self.assertRaises(ValueError):
            Catalog(second, self.base / "cache")


if __name__ == "__main__":
    unittest.main()
