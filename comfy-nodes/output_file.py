import folder_paths
import os
import shutil


class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False


WILDCARD = AnyType("*")


class ComfyDeployOutputFile:
    def __init__(self):
        self.output_dir = folder_paths.get_output_directory()
        self.type = "output"

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "file_path": (
                    "STRING",
                    {
                        "forceInput": True,
                        "tooltip": "Path to the file to output and upload.",
                    },
                ),
            },
            "optional": {
                "output_id": (
                    "STRING",
                    {"multiline": False, "default": "output_file"},
                ),
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "run"
    OUTPUT_NODE = True
    CATEGORY = "🔗ComfyDeploy"
    DESCRIPTION = "Outputs any file by path for upload to ComfyDeploy."

    def run(self, file_path, output_id="output_file"):
        if not file_path or not os.path.exists(file_path):
            print(f"⚠️ File not found: {file_path}")
            return {"ui": {"files": []}}

        # Get the original filename and extension
        original_filename = os.path.basename(file_path)
        file_extension = os.path.splitext(original_filename)[1]

        results = []

        # Reference file in place - determine subfolder relative to ComfyUI
        try:
            # Try to determine if file is in a ComfyUI directory structure
            base_path = folder_paths.base_path
            if file_path.startswith(base_path):
                # File is within ComfyUI directory structure
                relative_path = os.path.relpath(file_path, base_path)
                path_parts = relative_path.split(os.sep)

                if len(path_parts) > 1:
                    subfolder = os.sep.join(path_parts[:-1])
                else:
                    subfolder = ""

                filename = path_parts[-1]
                file_type = self.type
            else:
                # File is outside ComfyUI structure - copy to temp for upload
                temp_dir = folder_paths.get_temp_directory()
                if not os.path.exists(temp_dir):
                    os.makedirs(temp_dir)

                temp_filename = f"external_{original_filename}"
                temp_path = os.path.join(temp_dir, temp_filename)

                # Copy external file to temp directory
                shutil.copy2(file_path, temp_path)
                print(f"External file copied to temp: {temp_path}")

                # Use temp directory structure
                relative_temp = os.path.relpath(temp_path, base_path)
                temp_parts = relative_temp.split(os.sep)

                if len(temp_parts) > 1:
                    subfolder = os.sep.join(temp_parts[:-1])
                else:
                    subfolder = ""

                filename = temp_parts[-1]
                file_type = self.type  # Use "output" type so it gets uploaded

            results.append(
                {
                    "filename": filename,
                    "subfolder": subfolder,
                    "type": file_type,
                    "output_id": output_id,
                }
            )

        except Exception as e:
            print(f"⚠️ Error processing file path: {str(e)}")
            return {"ui": {"files": []}}

        # Determine the appropriate UI key based on file type
        file_ext = file_extension.lower()
        if file_ext in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff"]:
            ui_key = "images"
        elif file_ext in [".mp3", ".wav", ".flac", ".aac", ".ogg"]:
            ui_key = "audio"
        elif file_ext in [".txt", ".json", ".md", ".csv"]:
            ui_key = "text_file"
        elif file_ext in [".exr", ".hdr"]:
            ui_key = "images"  # EXR files are still images
        elif file_ext in [".zip", ".psb", ".psd"]:
            ui_key = "files"  # Archives and Photoshop project files
        else:
            ui_key = "files"  # Generic files

        return {"ui": {ui_key: results}}


NODE_CLASS_MAPPINGS = {
    "ComfyDeployOutputFile": ComfyDeployOutputFile,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyDeployOutputFile": "File Output (ComfyDeploy)",
}
