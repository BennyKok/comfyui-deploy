import os
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
import cv2 as cv
import torch
import numpy as np
import requests

def srgb_to_linear(np_array):
    """Converts an sRGB numpy array to linear RGB."""
    less = np_array <= 0.0404482362771082
    np_array[less] = np_array[less] / 12.92
    np_array[~less] = np.power((np_array[~less] + 0.055) / 1.055, 2.4)
    return np_array

class HttpExrOutput:
    """
    Node to save a single EXR image to a pre-signed URL.
    This node is designed for ComfyDeploy to upload the generated EXR file.
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "put_signed_url": ("STRING", {"multiline": True, "default": ""}),
                "tonemap": (["linear", "sRGB"], {"default": "linear"}),
            },
            "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
        }

    RETURN_TYPES = ()
    FUNCTION = "run"
    OUTPUT_NODE = True
    CATEGORY = "ComfyDeploy/EXR"

    def run(self, images, put_signed_url, tonemap, prompt=None, extra_pnginfo=None):
        if not put_signed_url or put_signed_url.strip() == "":
            print("Warning: No put_signed_url provided. Nothing will be uploaded.")
            return {"ui": {"images": []}}
        
        # We process only the first image of the batch
        image_tensor = images[0]
        
        # Convert tensor to numpy array, assuming it's in range [0, 1]
        linear = image_tensor.cpu().numpy().astype(np.float32)
        
        # If the source is sRGB, convert to linear
        if tonemap == "sRGB":
            linear[...,:3] = srgb_to_linear(linear[...,:3])

        # Convert RGB to BGR for OpenCV
        bgr = np.flip(linear, 2).copy()
        
        results = []
        try:
            # Encode the image to the EXR format in memory
            is_success, buffer = cv.imencode(".exr", bgr)
            if not is_success:
                raise Exception("Failed to encode image to EXR format.")
            
            # Upload the image data to the pre-signed URL
            response = requests.put(put_signed_url, data=buffer.tobytes(), headers={'Content-Type': 'image/x-exr'})
            response.raise_for_status()
            
            print(f"Successfully uploaded EXR to: {put_signed_url}")
            # The UI can optionally display a link or confirmation
            results.append({"url": put_signed_url, "output_id": "output_http_exr"})
            
        except Exception as e:
            print(f"Error uploading EXR to signed URL: {e}")

        return {"ui": {"images": results}}

NODE_CLASS_MAPPINGS = {
    "HttpExrOutput": HttpExrOutput
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HttpExrOutput": "HTTP EXR Output (ComfyDeploy)"
} 