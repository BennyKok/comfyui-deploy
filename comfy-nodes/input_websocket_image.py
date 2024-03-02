import folder_paths
from PIL import Image, ImageOps
import numpy as np
import torch
from server import PromptServer, BinaryEventTypes
import asyncio

from globals import streaming_prompt_metadata, max_output_id_length

class ComfyDeployWebscoketImageInput:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_id"},
                ),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            },
            "optional": {
                "default_value": ("IMAGE", ),
                "client_id": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
            }
        }

    OUTPUT_NODE = True

    RETURN_TYPES = ("IMAGE", )
    RETURN_NAMES = ("images",)

    FUNCTION = "run"

    @classmethod
    def VALIDATE_INPUTS(s, input_id):
        try:
            if len(input_id.encode('ascii')) > max_output_id_length:
                raise ValueError(f"input_id size is greater than {max_output_id_length} bytes")
        except UnicodeEncodeError:
            raise ValueError("input_id is not ASCII encodable")

        return True

    def run(self, input_id, seed, default_value=None ,client_id=None):
        # print(streaming_prompt_metadata[client_id].inputs)
        if client_id in streaming_prompt_metadata and input_id in streaming_prompt_metadata[client_id].inputs:
            if isinstance(streaming_prompt_metadata[client_id].inputs[input_id], Image.Image):
                print("Returning image from websocket input")
                
                image = streaming_prompt_metadata[client_id].inputs[input_id]
                
                image = ImageOps.exif_transpose(image)
                image = image.convert("RGB")
                image = np.array(image).astype(np.float32) / 255.0
                image = torch.from_numpy(image)[None,]
                
                return [image]

        print("Returning default value")
        return [default_value]

NODE_CLASS_MAPPINGS = {"ComfyDeployWebscoketImageInput": ComfyDeployWebscoketImageInput}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyDeployWebscoketImageInput": "Image Websocket Input (ComfyDeploy)"}