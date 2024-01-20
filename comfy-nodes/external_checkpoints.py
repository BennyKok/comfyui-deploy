import folder_paths
from PIL import Image, ImageOps
import numpy as np
import torch
import folder_paths


class ComfyUIDeployExternalCheckpoints:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_checkpoints"},
                ),
            },
            "optional": {
                "default_checkpoints_name": (folder_paths.get_filename_list("checkpoints"), ),
            }
        }

    RETURN_TYPES = (folder_paths.get_filename_list("checkpoints"),)
    RETURN_NAMES = ("path",)

    FUNCTION = "run"

    CATEGORY = "deploy"

    def run(self, input_id, default_checkpoints_name=None):
        import requests
        import os
        import uuid

        if input_id and input_id.startswith('http'):
            unique_filename = str(uuid.uuid4()) + ".safetensors"
            print(unique_filename)
            print(folder_paths.folder_names_and_paths["checkpoints"][0][0])
            destination_path = os.path.join(
                folder_paths.folder_names_and_paths["checkpoints"][0][0], unique_filename)
            print(destination_path)
            print("Downloading external checkpoints - " +
                  input_id + " to " + destination_path)
            response = requests.get(
                input_id, headers={'User-Agent': 'Mozilla/5.0'}, allow_redirects=True)
            with open(destination_path, 'wb') as out_file:
                out_file.write(response.content)
            return (unique_filename,)
        else:
            return (default_checkpoints_name,)


NODE_CLASS_MAPPINGS = {
    "ComfyUIDeployExternalCheckpoints": ComfyUIDeployExternalCheckpoints}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIDeployExternalCheckpoints": "External Checkpoints (ComfyUI Deploy)"}
