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
import json

def linearToSRGB(npArray):
    less = npArray <= 0.0031308
    npArray[less] = npArray[less] * 12.92
    npArray[~less] = np.power(npArray[~less], 1/2.4) * 1.055 - 0.055

class ComfyDeployHttpInputEXR:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "get_signed_url": (
                    "STRING",
                    {"multiline": True, "default": ""},
                ),
                "tonemap": (["linear", "sRGB", "Reinhard"], {"default": "sRGB"}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            },
            "optional": {
                "default_image": ("IMAGE", ),
                "default_mask": ("MASK", ),
            },
        }

    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image", "mask",)

    FUNCTION = "run"
    CATEGORY = "🔗ComfyDeploy"

    def load_exr_from_data(self, exr_data):
        nparr = np.frombuffer(exr_data, np.uint8)
        image = cv.imdecode(nparr, cv.IMREAD_UNCHANGED).astype(np.float32)
        return image

    def run(self, get_signed_url, tonemap, seed, default_image=None, default_mask=None):
        if not get_signed_url:
            print("No URL provided. Returning default EXR value.")
            if default_image is not None:
                return (default_image, default_mask)
            
            print("Warning: No input URL provided and no default image set. Returning a black image to prevent a crash.")
            blank_image = torch.zeros((1, 64, 64, 3), dtype=torch.float32)
            blank_mask = torch.zeros((1, 64, 64), dtype=torch.float32)
            return (blank_image, blank_mask)

        try:
            print(f"Fetching EXR from URL: {get_signed_url}")
            response = requests.get(get_signed_url)
            response.raise_for_status()
            image = self.load_exr_from_data(response.content)
        except requests.exceptions.RequestException as e:
            print(f"Error fetching EXR from URL {get_signed_url}: {e}")
            image = None

        if image is None:
            print(f"Warning: Could not decode EXR image. Returning default image.")
            if default_image is not None:
                return (default_image, default_mask)
            blank_image = torch.zeros((1, 64, 64, 3), dtype=torch.float32)
            blank_mask = torch.zeros((1, 64, 64), dtype=torch.float32)
            return (blank_image, blank_mask)

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
            
        mask = np.zeros_like(rgb[:,:,0])
        if image.shape[2] > 3:
            mask = np.clip(image[:,:,3], 0, 1)

        return (torch.from_numpy(rgb).unsqueeze(0), torch.from_numpy(mask).unsqueeze(0),)

NODE_CLASS_MAPPINGS = {"ComfyDeployHttpInputEXR": ComfyDeployHttpInputEXR}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyDeployHttpInputEXR": "HTTP EXR Input (ComfyDeploy)"} 