import os
import uuid
import requests
import folder_paths


reactor_models_relative_path = "reactor/faces"
reactor_face_models_path = os.path.join(folder_paths.models_dir, reactor_models_relative_path)
os.makedirs(reactor_face_models_path, exist_ok=True)
folder_paths.folder_names_and_paths[reactor_models_relative_path] = (
    [reactor_face_models_path], folder_paths.supported_pt_extensions
)


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
                    folder_paths.get_filename_list(reactor_models_relative_path),
                ),

                # if `default_face_model_name` is a link to download a file, we will attempt to save it with this name
                "face_model_save_name": (
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
    CATEGORY = "deploy"

    def run(
        self,
        input_id,
        default_face_model_name=None,
        face_model_save_name=None,
        display_name=None,
        description=None,
        face_model_url=None,
    ):

        if face_model_url and face_model_url.startswith("http"):
            if face_model_save_name:
                existing_face_models = folder_paths.get_filename_list(reactor_models_relative_path)
                # Check if face_model_save_name exists in the list
                if face_model_save_name in existing_face_models:
                    print(f"using face model: {face_model_save_name}")
                    return (face_model_save_name,)
            else:
                file_name = face_model_url.split("?")[0].rsplit("/", maxsplit=1)[-1]
                file_extensions = '.' + file_name.rsplit(".", maxsplit=1)[-1]
                if file_extensions in folder_paths.supported_pt_extensions:
                    face_model_save_name = file_name[:40]
                else:
                    face_model_save_name = "reactor_model_" + str(uuid.uuid4())[:8] + ".safetensors"
                print(face_model_save_name)

            destination_path = os.path.join(
                reactor_face_models_path,
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