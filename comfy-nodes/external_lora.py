import folder_paths
from PIL import Image, ImageOps
import numpy as np
import torch
import folder_paths


class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False


WILDCARD = AnyType("*")


class ComfyUIDeployExternalLora:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_lora"},
                ),
            },
            "optional": {
                "default_lora_name": (folder_paths.get_filename_list("loras"),),
                "lora_save_name": (  # if `default_lora_name` is a link to download a file, we will attempt to save it with this name
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
                "display_name": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
                "description": (
                    "STRING",
                    {"multiline": True, "default": ""},
                ),
                "lora_url": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
            },
        }

    RETURN_TYPES = (WILDCARD,)
    RETURN_NAMES = ("path",)

    FUNCTION = "run"

    CATEGORY = "deploy"

    def run(
        self,
        input_id,
        default_lora_name=None,
        lora_save_name=None,
        display_name=None,
        description=None,
        lora_url=None,
    ):
        import requests
        import os
        import uuid

        if lora_url and lora_url.startswith("http"):
            if lora_save_name:
                existing_loras = folder_paths.get_filename_list("loras")
                # Check if lora_save_name exists in the list
                if lora_save_name in existing_loras:
                    print(f"using lora: {lora_save_name}")
                    return (lora_save_name,)
            else:
                lora_save_name = str(uuid.uuid4()) + ".safetensors"
            print(lora_save_name)
            print(folder_paths.folder_names_and_paths["loras"][0][0])
            destination_path = os.path.join(
                folder_paths.folder_names_and_paths["loras"][0][0], lora_save_name
            )
            print(destination_path)
            print("Downloading external lora - " + lora_url + " to " + destination_path)
            response = requests.get(
                lora_url,
                headers={"User-Agent": "Mozilla/5.0"},
                allow_redirects=True,
            )
            with open(destination_path, "wb") as out_file:
                out_file.write(response.content)
            return (lora_save_name,)
        else:
            print(f"using lora: {default_lora_name}")
            return (default_lora_name,)


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalLora": ComfyUIDeployExternalLora}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIDeployExternalLora": "External Lora (ComfyUI Deploy)"
}
