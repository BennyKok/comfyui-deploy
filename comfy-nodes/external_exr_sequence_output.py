import os
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
import cv2 as cv
import torch
import numpy as np
import re

def srgb_to_linear(np_array):
    """Converts an sRGB numpy array to linear RGB."""
    less = np_array <= 0.0404482362771082
    np_array[less] = np_array[less] / 12.92
    np_array[~less] = np.power((np_array[~less] + 0.055) / 1.055, 2.4)
    return np_array

class ExternalExrSequenceOutput:
    """
    Node to save a sequence of images as EXR files to a local directory.
    It uses a filepath pattern like 'path/to/frame_%04d.exr' to save each frame.
    """
    def __init__(self):
        self.type = "output"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "filepath_pattern": ("STRING", {"default": "/tmp/exr_sequence/frame_%04d.exr"}),
                "tonemap": (["linear", "sRGB"], {"default": "linear"}),
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "run"
    OUTPUT_NODE = True
    CATEGORY = "🔗ComfyDeploy/EXR"

    def run(self, images, filepath_pattern, tonemap):
        # Basic validation for the filepath pattern
        if not re.search(r'%0?\d+d', filepath_pattern):
            raise ValueError("Filepath pattern must contain a C-style format specifier like '%04d'.")
            
        if not filepath_pattern.endswith(".exr"):
            raise ValueError("Filepath pattern must end with '.exr'.")

        output_dir = os.path.dirname(filepath_pattern)
        if not os.path.isabs(output_dir):
            raise ValueError("Filepath must be an absolute path.")
            
        os.makedirs(output_dir, exist_ok=True)
        
        # Convert tensor to numpy array
        linear_images = images.cpu().numpy().astype(np.float32)
        
        # If the source is sRGB, convert to linear
        if tonemap == "sRGB":
            srgb_to_linear(linear_images[...,:3])
        
        # Convert RGB to BGR for OpenCV
        bgr_images = np.flip(linear_images, 3).copy()

        results = []
        for i, bgr_image in enumerate(bgr_images):
            frame_num = i + 1
            try:
                # Use the pattern to format the full file path
                file_path = filepath_pattern % frame_num
            except TypeError:
                raise ValueError("Invalid format specifier in filepath_pattern. Use '%d', '%04d', etc.")

            # Save the image
            cv.imwrite(file_path, bgr_image)
            
            results.append({
                "filename": os.path.basename(file_path),
                "subfolder": os.path.dirname(file_path),
                "type": self.type,
            })
        
        return {"ui": {"images": results}}

NODE_CLASS_MAPPINGS = {
    "ExternalExrSequenceOutput": ExternalExrSequenceOutput
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ExternalExrSequenceOutput": "External EXR Sequence Output (ComfyDeploy)"
} 