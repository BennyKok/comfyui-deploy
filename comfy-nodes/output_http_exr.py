import os
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
import cv2 as cv
import torch
import numpy as np
import folder_paths
import requests

def sRGBtoLinear(npArray):
    less = npArray <= 0.0404482362771082
    npArray[less] = npArray[less] / 12.92
    npArray[~less] = np.power((npArray[~less] + 0.055) / 1.055, 2.4)

class ComfyDeployHttpOutputEXR:
    def __init__(self):
        self.output_dir = folder_paths.get_output_directory()
        self.type = "output"
        self.prefix_append = ""

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE",),
                "put_signed_url": ("STRING", {"multiline": True, "default": ""}),
                "tonemap": (["linear", "sRGB", "Reinhard"], {"default": "sRGB"}),
            },
            "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
        }

    RETURN_TYPES = ()
    FUNCTION = "run"
    OUTPUT_NODE = True
    CATEGORY = "🔗ComfyDeploy"
    DESCRIPTION = "Uploads an image as an EXR file to a pre-signed URL."

    def run(self, images, put_signed_url, tonemap, prompt=None, extra_pnginfo=None):
        if not put_signed_url:
            print("Warning: No put_signed_url provided. Nothing will be uploaded.")
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
        
        for image in bgr:
            try:
                is_success, buffer = cv.imencode(".exr", image)
                if not is_success:
                    raise Exception("Failed to encode EXR")
                
                response = requests.put(put_signed_url, data=buffer.tobytes(), headers={'Content-Type': 'image/x-exr'})
                response.raise_for_status()
                print("Successfully uploaded to signed URL")
                results.append({"url": put_signed_url, "output_id": "output_http_exr"})
            except Exception as e:
                print(f"Error uploading to signed URL: {e}")

        return {"ui": {"images": results}}

class ComfyDeployOutputEXRFrames:
    def __init__(self):
        self.type = "output"

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE",),
                "filepath_pattern": ("STRING", {"default": "path/to/frame%04d.exr"}),
                "tonemap": (["linear", "sRGB", "Reinhard"], {"default": "sRGB"}),
                "start_frame": ("INT", {"default": 1, "min": 0}),
            },
             "optional": {
                "output_id": ("STRING", {"multiline": False, "default": "output_exr_frames"}),
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "run"
    OUTPUT_NODE = True
    CATEGORY = "🔗ComfyDeploy"
    DESCRIPTION = "Saves the input image sequence as EXR files to a specified path."

    def run(self, images, filepath_pattern, tonemap, start_frame, output_id="output_exr_frames"):
        if "%04d" not in filepath_pattern:
            raise Exception("Filepath pattern must contain '%04d'")
        
        if not os.path.isabs(filepath_pattern):
             raise Exception("Filepath pattern must be an absolute path.")
        
        os.makedirs(os.path.dirname(filepath_pattern), exist_ok=True)
        
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
            frame_num = start_frame + i
            file_path = filepath_pattern.replace("%04d", f"{frame_num:04}")
            
            cv.imwrite(file_path, image)

            results.append({
                "filename": os.path.basename(file_path),
                "subfolder": os.path.dirname(file_path),
                "type": self.type,
                "output_id": output_id,
            })
        
        return {"ui": {"images": results}}

NODE_CLASS_MAPPINGS = {"ComfyDeployHttpOutputEXR": ComfyDeployHttpOutputEXR, "ComfyDeployOutputEXRFrames": ComfyDeployOutputEXRFrames}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyDeployHttpOutputEXR": "HTTP EXR Output (ComfyDeploy)", "ComfyDeployOutputEXRFrames": "EXR Frames Saver (ComfyDeploy)"} 