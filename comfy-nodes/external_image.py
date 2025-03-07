import folder_paths
from PIL import Image, ImageOps
import numpy as np
import torch

class ComfyUIDeployExternalImage:
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
                "display_name": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
                "description": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
                "default_value_url": ("STRING", {"image_preview": True, "default": ""}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "run"
    CATEGORY = "🔗ComfyDeploy"

    def run(self, input_id, default_value=None, display_name=None, description=None, default_value_url=None):
        image = default_value
        
        # Try both input_id and default_value_url
        urls_to_try = [url for url in [input_id, default_value_url] if url]
        
        print(default_value_url)
        
        for url in urls_to_try:
            try:
                if url.startswith('http'):
                    import requests
                    from io import BytesIO
                    print(f"Fetching image from url: {url}")
                    response = requests.get(url)
                    image = Image.open(BytesIO(response.content))
                    break
                elif url.startswith(('data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/jpg;base64,')):
                    import base64
                    from io import BytesIO
                    print("Decoding base64 image")
                    base64_image = url[url.find(",")+1:]
                    decoded_image = base64.b64decode(base64_image)
                    image = Image.open(BytesIO(decoded_image))
                    break
            except:
                continue
        
        if image is not None:
            try:
                image = ImageOps.exif_transpose(image)
                image = image.convert("RGB")
                image = np.array(image).astype(np.float32) / 255.0
                image = torch.from_numpy(image)[None,]
            except:
                pass
                
        return [image]


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalImage": ComfyUIDeployExternalImage}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyUIDeployExternalImage": "External Image (ComfyUI Deploy)"}