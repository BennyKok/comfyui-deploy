import os
import json
import folder_paths


class ComfyDeployOutputText:
    def __init__(self):
        self.output_dir = folder_paths.get_output_directory()
        self.type = "output"
        self.prefix_append = ""

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": (
                    "STRING",
                    {
                        "multiline": True,
                        "forceInput": True,
                        "tooltip": "The text to save.",
                    },
                ),
                "filename_prefix": (
                    "STRING",
                    {
                        "default": "ComfyUI",
                        "tooltip": "The prefix for the file to save. This may include formatting information such as %date:yyyy-MM-dd% to include values from nodes.",
                    },
                ),
                "file_type": (["txt", "json", "md"], {"default": "txt"}),
            },
            "optional": {
                "output_id": (
                    "STRING",
                    {"multiline": False, "default": "output_text"},
                ),
            },
            "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
        }

    RETURN_TYPES = ()
    FUNCTION = "run"

    OUTPUT_NODE = True
    CATEGORY = "🔗ComfyDeploy"
    DESCRIPTION = "Saves the input text to your ComfyUI output directory."

    def run(
        self,
        text,
        filename_prefix="ComfyUI",
        file_type="txt",
        output_id="output_text",
        prompt=None,
        extra_pnginfo=None,
    ):
        filename_prefix += self.prefix_append
        # For text, we don't need dimensions, so pass 0, 0
        full_output_folder, filename, counter, subfolder, filename_prefix = (
            folder_paths.get_save_image_path(filename_prefix, self.output_dir, 0, 0)
        )

        results = list()

        # Create file path
        file = f"{filename}_{counter:05}_.{file_type}"
        file_path = os.path.join(full_output_folder, file)

        # Save the text based on file type
        if file_type == "json":
            try:
                # Try to save as JSON if the text is valid JSON
                json_data = json.loads(text) if isinstance(text, str) else text
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(json_data, f, indent=2)
            except json.JSONDecodeError:
                # Fall back to saving as plain text if not valid JSON
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(text)
        else:
            # Save as plain text for txt and md
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(text)

        results.append(
            {
                "filename": file,
                "subfolder": subfolder,
                "type": self.type,
                "output_id": output_id,
            }
        )

        return {"ui": {"text_file": results}}


NODE_CLASS_MAPPINGS = {"ComfyDeployOutputText": ComfyDeployOutputText}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyDeployOutputText": "Text Output (ComfyDeploy)"}
