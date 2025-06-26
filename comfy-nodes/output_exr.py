# In file: comfyui-deploy/comfy-nodes/output_exr.py

import os
import numpy as np
import folder_paths

# Try to set up OpenCV for EXR writing.
try:
    os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    print("Warning: OpenCV not found for ComfyDeployOutputEXR. Please add opencv-python-headless to requirements.txt")
    OPENCV_AVAILABLE = False

# ALIGNED: Renamed class to match project conventions
class ComfyDeployOutputEXR:
    def __init__(self):
        self.output_dir = folder_paths.get_output_directory()
        self.type = "output"

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE", ),
                "filename_prefix": ("STRING", {"default": "ComfyDeploy_EXR"})
            },
            # ADDED: Optional output_id for consistency with other ComfyDeploy nodes
            "optional": {
                "output_id": ("STRING", {"multiline": False, "default": "output_exr"}),
            },
        }
    
    RETURN_TYPES = ()
    # ALIGNED: Changed function name to 'run'
    FUNCTION = "run"
    OUTPUT_NODE = True
    # ALIGNED: Matched the category name
    CATEGORY = "🔗ComfyDeploy"
    DESCRIPTION = "Saves the input images as EXR (HDR) files."

    def run(self, images, filename_prefix="ComfyDeploy_EXR", output_id="output_exr"):
        if not OPENCV_AVAILABLE:
            raise ImportError("OpenCV is required to save EXR files. Please ensure opencv-python-headless is in requirements.txt.")

        full_output_folder, filename, counter, subfolder, filename_prefix = (
            folder_paths.get_save_image_path(
                filename_prefix, self.output_dir, images[0].shape[1], images[0].shape[0]
            )
        )
        results = list()

        for image in images:
            image_np = image.cpu().numpy()

            if image_np.dtype != np.float32:
                 image_np = image_np.astype(np.float32)

            file = f"{filename}_{counter:05}.exr"
            file_path = os.path.join(full_output_folder, file)

            image_np_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
            cv2.imwrite(file_path, image_np_bgr)

            results.append({
                "filename": file,
                "subfolder": subfolder,
                "type": self.type,
                "output_id": output_id, # ADDED
            })
            counter += 1

        return {"ui": {"images": results}}

# ALIGNED: Mappings are defined at the bottom of the node file in this project
NODE_CLASS_MAPPINGS = {"ComfyDeployOutputEXR": ComfyDeployOutputEXR}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyDeployOutputEXR": "EXR Output (ComfyDeploy)"}