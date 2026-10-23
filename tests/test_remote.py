import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location("remote",Path(__file__).resolve().parents[1]/"skills/design-vault/scripts/remote.py")
remote=importlib.util.module_from_spec(spec)
spec.loader.exec_module(remote)

class RemoteTests(unittest.TestCase):
    def response(self):
        return {"schemaVersion":1,"mode":"descriptions","session":"project", "references":[{
            "id":"a"*24,"category":"cards","tags":["warm"],"reviewed":True,"description":"Warm cards",
            "style":[],"palette":[],"components":["cards"],"typography":"Unknown family","uncertainty":"Static image"}]}

    def test_exact_session_cache_preserves_selection_without_another_request(self):
        with tempfile.TemporaryDirectory() as directory,patch.dict(os.environ,{"LOCALAPPDATA":directory}):
            with patch.object(remote,"build_opener") as factory:
                factory.return_value.open.return_value=io.BytesIO(json.dumps(self.response()).encode())
                a=remote.search("https://vault.test","warm cards","project",["cards"])
                b=remote.search("https://vault.test","warm cards","project",["cards"])
                self.assertEqual(a,b)
                self.assertEqual(factory.return_value.open.call_count,1)
                request=factory.return_value.open.call_args.args[0]
                self.assertFalse(request.has_header("Authorization"))

    def test_rejects_original_fields_wrong_sessions_and_oversized_response(self):
        value=self.response();value["references"][0]["original_url"]="https://private.test/image"
        with self.assertRaises(ValueError):remote.validated(value,"project",5)
        with self.assertRaises(ValueError):remote.validated(self.response(),"other-project",5)
        with tempfile.TemporaryDirectory() as directory,patch.dict(os.environ,{"LOCALAPPDATA":directory}),patch.object(remote,"build_opener") as factory:
            factory.return_value.open.return_value=io.BytesIO(b" "*100001)
            with self.assertRaises(ValueError):remote.search("https://vault.test","cards","project",[])

    def test_accepts_reconstruction_fields_and_roles_but_checks_colors(self):
        value=self.response();value["references"][0].update(role="direction",layout="Panel inset 10%",
            signature="Staggered photo strip",recipe="One flex row",colors=["#0a3fae","#f2f3ef"])
        self.assertEqual(remote.validated(value,"project",5)["references"][0]["role"],"direction")
        value["references"][0]["colors"]=["blue"]
        with self.assertRaises(ValueError):remote.validated(value,"project",5)

    def test_refuses_unsafe_origins_before_sending_a_brief(self):
        for origin in ("http://vault.test","https://secret@vault.test","https://vault.test/private","https://vault.test/?key=value"):
            with self.assertRaises(ValueError):remote.origin(origin)

if __name__=="__main__":unittest.main()
