import folder_paths
from PIL import Image, ImageOps
import numpy as np
import torch

class ComfyUIDeployExternalText:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_text"},
                ),
            },
            "optional": {
                "default_value": (
                    "STRING",
                    {"multiline": True, "default": ""},
                ),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)

    FUNCTION = "run"

    CATEGORY = "text"

    def run(self, input_id, default_value=None):
        return [default_value]


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalText": ComfyUIDeployExternalText}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyUIDeployExternalText": "External Text (ComfyUI Deploy)"}