import os
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
import cv2 as cv
import numpy as np
import torch
from folder_paths import get_annotated_filepath

def linear_to_srgb(np_array):
    """Converts a linear RGB numpy array to sRGB."""
    less = np_array <= 0.0031308
    np_array[less] = np_array[less] * 12.92
    np_array[~less] = np.power(np_array[~less], 1/2.4) * 1.055 - 0.055
    return np_array

class ExternalExrInput:
    """
    Node to load a single EXR image from a local file path.
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "exr_file": ("STRING", {"default": "path/to/image.exr"}),
                "tonemap": (["linear", "sRGB", "Reinhard"], {"default": "sRGB"}),
            },
            "optional": {
                "default_image": ("IMAGE",),
                "default_mask": ("MASK",),
            }
        }

    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image", "mask",)
    FUNCTION = "run"
    CATEGORY = "🔗ComfyDeploy/EXR"

    def run(self, exr_file, tonemap, default_image=None, default_mask=None):
        image = None
        try:
            if exr_file and exr_file.strip() != "":
                exr_path = get_annotated_filepath(exr_file)
                if os.path.exists(exr_path):
                    image = cv.imread(exr_path, cv.IMREAD_UNCHANGED).astype(np.float32)
                else:
                    print(f"Warning: File not found at {exr_path}")
            
            if image is None:
                raise ValueError("Image could not be loaded.")

            if len(image.shape) == 2: # Grayscale
                image = np.repeat(image[..., np.newaxis], 3, axis=2)
            
            rgb = np.flip(image[:, :, :3], 2).copy() # BGR to RGB
            
            # Apply tonemapping
            if tonemap == "sRGB":
                rgb = linear_to_srgb(rgb)
                rgb = np.clip(rgb, 0, 1)
            elif tonemap == "Reinhard":
                rgb = np.clip(rgb, 0, None)
                rgb = rgb / (rgb + 1)
                rgb = linear_to_srgb(rgb)
                rgb = np.clip(rgb, 0, 1)
            
            rgb_tensor = torch.from_numpy(rgb).unsqueeze(0)
            
            # Handle alpha/mask
            if image.shape[2] > 3:
                mask = np.clip(image[:, :, 3], 0, 1)
            else:
                mask = np.ones_like(rgb[:, :, 0])
            mask_tensor = torch.from_numpy(mask).unsqueeze(0)

            return (rgb_tensor, mask_tensor)

        except Exception as e:
            print(f"Error loading EXR file '{exr_file}': {e}")
            if default_image is not None and default_mask is not None:
                print("Returning default image.")
                return (default_image, default_mask)
            
            print("Warning: Error loading EXR and no default image. Returning a black image.")
            blank_image = torch.zeros((1, 64, 64, 3), dtype=torch.float32)
            blank_mask = torch.zeros((1, 64, 64), dtype=torch.float32)
            return (blank_image, blank_mask)

NODE_CLASS_MAPPINGS = {
    "ExternalExrInput": ExternalExrInput
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ExternalExrInput": "External EXR Input (ComfyDeploy)"
} 