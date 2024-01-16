import folder_paths
from PIL import Image, ImageOps
import numpy as np
import torch

class ComfyUIDeployExternalNumberInt:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_number"},
                ),
            },
            "optional": {
                "default_value": (
                    "INT",
                    {"multiline": True, "display": "number", "default": 0},
                ),
            }
        }

    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("value",)

    FUNCTION = "run"

    CATEGORY = "number"

    def run(self, input_id, default_value=None):
        if not input_id or not input_id.strip().isdigit():
            return [default_value]
        return [int(input_id)]


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalNumberInt": ComfyUIDeployExternalNumberInt}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyUIDeployExternalNumberInt": "External Number Int (ComfyUI Deploy)"}