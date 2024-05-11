class ComfyUIDeployExternalNumberSlider:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_number_slider"},
                ),
            },
            "optional": {
                "default_value": (
                    "FLOAT",
                    {"multiline": True, "display": "number", "default": 0.5, "step": 0.01},
                ),
                "min_value": (
                    "FLOAT",
                    {"multiline": True, "display": "number", "default": 0, "step": 0.01},
                ),
                "max_value": (
                    "FLOAT",
                    {"multiline": True, "display": "number", "default": 1, "step": 0.01},
                ),
            }
        }

    RETURN_TYPES = ("FLOAT",)
    RETURN_NAMES = ("value",)

    FUNCTION = "run"

    CATEGORY = "number"

    def run(self, input_id, default_value=None, min_value=0, max_value=1):
        try:
            float_value = float(input_id)
            if min_value <= float_value <= max_value:
                print("my number", float_value)
                return [float_value]
            else:
                print("Number out of range. Returning default value:", default_value)
                return [default_value]
        except ValueError:
            print("Invalid input. Returning default value:", default_value)
            return [default_value]

NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalNumberSlider": ComfyUIDeployExternalNumberSlider}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyUIDeployExternalNumberSlider": "External Number Slider (ComfyUI Deploy)"}