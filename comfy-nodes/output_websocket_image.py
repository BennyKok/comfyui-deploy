import folder_paths
from PIL import Image, ImageOps
import numpy as np
import torch
from server import PromptServer, BinaryEventTypes
import asyncio

from globals import send_image, max_output_id_length

class ComfyDeployWebscoketImageOutput:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "output_id": (
                    "STRING",
                    {"multiline": False, "default": "output_id"},
                ),
                "images": ("IMAGE", ),
                "file_type": (["WEBP", "PNG", "JPEG"], ),
                "quality": ("INT", {"default": 80, "min": 1, "max": 100, "step": 1}),
            },
            "optional": {
                    "client_id": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
            }
            # "hidden": {"client_id": "CLIENT_ID"},
        }

    OUTPUT_NODE = True

    RETURN_TYPES = ()
    RETURN_NAMES = ("text",)

    FUNCTION = "run"

    CATEGORY = "output"
    
    @classmethod
    def VALIDATE_INPUTS(s, output_id):
        try:
            if len(output_id.encode('ascii')) > max_output_id_length:
                raise ValueError(f"output_id size is greater than {max_output_id_length} bytes")
        except UnicodeEncodeError:
            raise ValueError("output_id is not ASCII encodable")

        return True

    def run(self, output_id, images, file_type, quality, client_id):
        prompt_server = PromptServer.instance
        loop = prompt_server.loop
        
        def schedule_coroutine_blocking(target, *args):
            future = asyncio.run_coroutine_threadsafe(target(*args), loop)
            return future.result()  # This makes the call blocking
        
        for tensor in images:
            array = 255.0 * tensor.cpu().numpy()
            image = Image.fromarray(np.clip(array, 0, 255).astype(np.uint8))

            schedule_coroutine_blocking(send_image, [file_type, image, None, quality], client_id, output_id)
            print("Image sent")

        return {"ui": {}}
        


NODE_CLASS_MAPPINGS = {"ComfyDeployWebscoketImageOutput": ComfyDeployWebscoketImageOutput}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyDeployWebscoketImageOutput": "Image Websocket Output (ComfyDeploy)"}