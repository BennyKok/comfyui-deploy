import json


class AnyType(str):
    """A special class that is always equal in not equal comparisons. Credit to pythongosssss"""

    def __ne__(self, __value: object) -> bool:
        return False


any = AnyType("*")


class ComfyDeployStdOutputAny:
    @classmethod
    def INPUT_TYPES(cls):  # pylint: disable = invalid-name, missing-function-docstring
        return {
            "required": {
                "name": ("STRING", {"default": "ComfyUI"}),
                "source": (any, {}),  # Use "*" to accept any input type
            },
        }

    CATEGORY = "output"
    RETURN_TYPES = ()
    FUNCTION = "run"
    OUTPUT_NODE = True

    def run(self, name, source=None):
        value = "None"
        if source is not None:
            try:
                value = json.dumps(source)
            except Exception:
                try:
                    value = str(source)
                except Exception:
                    value = "source exists, but could not be serialized."

        return {"ui": {name: (value,)}}


NODE_CLASS_MAPPINGS = {"ComfyDeployStdOutputAny": ComfyDeployStdOutputAny}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyDeployStdOutputAny": "Standard Any Output (ComfyDeploy)"
}
