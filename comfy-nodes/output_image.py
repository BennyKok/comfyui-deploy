import os
import json
import numpy as np
from PIL import Image
from PIL.PngImagePlugin import PngInfo
import folder_paths
from comfy.cli_args import args


class ComfyDeployOutputImage:
    def __init__(self):
        self.output_dir = folder_paths.get_output_directory()
        self.type = "output"
        self.prefix_append = ""
        self.compress_level = 4

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE", {"tooltip": "The images to save."}),
                "filename_prefix": (
                    "STRING",
                    {
                        "default": "ComfyUI",
                        "tooltip": "The prefix for the file to save. This may include formatting information such as %date:yyyy-MM-dd% or %Empty Latent Image.width% to include values from nodes.",
                    },
                ),
                "file_type": (["png", "jpg", "webp"], {"default": "webp"}),
                "quality": ("INT", {"default": 80, "min": 1, "max": 100, "step": 1}),
            },
            "optional": {
                "output_id": (
                    "STRING",
                    {"multiline": False, "default": "output_images"},
                ),
            },
            "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
        }

    RETURN_TYPES = ()
    FUNCTION = "run"

    OUTPUT_NODE = True
    CATEGORY = "🔗ComfyDeploy"
    DESCRIPTION = "Saves the input images to your ComfyUI output directory."

    def run(
        self,
        images,
        filename_prefix="ComfyUI",
        file_type="png",
        quality=80,
        output_id="output_images",
        prompt=None,
        extra_pnginfo=None,
    ):
        filename_prefix += self.prefix_append
        full_output_folder, filename, counter, subfolder, filename_prefix = (
            folder_paths.get_save_image_path(
                filename_prefix, self.output_dir, images[0].shape[1], images[0].shape[0]
            )
        )
        results = list()
        for batch_number, image in enumerate(images):
            i = 255.0 * image.cpu().numpy()
            img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
            metadata = None
            if not args.disable_metadata:
                metadata = PngInfo()
                if prompt is not None:
                    metadata.add_text("prompt", json.dumps(prompt))
                if extra_pnginfo is not None:
                    for x in extra_pnginfo:
                        metadata.add_text(x, json.dumps(extra_pnginfo[x]))

            filename_with_batch_num = filename.replace("%batch_num%", str(batch_number))
            file = f"{filename_with_batch_num}_{counter:05}_.{file_type}"
            file_path = os.path.join(full_output_folder, file)

            if file_type == "png":
                img.save(
                    file_path, pnginfo=metadata, compress_level=self.compress_level
                )
            elif file_type == "jpg":
                img.save(file_path, quality=quality, optimize=True)
            elif file_type == "webp":
                img.save(file_path, quality=quality)

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


NODE_CLASS_MAPPINGS = {"ComfyDeployOutputImage": ComfyDeployOutputImage}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyDeployOutputImage": "Image Output (ComfyDeploy)"}
