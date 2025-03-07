class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False


WILDCARD = AnyType("*")

class ComfyUIDeployExternalTextAny:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_text"},
                ),
            },
            "optional": {
                "default_value": (
                    "STRING",
                    {"multiline": True, "default": ""},
                ),
                "display_name": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
                "description": (
                    "STRING",
                    {"multiline": True, "default": ""},
                ),
            }
        }

    RETURN_TYPES = (WILDCARD,)
    RETURN_NAMES = ("text",)

    FUNCTION = "run"

    CATEGORY = "🔗ComfyDeploy"

    def run(self, input_id, default_value=None, display_name=None, description=None):
        return [default_value]


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalTextAny": ComfyUIDeployExternalTextAny}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyUIDeployExternalTextAny": "External Text Any (ComfyUI Deploy)"}