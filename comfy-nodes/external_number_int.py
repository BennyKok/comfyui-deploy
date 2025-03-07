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
                    {"multiline": True, "display": "number", "min": -2147483647, "max": 2147483647, "default": 0},
                ),
                "display_name": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
                "description": (
                    "STRING",
                    {"multiline": True, "default": ""},
                ),
            }
        }

    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("value",)
    FUNCTION = "run"
    CATEGORY = "🔗ComfyDeploy"

    def run(self, input_id, default_value=None, display_name=None, description=None):
        if not input_id or (isinstance(input_id, str) and not input_id.strip().isdigit()):
            return [default_value]
        return [int(input_id)]


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalNumberInt": ComfyUIDeployExternalNumberInt}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyUIDeployExternalNumberInt": "External Number Int (ComfyUI Deploy)"}