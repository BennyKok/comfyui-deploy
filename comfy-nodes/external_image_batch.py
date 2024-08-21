import folder_paths
from PIL import Image, ImageOps
import numpy as np
import torch
import json
import comfy

class ComfyUIDeployExternalImageBatch:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_images"},
                ),
                "images": (
                    "STRING",
                    {"multiline": False, "default": "[]"},
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
                    {"multiline": True, "default": ""},
                ),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)

    FUNCTION = "run"

    CATEGORY = "image"
    
    def run(self, input_id, images=None, default_value=None, display_name=None, description=None):
        processed_images = []
        try:
            images_list = json.loads(images)  # Assuming images is a JSON array string
            print(images_list)
            for img_input in images_list:
                if img_input.startswith('http'):
                    import requests
                    from io import BytesIO
                    print("Fetching image from url: ", img_input)
                    response = requests.get(img_input)
                    image = Image.open(BytesIO(response.content))
                elif img_input.startswith('data:image/png;base64,') or img_input.startswith('data:image/jpeg;base64,') or img_input.startswith('data:image/jpg;base64,'):
                    import base64
                    from io import BytesIO
                    print("Decoding base64 image")
                    base64_image = img_input[img_input.find(",")+1:]
                    decoded_image = base64.b64decode(base64_image)
                    image = Image.open(BytesIO(decoded_image))
                else:
                    raise ValueError("Invalid image url or base64 data provided.")

                image = ImageOps.exif_transpose(image)
                image = image.convert("RGB")
                image = np.array(image).astype(np.float32) / 255.0
                image_tensor = torch.from_numpy(image)[None,]
                processed_images.append(image_tensor)
        except Exception as e:
            print(f"Error processing images: {e}")
            pass
            
        if default_value is not None and len(images_list) == 0:
            processed_images.append(default_value)  # Assuming default_value is a pre-processed image tensor

        # Resize images if necessary and concatenate from MakeImageBatch in ImpactPack
        if processed_images:
            base_shape = processed_images[0].shape[1:]  # Get the shape of the first image for comparison
            batch_tensor = processed_images[0]
            for i in range(1, len(processed_images)):
                if processed_images[i].shape[1:] != base_shape:
                    # Resize to match the first image's dimensions
                    processed_images[i] = comfy.utils.common_upscale(processed_images[i].movedim(-1, 1), base_shape[1], base_shape[0], "lanczos", "center").movedim(1, -1)

                batch_tensor = torch.cat((batch_tensor, processed_images[i]), dim=0)
            # Concatenate using torch.cat
        else:
            batch_tensor = None  # or handle the empty case as needed
        return (batch_tensor, )


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalImageBatch": ComfyUIDeployExternalImageBatch}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyUIDeployExternalImageBatch": "External Image Batch (ComfyUI Deploy)"}