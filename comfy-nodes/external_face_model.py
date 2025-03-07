from PIL import Image, ImageOps
import numpy as np
import torch
import folder_paths


class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False


WILDCARD = AnyType("*")


class ComfyUIDeployExternalFaceModel:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_reactor_face_model"},
                ),
            },
            "optional": {
                "default_face_model_name": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
                "face_model_save_name": (  # if `default_face_model_name` is a link to download a file, we will attempt to save it with this name
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
                "display_name": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
                "description": (
                    "STRING",
                    {"multiline": True, "default": ""},
                ),
                "face_model_url": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
            },
        }

    RETURN_TYPES = (WILDCARD,)
    RETURN_NAMES = ("path",)
    FUNCTION = "run"
    CATEGORY = "🔗ComfyDeploy"

    def run(
        self,
        input_id,
        default_face_model_name=None,
        face_model_save_name=None,
        display_name=None,
        description=None,
        face_model_url=None,
    ):
        import requests
        import os
        import uuid

        if face_model_url and face_model_url.startswith("http"):
            if face_model_save_name:
                existing_face_models = folder_paths.get_filename_list("reactor/faces")
                # Check if face_model_save_name exists in the list
                if face_model_save_name in existing_face_models:
                    print(f"using face model: {face_model_save_name}")
                    return (face_model_save_name,)
            else:
                face_model_save_name = str(uuid.uuid4()) + ".safetensors"
            print(face_model_save_name)
            print(folder_paths.folder_names_and_paths["reactor/faces"][0][0])
            destination_path = os.path.join(
                folder_paths.folder_names_and_paths["reactor/faces"][0][0],
                face_model_save_name,
            )

            print(destination_path)
            print(
                "Downloading external face model - "
                + face_model_url
                + " to "
                + destination_path
            )
            response = requests.get(
                face_model_url,
                headers={"User-Agent": "Mozilla/5.0"},
                allow_redirects=True,
            )
            with open(destination_path, "wb") as out_file:
                out_file.write(response.content)
            return (face_model_save_name,)
        else:
            print(f"using face model: {default_face_model_name}")
            return (default_face_model_name,)


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalFaceModel": ComfyUIDeployExternalFaceModel}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIDeployExternalFaceModel": "External Face Model (ComfyUI Deploy)"
}
