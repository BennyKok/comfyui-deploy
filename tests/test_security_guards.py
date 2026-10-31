"""Security guards in custom_routes.py and the External Lora / Face Model nodes.

Runs without ComfyUI: guard functions are pulled out of custom_routes.py by
name, and ComfyUI modules are stubbed.  python tests/test_security_guards.py
"""

import ast
import os
import sys
import tempfile
import types
from pathlib import Path
from unittest import mock
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent


def load_guards(folder_paths, prompt_metadata):
    tree = ast.parse((ROOT / "custom_routes.py").read_text())
    wanted = {"is_inside_model_dirs", "is_s3_presigned_url", "prompt_id_taken"}
    funcs = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in wanted]
    assert {f.name for f in funcs} == wanted
    ns = {"os": os, "urlparse": urlparse, "folder_paths": folder_paths, "prompt_metadata": prompt_metadata}
    exec(compile(ast.Module(body=funcs, type_ignores=[]), "custom_routes.py", "exec"), ns)
    return ns


def test_route_guards(tmp):
    models = os.path.join(tmp, "models")
    extra = os.path.join(tmp, "volume", "loras")  # extra_model_paths outside models/
    fp = types.SimpleNamespace(
        models_dir=models,
        folder_names_and_paths={"loras": ([os.path.join(models, "loras"), extra], {".safetensors"})},
    )
    g = load_guards(fp, {"p1": types.SimpleNamespace(token="tok-a")})

    inside = g["is_inside_model_dirs"]
    assert inside(f"{models}/loras/a.safetensors")
    assert inside(f"{extra}/b.safetensors")
    assert not inside("/etc/passwd")
    assert not inside(f"{models}/../secret.txt")
    assert not inside("/x/models/../../etc/passwd")  # passed the old "/models/" substring check
    assert not inside(f"{extra}-evil/c.safetensors")  # prefix, not a subfolder

    s3 = g["is_s3_presigned_url"]
    assert s3("https://bucket.s3.us-east-1.amazonaws.com/key?partNumber=1&X-Amz-Signature=x")
    assert not s3("http://bucket.s3.amazonaws.com/key")
    assert not s3("https://evil.com/?x=.amazonaws.com")
    assert not s3("https://amazonaws.com.evil.com/key")

    taken = g["prompt_id_taken"]
    assert not taken("new", "tok-b")
    assert not taken(None, "tok-b")
    assert not taken("p1", "tok-a")  # same caller retrying
    assert taken("p1", "tok-b")  # someone else hijacking
    assert taken("p1", None)


def run_node(module_file, cls, folder_key, save_kw, url_kw, save_name, tmp):
    target = os.path.join(tmp, folder_key.replace("/", "_"))
    os.makedirs(target, exist_ok=True)
    stubs = {
        "folder_paths": types.SimpleNamespace(
            folder_names_and_paths={folder_key: ([target], set())},
            get_filename_list=lambda _: [],
        ),
        "requests": types.SimpleNamespace(get=lambda *a, **k: types.SimpleNamespace(content=b"weights")),
        "torch": types.ModuleType("torch"),
        "numpy": types.ModuleType("numpy"),
        "PIL": types.SimpleNamespace(Image=None, ImageOps=None),
    }
    with mock.patch.dict(sys.modules, stubs):
        ns = {"__name__": "node"}
        exec(compile((ROOT / "comfy-nodes" / module_file).read_text(), module_file, "exec"), ns)
        node = ns[cls]()
        return node.run(input_id="x", **{save_kw: save_name, url_kw: "https://example.com/m"}), target


def test_external_nodes(tmp):
    for file, cls, key, save_kw, url_kw in [
        ("external_lora.py", "ComfyUIDeployExternalLora", "loras", "lora_save_name", "lora_url"),
        ("external_face_model.py", "ComfyUIDeployExternalFaceModel", "reactor/faces", "face_model_save_name", "face_model_url"),
    ]:
        result, target = run_node(file, cls, key, save_kw, url_kw, "ok.safetensors", tmp)
        assert result == ("ok.safetensors",) and os.path.exists(os.path.join(target, "ok.safetensors"))
        for bad in ["../escape.py", "../../custom_nodes/x/__init__.py", os.path.join(tmp, "abs.py")]:
            try:
                run_node(file, cls, key, save_kw, url_kw, bad, tmp)
                raise AssertionError(f"{file} accepted {bad!r}")
            except ValueError:
                pass
        assert not os.path.exists(os.path.join(tmp, "escape.py"))
        assert not os.path.exists(os.path.join(tmp, "abs.py"))


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as d:
        test_route_guards(d)
        test_external_nodes(d)
    print("ok")
