import folder_paths
from PIL import Image, ImageOps
import numpy as np
import torch

class ComfyUIDeployExternalImageAlpha:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_image"},
                ),
            },
            "optional": {
                "default_value": ("IMAGE",),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)

    FUNCTION = "run"

    CATEGORY = "image"

    def run(self, input_id, default_value=None):
        image = default_value
        try:
            if input_id.startswith('http'):
                import requests
                from io import BytesIO
                print("Fetching image from url: ", input_id)
                response = requests.get(input_id)
                image = Image.open(BytesIO(response.content))
            elif input_id.startswith('data:image/png;base64,') or input_id.startswith('data:image/jpeg;base64,') or input_id.startswith('data:image/jpg;base64,'):
                import base64
                from io import BytesIO
                print("Decoding base64 image")
                base64_image = input_id[input_id.find(",")+1:]
                decoded_image = base64.b64decode(base64_image)
                image = Image.open(BytesIO(decoded_image))
            else:
                raise ValueError("Invalid image url provided.")

            image = ImageOps.exif_transpose(image)
            image = np.array(image).astype(np.float32) / 255.0
            image = torch.from_numpy(image)[None,]
            return [image]
        except:
            return [image]


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalImageAlpha": ComfyUIDeployExternalImageAlpha}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyUIDeployExternalImageAlpha": "External Image Alpha (ComfyUI Deploy)"}