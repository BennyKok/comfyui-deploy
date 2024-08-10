import folder_paths
from PIL import Image, ImageOps
import numpy as np
import torch
import json

class ComfyUIDeployExternalTextList:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": 'input_text_list'},
                ),
                 "text": (
                    "STRING",
                    {"multiline": True, "default": "[]"},
                ),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)

    OUTPUT_IS_LIST = (True,)

    FUNCTION = "run"

    CATEGORY = "text"

    def run(self, input_id, text=None):
        text_list = []
        try:
            text_list = json.loads(text)  # Assuming text is a JSON array string
        except Exception as e:
            print(f"Error processing images: {e}")
            pass
        return ([text_list],)

NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalTextList": ComfyUIDeployExternalTextList}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyUIDeployExternalTextList": "External Text List (ComfyUI Deploy)"}
