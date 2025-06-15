import os
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
import cv2 as cv
import torch
import numpy as np
import folder_paths

def srgb_to_linear(np_array):
    """Converts an sRGB numpy array to linear RGB."""
    less = np_array <= 0.0404482362771082
    np_array[less] = np_array[less] / 12.92
    np_array[~less] = np.power((np_array[~less] + 0.055) / 1.055, 2.4)
    return np_array

class ExternalExrOutput:
    """
    Node to save a single image as an EXR file to a local path.
    """
    def __init__(self):
        self.output_dir = folder_paths.get_output_directory()
        self.type = "output"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "filepath": ("STRING", {"default": "/tmp/output.exr"}),
                "tonemap": (["linear", "sRGB"], {"default": "linear"}),
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "run"
    OUTPUT_NODE = True
    CATEGORY = "🔗ComfyDeploy/EXR"

    def run(self, images, filepath, tonemap):
        if not filepath.endswith(".exr"):
            raise ValueError("Filepath must end with '.exr'")

        output_dir = os.path.dirname(filepath)
        if not os.path.isabs(output_dir):
            raise ValueError("Filepath must be an absolute path.")
        
        os.makedirs(output_dir, exist_ok=True)
        
        # We only process the first image in the batch
        image_tensor = images[0]
        
        linear = image_tensor.cpu().numpy().astype(np.float32)
        
        # If the source is sRGB, convert to linear
        if tonemap == "sRGB":
            linear[...,:3] = srgb_to_linear(linear[...,:3])

        # Convert RGB to BGR for OpenCV
        bgr = np.flip(linear, 2).copy()
        
        # Save the image
        cv.imwrite(filepath, bgr)
        
        print(f"Saved EXR file to: {filepath}")

        return {"ui": {"images": [{"filename": os.path.basename(filepath), "subfolder": os.path.dirname(filepath), "type": self.type}]}}

NODE_CLASS_MAPPINGS = {
    "ExternalExrOutput": ExternalExrOutput
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ExternalExrOutput": "External EXR Output (ComfyDeploy)"
} 