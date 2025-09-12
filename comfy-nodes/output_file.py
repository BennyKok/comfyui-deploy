import folder_paths
import os
import shutil
import uuid


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
                # File is outside ComfyUI structure - copy to output/temp for upload
                output_temp_dir = os.path.join(self.output_dir, "temp")
                if not os.path.exists(output_temp_dir):
                    os.makedirs(output_temp_dir)

                # Use original filename to preserve extension and avoid conflicts with UUID
                file_ext = os.path.splitext(original_filename)[1]
                temp_filename = f"{uuid.uuid4()}{file_ext}"
                temp_path = os.path.join(output_temp_dir, temp_filename)

                # Create symlink to external file in output/temp directory where upload system expects it
                try:
                    os.symlink(file_path, temp_path)
                    print(
                        f"External file symlinked to output/temp: {temp_path} -> {file_path}"
                    )
                except OSError as e:
                    # Fall back to copying if symlink fails (e.g., on Windows without permissions)
                    print(f"Symlink failed ({e}), falling back to copy")
                    shutil.copy2(file_path, temp_path)
                    print(f"External file copied to output/temp: {temp_path}")

                # Use output/temp directory structure for upload
                subfolder = "temp"
                filename = temp_filename
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
