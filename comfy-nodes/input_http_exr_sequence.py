import os
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
import cv2 as cv
import numpy as np
import torch
import requests
import io
import json
from globals import max_output_id_length

def linearToSRGB(npArray):
    less = npArray <= 0.0031308
    npArray[less] = npArray[less] * 12.92
    npArray[~less] = np.power(npArray[~less], 1/2.4) * 1.055 - 0.055

class ComfyDeployHttpInputEXRSequence:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "urls_json": (
                    "STRING",
                    {"multiline": True, "default": "[]"},
                ),
                "tonemap": (["linear", "sRGB", "Reinhard"], {"default": "sRGB"}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            },
            "optional": {
                "default_image": ("IMAGE", ),
                "default_mask": ("MASK", ),
            }
        }

    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image", "mask",)
    FUNCTION = "run"
    CATEGORY = "🔗ComfyDeploy"

    def load_exr_from_data(self, exr_data):
        nparr = np.frombuffer(exr_data, np.uint8)
        image = cv.imdecode(nparr, cv.IMREAD_UNCHANGED).astype(np.float32)
        return image

    def run(self, urls_json, tonemap, seed, default_image=None, default_mask=None):
        try:
            urls = json.loads(urls_json)
            if not isinstance(urls, list):
                raise ValueError("urls_json must be a JSON array of strings.")
        except Exception as e:
            print(f"Error parsing urls_json: {e}")
            urls = []

        if not urls:
            print("No URLs provided. Returning default EXR value.")
            if default_image is not None:
                return (default_image, default_mask)
            
            print("Warning: No input URLs provided and no default image set. Returning a black image to prevent a crash.")
            blank_image = torch.zeros((1, 64, 64, 3), dtype=torch.float32)
            blank_mask = torch.zeros((1, 64, 64), dtype=torch.float32)
            return (blank_image, blank_mask)

        rgb_batch = []
        mask_batch = []

        for url in urls:
            try:
                print(f"Fetching EXR from URL: {url}")
                response = requests.get(url)
                response.raise_for_status()
                image = self.load_exr_from_data(response.content)
            except requests.exceptions.RequestException as e:
                print(f"Error fetching EXR from URL {url}: {e}")
                continue
            
            if image is None:
                print(f"Warning: Could not decode EXR image from {url}. Check file format.")
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

        if not rgb_batch:
             print("Could not load any frames from the provided URLs. Returning default image.")
             if default_image is not None:
                return (default_image, default_mask)
             blank_image = torch.zeros((1, 64, 64, 3), dtype=torch.float32)
             blank_mask = torch.zeros((1, 64, 64), dtype=torch.float32)
             return (blank_image, blank_mask)

        print(f"Loaded {len(rgb_batch)} frames from URLs.")
        return (torch.cat(rgb_batch, 0), torch.cat(mask_batch, 0))


NODE_CLASS_MAPPINGS = {"ComfyDeployHttpInputEXRSequence": ComfyDeployHttpInputEXRSequence}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyDeployHttpInputEXRSequence": "HTTP EXR Sequence Input (ComfyDeploy)"} 