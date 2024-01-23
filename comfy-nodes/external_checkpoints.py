import folder_paths
from PIL import Image, ImageOps
import numpy as np
import torch
import folder_paths
from tqdm import tqdm

class ComfyUIDeployExternalCheckpoint:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_checkpoint"},
                ),
            },
            "optional": {
                "default_checkpoint_name": (folder_paths.get_filename_list("checkpoints"), ),
            }
        }

    RETURN_TYPES = (folder_paths.get_filename_list("checkpoints"),)
    RETURN_NAMES = ("path",)

    FUNCTION = "run"

    CATEGORY = "deploy"

    def run(self, input_id, default_checkpoint_name=None):
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
            print("Downloading external checkpoint - " +
                  input_id + " to " + destination_path)
            response = requests.get(
                input_id, headers={'User-Agent': 'Mozilla/5.0'}, allow_redirects=True, stream=True)
            file_size = int(response.headers.get('Content-Length', 0))
            chunk = 1
            chunk_size = 1024
            num_bars = int(file_size / chunk_size)

            with open(destination_path, 'wb') as out_file:
                for chunk in tqdm(
                    response.iter_content(chunk_size=chunk_size),
                    total=num_bars,
                    unit='KB',
                    desc="Downloading",
                    leave=True  # leave=True to keep progress bars
                ):
                    out_file.write(chunk)
            return (unique_filename,)
        else:
            return (default_checkpoints_name,)


NODE_CLASS_MAPPINGS = {
    "ComfyUIDeployExternalCheckpoint": ComfyUIDeployExternalCheckpoint}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIDeployExternalCheckpoint": "External Checkpoint (ComfyUI Deploy)"}
