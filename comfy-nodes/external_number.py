import folder_paths
from PIL import Image, ImageOps
import numpy as np
import torch

class ComfyUIDeployExternalNumber:
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
                    "FLOAT",
                    {"multiline": True, "display": "number", "default": 0},
                ),
            }
        }

    RETURN_TYPES = ("FLOAT",)
    RETURN_NAMES = ("value",)

    FUNCTION = "run"

    CATEGORY = "number"

    def run(self, input_id, default_value=None):
        if not input_id or len(input_id.strip()) == 0:
            return [default_value]
        return [input_id]


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalNumber": ComfyUIDeployExternalNumber}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyUIDeployExternalNumber": "External Number (ComfyUI Deploy)"}