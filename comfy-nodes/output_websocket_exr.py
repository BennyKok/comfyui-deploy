import os
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
import cv2 as cv
import torch
import numpy as np
import folder_paths
from server import PromptServer
import asyncio
from .globals import send_exr, max_output_id_length

def sRGBtoLinear(npArray):
    less = npArray <= 0.0404482362771082
    npArray[less] = npArray[less] / 12.92
    npArray[~less] = np.power((npArray[~less] + 0.055) / 1.055, 2.4)

class ComfyDeployWebscoketEXROutput:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "output_id": (
                    "STRING",
                    {"multiline": False, "default": "output_id"},
                ),
                "images": ("IMAGE", ),
                "tonemap": (["linear", "sRGB", "Reinhard"], {"default": "sRGB"}),
            },
            "optional": {
                "start_frame": ("INT", {"default": 1, "min": 0}),
                "client_id": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
            }
        }

    OUTPUT_NODE = True
    RETURN_TYPES = ()
    FUNCTION = "run"
    CATEGORY = "🔗ComfyDeploy"
    
    @classmethod
    def VALIDATE_INPUTS(s, output_id):
        try:
            if len(output_id.encode('ascii')) > max_output_id_length - 5: # 5 for frame number
                raise ValueError(f"output_id size is too large for frame sequences")
        except UnicodeEncodeError:
            raise ValueError("output_id is not ASCII encodable")

        return True

    def run(self, output_id, images, tonemap, start_frame=1, client_id=None):
        prompt_server = PromptServer.instance
        loop = prompt_server.loop
        
        def schedule_coroutine_blocking(target, *args):
            future = asyncio.run_coroutine_threadsafe(target(*args), loop)
            return future.result()
        
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

        for i, image in enumerate(bgr):
            success, buffer = cv.imencode(".exr", image)
            if not success:
                raise Exception("Failed to encode EXR")
            
            frame_num = start_frame + i
            frame_output_id = f"{output_id}_{frame_num:04d}"

            schedule_coroutine_blocking(send_exr, buffer, client_id, frame_output_id)
            print(f"EXR sent for frame {frame_num}")

        return {"ui": {}}

NODE_CLASS_MAPPINGS = {"ComfyDeployWebscoketEXROutput": ComfyDeployWebscoketEXROutput}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyDeployWebscoketEXROutput": "EXR Websocket Output (ComfyDeploy)"} 