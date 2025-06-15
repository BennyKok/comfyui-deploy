import os
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
import cv2 as cv
import numpy as np
import torch
import requests
import json

def linear_to_srgb(np_array):
    """Converts a linear RGB numpy array to sRGB."""
    less = np_array <= 0.0031308
    np_array[less] = np_array[less] * 12.92
    np_array[~less] = np.power(np_array[~less], 1/2.4) * 1.055 - 0.055
    return np_array

class HttpExrSequenceInput:
    """
    Node to load a sequence of EXR images from a list of URLs provided as a JSON string.
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "urls_json": ("STRING", {"multiline": True, "default": "[]"}),
                "tonemap": (["linear", "sRGB", "Reinhard"], {"default": "sRGB"}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            },
            "optional": {
                "default_image": ("IMAGE",),
                "default_mask": ("MASK",),
            },
        }

    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image", "mask",)
    FUNCTION = "run"
    CATEGORY = "🔗ComfyDeploy/EXR"

    def load_exr_from_data(self, exr_data):
        try:
            nparr = np.frombuffer(exr_data, np.uint8)
            image = cv.imdecode(nparr, cv.IMREAD_UNCHANGED)
            if image is None:
                raise ValueError("Failed to decode EXR data.")
            return image.astype(np.float32)
        except Exception as e:
            print(f"Error decoding EXR data: {e}")
            return None

    def run(self, urls_json, tonemap, seed, default_image=None, default_mask=None):
        try:
            urls = json.loads(urls_json)
            if not isinstance(urls, list) or not all(isinstance(u, str) for u in urls):
                raise ValueError("urls_json must be a JSON array of URL strings.")
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Error parsing urls_json: {e}. Using default image if available.")
            urls = []

        if not urls:
            if default_image is not None and default_mask is not None:
                return (default_image, default_mask)
            
            print("Warning: No valid URLs and no default image. Returning a black image.")
            blank_image = torch.zeros((1, 64, 64, 3), dtype=torch.float32)
            blank_mask = torch.zeros((1, 64, 64), dtype=torch.float32)
            return (blank_image, blank_mask)

        rgb_frames = []
        mask_frames = []

        for url in urls:
            image = None
            try:
                print(f"Fetching EXR from URL: {url}")
                response = requests.get(url)
                response.raise_for_status()
                image = self.load_exr_from_data(response.content)
            except requests.exceptions.RequestException as e:
                print(f"Error fetching EXR from URL {url}: {e}")
            
            if image is None:
                print(f"Warning: Could not decode EXR from {url}. Skipping frame.")
                continue
                
            if len(image.shape) == 2: # Grayscale
                image = np.repeat(image[..., np.newaxis], 3, axis=2)
            
            rgb = np.flip(image[:, :, :3], 2).copy() # BGR to RGB
            
            if tonemap == "sRGB":
                rgb = linear_to_srgb(rgb)
                rgb = np.clip(rgb, 0, 1)
            elif tonemap == "Reinhard":
                rgb = np.clip(rgb, 0, None)
                rgb = rgb / (rgb + 1)
                rgb = linear_to_srgb(rgb)
                rgb = np.clip(rgb, 0, 1)
            
            rgb_frames.append(torch.from_numpy(rgb))

            if image.shape[2] > 3:
                mask = np.clip(image[:, :, 3], 0, 1)
            else:
                mask = np.ones_like(rgb[:, :, 0])
            mask_frames.append(torch.from_numpy(mask))

        if not rgb_frames:
            print("Could not load any frames. Returning default image if available.")
            if default_image is not None and default_mask is not None:
                return (default_image, default_mask)
            
            print("Warning: Failed to load any frames and no default image. Returning a black image.")
            blank_image = torch.zeros((1, 64, 64, 3), dtype=torch.float32)
            blank_mask = torch.zeros((1, 64, 64), dtype=torch.float32)
            return (blank_image, blank_mask)

        print(f"Loaded {len(rgb_frames)} frames successfully.")
        return (torch.stack(rgb_frames, 0), torch.stack(mask_frames, 0))

NODE_CLASS_MAPPINGS = {
    "HttpExrSequenceInput": HttpExrSequenceInput
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HttpExrSequenceInput": "HTTP EXR Sequence Input (ComfyDeploy)"
} 