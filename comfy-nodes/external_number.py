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
                    {"multiline": True, "display": "number", "default": 0, "min": -2147483647, "max": 2147483647, "step": 0.01},
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

    RETURN_TYPES = ("FLOAT",)
    RETURN_NAMES = ("value",)
    FUNCTION = "run"
    CATEGORY = "🔗ComfyDeploy"

    def run(self, input_id, default_value=None, display_name=None, description=None):
        try:
            float_value = float(input_id)
            print("my number", float_value)
            return [float_value]
        except ValueError:
            return [default_value]


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalNumber": ComfyUIDeployExternalNumber}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyUIDeployExternalNumber": "External Number (ComfyUI Deploy)"}