import os
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
import cv2 as cv
import torch
import numpy as np
import requests
import json

def srgb_to_linear(np_array):
    """Converts an sRGB numpy array to linear RGB."""
    less = np_array <= 0.0404482362771082
    np_array[less] = np_array[less] / 12.92
    np_array[~less] = np.power((np_array[~less] + 0.055) / 1.055, 2.4)
    return np_array

class HttpExrSequenceOutput:
    """
    Node to save a sequence of images as EXR files to a list of pre-signed URLs.
    """
    def __init__(self):
        self.type = "output"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "upload_urls_json": ("STRING", {"multiline": True, "default": "[]"}),
                "tonemap": (["linear", "sRGB"], {"default": "linear"}),
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "run"
    OUTPUT_NODE = True
    CATEGORY = "🔗ComfyDeploy/EXR"

    def run(self, images, upload_urls_json, tonemap):
        try:
            upload_urls = json.loads(upload_urls_json)
            if not isinstance(upload_urls, list) or not all(isinstance(u, str) for u in upload_urls):
                raise ValueError("upload_urls_json must be a JSON array of URL strings.")
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Error parsing upload_urls_json: {e}. Aborting upload.")
            return {"ui": {"images": []}}

        if not upload_urls:
            print("Warning: No upload URLs provided. Nothing will be uploaded.")
            return {"ui": {"images": []}}
        
        if len(images) != len(upload_urls):
            print(f"Warning: Mismatch between number of images ({len(images)}) and upload URLs ({len(upload_urls)}). Aborting upload.")
            return {"ui": {"images": []}}

        # Convert tensor to numpy array
        linear_images = images.cpu().numpy().astype(np.float32)
        
        # If the source is sRGB, convert all images to linear
        if tonemap == "sRGB":
            srgb_to_linear(linear_images[...,:3])
        
        # Convert RGB to BGR for OpenCV
        bgr_images = np.flip(linear_images, 3).copy()

        results = []
        for i, (bgr_image, url) in enumerate(zip(bgr_images, upload_urls)):
            try:
                # Encode the image to the EXR format in memory
                is_success, buffer = cv.imencode(".exr", bgr_image)
                if not is_success:
                    raise Exception("Failed to encode image to EXR format.")
                
                # Upload the image data to the pre-signed URL
                response = requests.put(url, data=buffer.tobytes(), headers={'Content-Type': 'image/x-exr'})
                response.raise_for_status()
                
                print(f"Successfully uploaded frame {i+1} to: {url}")
                results.append({"url": url})
                
            except Exception as e:
                print(f"Error uploading frame {i+1} to {url}: {e}")

        return {"ui": {"images": results}}

NODE_CLASS_MAPPINGS = {
    "HttpExrSequenceOutput": HttpExrSequenceOutput
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HttpExrSequenceOutput": "HTTP EXR Sequence Output (ComfyDeploy)"
} 