import os
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
import cv2 as cv
import torch
import numpy as np
import requests
import json

def sRGBtoLinear(npArray):
    less = npArray <= 0.0404482362771082
    npArray[less] = npArray[less] / 12.92
    npArray[~less] = np.power((npArray[~less] + 0.055) / 1.055, 2.4)

class ComfyDeployHttpOutputEXRSequence:
    def __init__(self):
        self.type = "output"

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE",),
                "upload_urls_json": (
                    "STRING",
                    {"multiline": True, "default": "[]"},
                ),
                "tonemap": (["linear", "sRGB", "Reinhard"], {"default": "sRGB"}),
            },
             "optional": {
                "output_id": ("STRING", {"multiline": False, "default": "output_exr_sequence"}),
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "run"
    OUTPUT_NODE = True
    CATEGORY = "🔗ComfyDeploy"
    DESCRIPTION = "Uploads an image sequence as EXR files to a list of pre-signed URLs."

    def run(self, images, upload_urls_json, tonemap, output_id="output_exr_sequence"):
        try:
            upload_urls = json.loads(upload_urls_json)
            if not isinstance(upload_urls, list):
                raise ValueError("upload_urls_json must be a JSON array of strings.")
        except Exception as e:
            print(f"Error parsing upload_urls_json: {e}")
            upload_urls = []

        if not upload_urls:
            print("Warning: No upload URLs provided. Nothing will be uploaded.")
            return {"ui": {"images": []}}
        
        if len(images) != len(upload_urls):
            print(f"Warning: Mismatch between number of images ({len(images)}) and upload URLs ({len(upload_urls)}). Upload will be skipped.")
            return {"ui": {"images": []}}

        linear = images.cpu().numpy().astype(np.float32)
        if tonemap != "linear":
            sRGBtoLinear(linear[...,:3])
        if tonemap == "Reinhard":
            linear[...,:3] = np.clip(linear[...,:3], 0, 0.999999)
            linear[...,:3] = -linear[...,:3] / (linear[...,:3] - 1)
        
        bgr = linear.copy()
        bgr[:,:,:,0] = linear[:,:,:,2]
        bgr[:,:,:,2] = linear[:,:,:,0]
        if bgr.shape[-1] > 3:
            bgr[:,:,:,3] = np.clip(1 - linear[:,:,:,3], 0, 1)

        results = list()
        
        for i, image in enumerate(bgr):
            upload_url = upload_urls[i]
            try:
                is_success, buffer = cv.imencode(".exr", image)
                if not is_success:
                    raise Exception("Failed to encode EXR")
                
                response = requests.put(upload_url, data=buffer.tobytes(), headers={'Content-Type': 'image/x-exr'})
                response.raise_for_status()
                print(f"Successfully uploaded frame {i+1} to signed URL.")
                results.append({"url": upload_url, "output_id": f"{output_id}_{i+1}"})
            except Exception as e:
                print(f"Error uploading frame {i+1} to signed URL: {e}")

        return {"ui": {"images": results}}

NODE_CLASS_MAPPINGS = {"ComfyDeployHttpOutputEXRSequence": ComfyDeployHttpOutputEXRSequence}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyDeployHttpOutputEXRSequence": "HTTP EXR Sequence Output (ComfyDeploy)"} 