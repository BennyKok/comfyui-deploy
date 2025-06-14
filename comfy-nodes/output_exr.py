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

class ComfyDeployOutputEXR:
    def __init__(self):
        self.output_dir = folder_paths.get_output_directory()
        self.type = "output"
        self.prefix_append = ""

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE", {"tooltip": "The images to save."}),
                "filename_prefix": (
                    "STRING",
                    {
                        "default": "ComfyUI",
                        "tooltip": "The prefix for the file to save.",
                    },
                ),
                "tonemap": (["linear", "sRGB", "Reinhard"], {"default": "sRGB"}),
            },
            "optional": {
                "upload_url": ("STRING", {"multiline": False, "default": ""}),
                "output_id": (
                    "STRING",
                    {"multiline": False, "default": "output_exr"},
                ),
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "run"

    OUTPUT_NODE = True
    CATEGORY = "🔗ComfyDeploy"
    DESCRIPTION = "Saves the input images as EXR files to your ComfyUI output directory."

    def run(
        self,
        images,
        filename_prefix="ComfyUI",
        tonemap="sRGB",
        upload_url="",
        output_id="output_exr",
    ):
        filename_prefix += self.prefix_append
        full_output_folder, filename, counter, subfolder, filename_prefix = (
            folder_paths.get_save_image_path(
                filename_prefix, self.output_dir, images[0].shape[1], images[0].shape[0]
            )
        )
        results = list()
        
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
            if upload_url:
                # If an upload URL is provided, send the file there
                try:
                    is_success, buffer = cv.imencode(".exr", image)
                    if not is_success:
                        raise Exception("Failed to encode EXR")
                    
                    response = requests.put(upload_url, data=buffer.tobytes(), headers={'Content-Type': 'image/x-exr'})
                    response.raise_for_status()
                    print(f"Successfully uploaded EXR to signed URL.")
                    results.append({"url": upload_url, "output_id": output_id})
                except Exception as e:
                    print(f"Error uploading EXR to signed URL: {e}")

            else:
                # Otherwise, save locally
                filename_with_batch_num = filename.replace("%batch_num%", str(i))
                file = f"{filename_with_batch_num}_{counter:05}_.exr"
                file_path = os.path.join(full_output_folder, file)
                
                cv.imwrite(file_path, image)

                results.append(
                    {
                        "filename": file,
                        "subfolder": subfolder,
                        "type": self.type,
                        "output_id": output_id,
                    }
                )
                counter += 1

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

NODE_CLASS_MAPPINGS = {"ComfyDeployOutputEXR": ComfyDeployOutputEXR, "ComfyDeployOutputEXRFrames": ComfyDeployOutputEXRFrames}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyDeployOutputEXR": "EXR Output (ComfyDeploy)", "ComfyDeployOutputEXRFrames": "EXR Frames Output (ComfyDeploy)"} 