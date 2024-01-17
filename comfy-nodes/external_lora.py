import folder_paths
from PIL import Image, ImageOps
import numpy as np
import torch
import folder_paths


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
                "default_lora_name": (folder_paths.get_filename_list("loras"), ),
            }
        }

    RETURN_TYPES = (folder_paths.get_filename_list("loras"),)
    RETURN_NAMES = ("path",)

    FUNCTION = "run"

    CATEGORY = "deploy"

    def run(self, input_id, default_lora_name=None):
        import requests
        import os
        import uuid

        if input_id and input_id.startswith('http'):
            unique_filename = str(uuid.uuid4()) + ".safetensors"
            print(unique_filename)
            print(folder_paths.folder_names_and_paths["loras"][0][0])
            destination_path = os.path.join(folder_paths.folder_names_and_paths["loras"][0][0], unique_filename)
            print(destination_path)
            print("Downloading external lora - " + input_id + " to " + destination_path)
            response = requests.get(input_id, headers={'User-Agent': 'Mozilla/5.0'}, allow_redirects=True)
            with open(destination_path, 'wb') as out_file:
                out_file.write(response.content)
            return (unique_filename,)
        else:
            return (default_lora_name,)
        

NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalLora": ComfyUIDeployExternalLora}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyUIDeployExternalLora": "External Lora (ComfyUI Deploy)"}