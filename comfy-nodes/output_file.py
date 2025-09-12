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

        # Security checks - ensure file is within safe ComfyUI paths
        try:
            # Get absolute paths for comparison
            file_abs_path = os.path.abspath(file_path)
            base_path = folder_paths.base_path
            temp_dir = folder_paths.get_temp_directory()

            # Check if file is within ComfyUI base path or temp directory
            if not (
                file_abs_path.startswith(os.path.abspath(base_path))
                or file_abs_path.startswith(os.path.abspath(temp_dir))
            ):
                print(f"⚠️ Security: File outside allowed ComfyUI paths: {file_path}")
                return {"ui": {"files": []}}

            # Check for path traversal attempts (but allow absolute paths within ComfyUI)
            if ".." in file_path:
                print(f"⚠️ Security: Path traversal attempt detected: {file_path}")
                return {"ui": {"files": []}}

        except Exception as e:
            print(f"⚠️ Security check failed: {str(e)}")
            return {"ui": {"files": []}}

        # Get the original filename and extension
        original_filename = os.path.basename(file_path)
        file_extension = os.path.splitext(original_filename)[1]

        # Additional filename security check
        if ".." in original_filename:
            print(f"⚠️ Security: Insecure filename: {original_filename}")
            return {"ui": {"files": []}}

        results = []

        # Check if file is in output folder, if not, symlink it there
        try:
            if file_path.startswith(self.output_dir):
                # File is already in output directory - use as is
                relative_path = os.path.relpath(file_path, self.output_dir)
                path_parts = relative_path.split(os.sep)

                if len(path_parts) > 1:
                    subfolder = os.sep.join(path_parts[:-1])
                else:
                    subfolder = ""

                filename = path_parts[-1]
                file_type = self.type
            else:
                # File is not in output folder - symlink it to output/temp
                print(
                    f"File is not in output folder, symlinking to output/temp: {file_path}"
                )
                output_temp_dir = os.path.join(self.output_dir, "temp")
                if not os.path.exists(output_temp_dir):
                    os.makedirs(output_temp_dir)

                # Use the existing filename but with UUID prefix to avoid conflicts
                file_ext = os.path.splitext(original_filename)[1]
                temp_filename = f"{uuid.uuid4()}{file_ext}"
                temp_path = os.path.join(output_temp_dir, temp_filename)

                # Create symlink to file in output/temp directory where upload system expects it
                try:
                    # Remove existing symlink if it exists
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
                    os.symlink(file_path, temp_path)
                    print(f"File symlinked to output/temp: {temp_path} -> {file_path}")
                except OSError as e:
                    # Fall back to copying if symlink fails
                    print(f"Symlink failed ({e}), falling back to copy")
                    shutil.copy2(file_path, temp_path)
                    print(f"File copied to output/temp: {temp_path}")

                # Use output/temp directory structure for upload
                subfolder = "temp"
                filename = temp_filename
                file_type = self.type

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
