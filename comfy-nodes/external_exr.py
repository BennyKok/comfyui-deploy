import os
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
import io
import cv2 as cv
import numpy as np
import torch
import requests
from folder_paths import get_annotated_filepath

def sRGBtoLinear(npArray):
    less = npArray <= 0.0404482362771082
    npArray[less] = npArray[less] / 12.92
    npArray[~less] = np.power((npArray[~less] + 0.055) / 1.055, 2.4)

def linearToSRGB(npArray):
    less = npArray <= 0.0031308
    npArray[less] = npArray[less] * 12.92
    npArray[~less] = np.power(npArray[~less], 1/2.4) * 1.055 - 0.055

class ComfyUIDeployExternalEXR:
    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image", "mask") 
    FUNCTION = "load_exr"
    CATEGORY = "🔗ComfyDeploy"
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_exr"},
                ),
                "exr_file": ("STRING", {"default": ""}),
                "tonemap": (["linear", "sRGB", "Reinhard"], {"default": "sRGB"}),
            },
            "optional": {
                "default_image": ("IMAGE",),
                "default_mask": ("MASK",),
                "display_name": (
                    "STRING", 
                    {"multiline": False, "default": ""},
                ),
                "description": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
            }
        }

    @classmethod
    def VALIDATE_INPUTS(s, exr_file, **kwargs):
        return True

    def load_exr(self, input_id, exr_file, tonemap="sRGB", 
                 default_image=None, default_mask=None,
                 display_name=None, description=None):
        try:
            if exr_file and exr_file != "":
                if exr_file.startswith(('http://', 'https://')):
                    # Handle URL input
                    response = requests.get(exr_file)
                    # Write to temp buffer
                    buffer = io.BytesIO(response.content)
                    nparr = np.frombuffer(buffer.getvalue(), np.uint8)
                    image = cv.imdecode(nparr, cv.IMREAD_UNCHANGED).astype(np.float32)
                else:
                    # Handle local file
                    exr_path = get_annotated_filepath(exr_file)
                    image = cv.imread(exr_path, cv.IMREAD_UNCHANGED).astype(np.float32)

                if len(image.shape) == 2:
                    image = np.repeat(image[..., np.newaxis], 3, axis=2)
                
                # Extract RGB and flip channels
                rgb = np.flip(image[:,:,:3], 2).copy()
                
                # Apply tonemapping
                if tonemap == "sRGB":
                    linearToSRGB(rgb)
                    rgb = np.clip(rgb, 0, 1)
                elif tonemap == "Reinhard":
                    rgb = np.clip(rgb, 0, None)
                    rgb = rgb / (rgb + 1)
                    linearToSRGB(rgb)
                    rgb = np.clip(rgb, 0, 1)
                
                rgb = torch.unsqueeze(torch.from_numpy(rgb), 0)
                
                # Handle alpha/mask
                mask = torch.zeros((1, image.shape[0], image.shape[1]), dtype=torch.float32)
                if image.shape[2] > 3:
                    mask[0] = torch.from_numpy(np.clip(image[:,:,3], 0, 1))

                return (rgb, mask)
            else:
                # Return defaults if no file provided
                return (default_image, default_mask)

        except Exception as e:
            print(f"Error loading EXR: {str(e)}")
            # Return defaults on error
            return (default_image, default_mask)

NODE_CLASS_MAPPINGS = {
    "ComfyUIDeployExternalEXR": ComfyUIDeployExternalEXR
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIDeployExternalEXR": "External EXR (ComfyUI Deploy)"
}

class ComfyUIDeployExternalEXRFrames:
    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image", "mask") 
    FUNCTION = "load_exr_frames"
    CATEGORY = "🔗ComfyDeploy"
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "exr_file_pattern": ("STRING", {"default": "path/to/frame%04d.exr"}),
                "tonemap": (["linear", "sRGB", "Reinhard"], {"default": "sRGB"}),
                "start_frame": ("INT", {"default": 1, "min": 0}),
                "end_frame": ("INT", {"default": 1, "min": 0}),
            },
            "optional": {
                "default_image": ("IMAGE",),
                "default_mask": ("MASK",),
            }
        }

    def load_exr_frames(self, exr_file_pattern, tonemap, start_frame, end_frame, 
                        default_image=None, default_mask=None):
        if "%04d" not in exr_file_pattern:
             raise Exception("Filepath needs to contain a frame pattern like %04d")

        rgb_list = []
        mask_list = []
        
        for frame_num in range(start_frame, end_frame + 1):
            frame_path = exr_file_pattern.replace("%04d", f"{frame_num:04}")
            exr_path = get_annotated_filepath(frame_path)

            if not os.path.exists(exr_path):
                 print(f"Frame not found, skipping: {exr_path}")
                 continue

            image = cv.imread(exr_path, cv.IMREAD_UNCHANGED).astype(np.float32)

            if len(image.shape) == 2:
                image = np.repeat(image[..., np.newaxis], 3, axis=2)
            
            rgb = np.flip(image[:,:,:3], 2).copy()
            
            if tonemap == "sRGB":
                linearToSRGB(rgb)
                rgb = np.clip(rgb, 0, 1)
            elif tonemap == "Reinhard":
                rgb = np.clip(rgb, 0, None)
                rgb = rgb / (rgb + 1)
                linearToSRGB(rgb)
                rgb = np.clip(rgb, 0, 1)
            
            rgb_list.append(torch.from_numpy(rgb))
            
            single_mask = torch.zeros((image.shape[0], image.shape[1]), dtype=torch.float32)
            if image.shape[2] > 3:
                single_mask = torch.from_numpy(np.clip(image[:,:,3], 0, 1))
            mask_list.append(single_mask)

        if not rgb_list:
            print("No frames loaded, returning default values.")
            return (default_image, default_mask)

        return (torch.stack(rgb_list, 0), torch.stack(mask_list, 0))

NODE_CLASS_MAPPINGS["ComfyUIDeployExternalEXRFrames"] = ComfyUIDeployExternalEXRFrames
NODE_DISPLAY_NAME_MAPPINGS["ComfyUIDeployExternalEXRFrames"] = "External EXR Frames (ComfyUI Deploy)"
