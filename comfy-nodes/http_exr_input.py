import os
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
import cv2 as cv
import numpy as np
import torch
import requests

def linear_to_srgb(np_array):
    """Converts a linear RGB numpy array to sRGB."""
    less = np_array <= 0.0031308
    np_array[less] = np_array[less] * 12.92
    np_array[~less] = np.power(np_array[~less], 1/2.4) * 1.055 - 0.055
    return np_array

class HttpExrInput:
    """
    Node to load a single EXR image from a URL, with optional tonemapping.
    This node is designed to be used in a ComfyDeploy environment where input files are provided via signed URLs.
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "get_signed_url": ("STRING", {"multiline": True, "default": ""}),
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
            # Use cv.IMREAD_UNCHANGED to keep all channels (e.g., alpha)
            image = cv.imdecode(nparr, cv.IMREAD_UNCHANGED)
            if image is None:
                raise ValueError("Failed to decode EXR data.")
            return image.astype(np.float32)
        except Exception as e:
            print(f"Error decoding EXR data: {e}")
            return None

    def run(self, get_signed_url, tonemap, seed, default_image=None, default_mask=None):
        if not get_signed_url or get_signed_url.strip() == "":
            print("Warning: No input URL provided. Returning default image if available.")
            if default_image is not None and default_mask is not None:
                return (default_image, default_mask)
            
            print("Warning: No input URL and no default image. Returning a black image.")
            blank_image = torch.zeros((1, 64, 64, 3), dtype=torch.float32)
            blank_mask = torch.zeros((1, 64, 64), dtype=torch.float32)
            return (blank_image, blank_mask)

        image = None
        try:
            print(f"Fetching EXR from URL: {get_signed_url}")
            response = requests.get(get_signed_url)
            response.raise_for_status()
            image = self.load_exr_from_data(response.content)
        except requests.exceptions.RequestException as e:
            print(f"Error fetching EXR from URL {get_signed_url}: {e}")

        if image is None:
            print("Warning: Could not load or decode EXR image. Returning default image if available.")
            if default_image is not None and default_mask is not None:
                return (default_image, default_mask)

            print("Warning: Failed to load EXR and no default image. Returning a black image.")
            blank_image = torch.zeros((1, 64, 64, 3), dtype=torch.float32)
            blank_mask = torch.zeros((1, 64, 64), dtype=torch.float32)
            return (blank_image, blank_mask)
                    
        # BGR to RGB conversion and channel handling
        if len(image.shape) == 2: # Grayscale
            image = np.repeat(image[..., np.newaxis], 3, axis=2)
        
        rgb = np.flip(image[:, :, :3], 2).copy() # OpenCV loads as BGR, convert to RGB
        
        # Tonemapping
        if tonemap == "sRGB":
            rgb = linear_to_srgb(rgb)
            rgb = np.clip(rgb, 0, 1)
        elif tonemap == "Reinhard":
            rgb = np.clip(rgb, 0, None) # Ensure no negative values
            rgb = rgb / (rgb + 1)
            rgb = linear_to_srgb(rgb)
            rgb = np.clip(rgb, 0, 1)
        
        # Handle alpha channel if it exists
        if image.shape[2] > 3:
            mask = np.clip(image[:, :, 3], 0, 1)
        else:
            mask = np.ones_like(rgb[:, :, 0]) # Create a full white mask if no alpha

        return (torch.from_numpy(rgb).unsqueeze(0), torch.from_numpy(mask).unsqueeze(0),)

NODE_CLASS_MAPPINGS = {
    "HttpExrInput": HttpExrInput
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HttpExrInput": "HTTP EXR Input (ComfyDeploy)"
} 