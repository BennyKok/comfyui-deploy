class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False


WILDCARD = AnyType("*")

class ComfyUIDeployExternalEnum:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_enum"},
                ),
            },
            "optional": {
                "default_value": (
                    "STRING",
                    {"multiline": False, "default": "", "dynamic_enum": True},
                ),
                "options": (
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

    def run(self, input_id, options=None, default_value=None, display_name=None, description=None):
        return [default_value]