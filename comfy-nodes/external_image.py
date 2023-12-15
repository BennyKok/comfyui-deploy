import folder_paths
from PIL import Image, ImageOps
import numpy as np
import torch

class ComfyUIDeployExternalImage:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "name": (
                    "STRING",
                    {"multiline": False, "default": "input_image"},
                ),
            },
            "optional": {
                "default_image": ("IMAGE",),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)

    FUNCTION = "run"

    CATEGORY = "image"

    def run(self, name, default_image=None):
        image = default_image
        try:
            if name.startswith('http'):
                import requests
                from io import BytesIO
                print("Fetching image from url: ", name)
                response = requests.get(name)
                image = Image.open(BytesIO(response.content))
            else:
                raise ValueError("Invalid image url provided.")
            # image_path = folder_paths.get_annotated_filepath(name)
            # image = Image.open(image_path)
            image = ImageOps.exif_transpose(image)
            # image = image.convert("RGB")
            image = np.array(image).astype(np.float32) / 255.0
            image = torch.from_numpy(image)[None,]
            return [image]
        except:
            return [image]


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalImage": ComfyUIDeployExternalImage}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyUIDeployExternalImage": "External Image (ComfyUI Deploy)"}