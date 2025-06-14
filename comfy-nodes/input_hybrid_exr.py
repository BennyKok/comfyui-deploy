import os
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
import cv2 as cv
import numpy as np
import torch
from server import PromptServer
from globals import streaming_prompt_metadata, max_output_id_length
import base64
import requests
import io

def linearToSRGB(npArray):
    less = npArray <= 0.0031308
    npArray[less] = npArray[less] * 12.92
    npArray[~less] = np.power(npArray[~less], 1/2.4) * 1.055 - 0.055

class ComfyDeployHybridEXRInput:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_exr"},
                ),
                "tonemap": (["linear", "sRGB", "Reinhard"], {"default": "sRGB"}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            },
            "optional": {
                "default_image": ("IMAGE", ),
                "default_mask": ("MASK", ),
                "client_id": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
            }
        }

    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image","mask",)

    FUNCTION = "run"
    CATEGORY = "🔗ComfyDeploy"

    @classmethod
    def VALIDATE_INPUTS(s, input_id):
        # The length validation only applies to websocket-style short IDs,
        # not long URLs or file paths.
        if not input_id.startswith(('http://', 'https://', 'file://')):
            try:
                if len(input_id.encode('ascii')) > max_output_id_length:
                    raise ValueError(f"input_id size is greater than {max_output_id_length} bytes")
            except UnicodeEncodeError:
                raise ValueError("input_id is not ASCII encodable")

        return True

    def load_exr_from_data(self, exr_data):
        nparr = np.frombuffer(exr_data, np.uint8)
        image = cv.imdecode(nparr, cv.IMREAD_UNCHANGED).astype(np.float32)
        return image

    def run(self, input_id, tonemap, seed, default_image=None, default_mask=None, client_id=None):
        exr_b64_list = []
        
        # HTTP URL processing
        if input_id.startswith(('http://', 'https://')):
            try:
                print(f"Fetching EXR from URL: {input_id}")
                response = requests.get(input_id)
                response.raise_for_status()
                image = self.load_exr_from_data(response.content)
                exr_b64_list = [base64.b64encode(response.content).decode('utf-8')]
            except requests.exceptions.RequestException as e:
                print(f"Error fetching EXR from URL {input_id}: {e}")
                image = None
        else: # Websocket processing
            if client_id in streaming_prompt_metadata and input_id in streaming_prompt_metadata[client_id].inputs:
                exr_input = streaming_prompt_metadata[client_id].inputs[input_id]
                
                if isinstance(exr_input, list):
                    print("Received EXR sequence from websocket input")
                    exr_b64_list = exr_input
                elif isinstance(exr_input, str):
                    print("Received single EXR from websocket input")
                    exr_b64_list = [exr_input]
            else:
                exr_b64_list = []

        if exr_b64_list:
            rgb_batch = []
            mask_batch = []

            for exr_b64 in exr_b64_list:
                if not isinstance(exr_b64, str):
                    print(f"Skipping non-string item in input list for {input_id}")
                    continue
                
                try:
                    exr_bytes = base64.b64decode(exr_b64)
                    image = self.load_exr_from_data(exr_bytes)
                except Exception as e:
                    print(f"Error decoding Base64 for {input_id}: {e}")
                    continue

                if image is None:
                    print(f"Warning: Could not decode EXR image for {input_id}. Check file format.")
                    continue
                    
                if len(image.shape) == 2:
                    image = np.repeat(image[..., np.newaxis], 3, axis=2)
                
                rgb = np.flip(image[:,:,:3], 2).copy()
                
                if tonemap == "sRGB":
                    linearToSRGB(rgb)
                    rgb = np.clip(rgb, 0, 1)
                elif tonemap == "Reinhard":
                    rgb = np.clip(rgb, 0, None)
                    rgb = rgb / (rgb + 1)
                    linearToSRGB(rgb)
                    rgb = np.clip(rgb, 0, 1)
                
                rgb_tensor = torch.from_numpy(rgb).unsqueeze(0)
                rgb_batch.append(rgb_tensor)

                mask_tensor = torch.zeros((1, image.shape[0], image.shape[1]), dtype=torch.float32)
                if image.shape[2] > 3:
                    mask_tensor[0] = torch.from_numpy(np.clip(image[:,:,3], 0, 1))
                mask_batch.append(mask_tensor)

            if rgb_batch:
                print(f"Loaded {len(rgb_batch)} frames.")
                return (torch.cat(rgb_batch, 0), torch.cat(mask_batch, 0))

        print("Returning default EXR value")
        if default_image is not None:
            return (default_image, default_mask)
        
        print("Warning: No input EXR provided and no default image set. Returning a black image to prevent a crash.")
        blank_image = torch.zeros((1, 64, 64, 3), dtype=torch.float32)
        blank_mask = torch.zeros((1, 64, 64), dtype=torch.float32)
        return (blank_image, blank_mask)

NODE_CLASS_MAPPINGS = {"ComfyDeployHybridEXRInput": ComfyDeployHybridEXRInput}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyDeployHybridEXRInput": "EXR Hybrid Input (ComfyDeploy)"} 