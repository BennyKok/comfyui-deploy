class ComfyUIDeployExternalNumberSliderInt:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_number_slider_int"},
                ),
            },
            "optional": {
                "default_value": (
                    "INT",
                    {"multiline": True, "display": "number", "min": -2147483647, "max": 2147483647, "default": 1, "step": 1},
                ),
                "min_value": (
                    "INT",
                    {"multiline": True, "display": "number", "min": -2147483647, "max": 2147483647, "default": 0, "step": 1},
                ),
                "max_value": (
                    "INT",
                    {"multiline": True, "display": "number", "min": -2147483647, "max": 2147483647, "default": 10, "step": 1},
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

    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("value",)
    FUNCTION = "run"
    CATEGORY = "🔗ComfyDeploy"

    def run(self, input_id, default_value=None, min_value=0, max_value=10, display_name=None, description=None):
        try:
            int_value = int(round(float(input_id)))
            if min_value <= int_value <= max_value:
                print("my integer", int_value)
                return [int_value]
            else:
                print("Integer out of range. Returning default value:", default_value)
                return [default_value]
        except (ValueError, TypeError):
            print("Invalid input. Returning default value:", default_value)
            return [default_value]

NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalNumberSliderInt": ComfyUIDeployExternalNumberSliderInt}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyUIDeployExternalNumberSliderInt": "External Number Slider Int (ComfyUI Deploy)"}
