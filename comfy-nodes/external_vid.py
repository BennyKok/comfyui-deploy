import os
import folder_paths
import uuid

from tqdm import tqdm

video_extensions = ["webm", "mp4", "mkv", "gif"]


class ComfyUIDeployExternalVideo:
    @classmethod
    def INPUT_TYPES(s):
        input_dir = folder_paths.get_input_directory()
        files = []
        for f in os.listdir(input_dir):
            if os.path.isfile(os.path.join(input_dir, f)):
                file_parts = f.split(".")
                if len(file_parts) > 1 and (file_parts[-1] in video_extensions):
                    files.append(f)
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_video"},
                ),
            },
            "optional": {
                "meta_batch": ("VHS_BatchManager",),
                "default_value": (sorted(files),),
            },
        }

    CATEGORY = "Video Helper Suite 🎥🅥🅗🅢"

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("video")

    FUNCTION = "load_video"
    CATEGORY = "🔗ComfyDeploy"

    def load_video(self, input_id, default_value):
        input_dir = folder_paths.get_input_directory()
        if input_id.startswith("http"):
            import requests

            print("Fetching video from URL: ", input_id)
            response = requests.get(input_id, stream=True)
            file_size = int(response.headers.get("Content-Length", 0))
            file_extension = input_id.split(".")[-1].split("?")[
                0
            ]  # Extract extension and handle URLs with parameters
            if file_extension not in video_extensions:
                file_extension = ".mp4"

            unique_filename = str(uuid.uuid4()) + "." + file_extension
            video_path = os.path.join(input_dir, unique_filename)
            chunk_size = 1024  # 1 Kibibyte

            num_bars = int(file_size / chunk_size)

            with open(video_path, "wb") as out_file:
                for chunk in tqdm(
                    response.iter_content(chunk_size=chunk_size),
                    total=num_bars,
                    unit="KB",
                    desc="Downloading",
                    leave=True,
                ):
                    out_file.write(chunk)
        else:
            video_path = os.path.abspath(os.path.join(input_dir, default_value))

        return (video_path,)


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalVid": ComfyUIDeployExternalVideo}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIDeployExternalVid": "External Video (ComfyUI Deploy) path"
}
