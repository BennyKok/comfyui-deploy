class ComfyUIDeployExternalBoolean:
    @classmethod    
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_bool"},
                ),
                "default_value": ("BOOLEAN", {"default": False})
            }
        }

    RETURN_TYPES = ("BOOLEAN",)
    RETURN_NAMES = ("bool_value",)
    
    FUNCTION = "run"
    
    def run(self, input_id, default_value=None):
        print(f"Node '{input_id}' processing with switch set to {default_value}")
        return [default_value]
    

NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalBoolean": ComfyUIDeployExternalBoolean}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyUIDeployExternalBoolean": "External Boolean (ComfyUI Deploy)"}