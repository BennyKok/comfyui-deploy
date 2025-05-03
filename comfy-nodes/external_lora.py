import folder_paths


class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False


WILDCARD = AnyType("*")


class ComfyUIDeployExternalLora:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_lora"},
                ),
            },
            "optional": {
                "default_lora_name": (folder_paths.get_filename_list("loras"),),
                "lora_save_name": (  # if `default_lora_name` is a link to download a file, we will attempt to save it with this name
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
                "lora_url": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
                "bearer_token": (
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
        default_lora_name=None,
        lora_save_name=None,
        display_name=None,
        description=None,
        lora_url=None,
        bearer_token=None,
    ):
        import requests
        import os
        import uuid

        if lora_url:
            if lora_url.startswith("http"):
                if lora_save_name:
                    existing_loras = folder_paths.get_filename_list("loras")
                    # Check if lora_save_name exists in the list
                    if lora_save_name in existing_loras:
                        print(f"using lora: {lora_save_name}")
                        return (lora_save_name,)
                else:
                    lora_save_name = str(uuid.uuid4()) + ".safetensors"
                print(lora_save_name)
                print(folder_paths.folder_names_and_paths["loras"][0][0])
                destination_path = os.path.join(
                    folder_paths.folder_names_and_paths["loras"][0][0], lora_save_name
                )
                print(destination_path)
                print(
                    "Downloading external lora - "
                    + lora_url
                    + " to "
                    + destination_path
                )
                headers = {"User-Agent": "Mozilla/5.0"}
                if bearer_token:
                    headers["Authorization"] = f"Bearer {bearer_token}"
                    print("using bearer token")
                response = requests.get(
                    lora_url,
                    headers=headers,
                    allow_redirects=True,
                )
                with open(destination_path, "wb") as out_file:
                    out_file.write(response.content)
                print(f"Ext Lora loading: {lora_url} to {lora_save_name}")
                return (lora_save_name,)
            else:
                print(f"Ext Lora loading: {lora_url}")
                return (lora_url,)
        else:
            print(f"Ext Lora loading: {default_lora_name}")
            return (default_lora_name,)


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalLora": ComfyUIDeployExternalLora}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIDeployExternalLora": "External Lora (ComfyUI Deploy)"
}
