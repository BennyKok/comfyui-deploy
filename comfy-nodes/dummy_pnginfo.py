import json
import torch


class AlwaysEqualProxy(str):
    def __eq__(self, _):
        return True

    def __ne__(self, _):
        return False


any_type = AlwaysEqualProxy("*")


class ComfyUIDeployDummyPngInfo:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {},
            "optional": {
                "anything": (any_type, {}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = (any_type,)
    RETURN_NAMES = ("output",)
    OUTPUT_NODE = False
    FUNCTION = "create_metadata"
    CATEGORY = "🔗ComfyDeploy"

    def create_metadata(
        self, unique_id=None, extra_pnginfo=None, prompt=None, **kwargs
    ):
        # Handle either 'anything' or 'passthrough' parameter name
        passthrough_value = kwargs.get("anything", kwargs.get("passthrough", None))

        # First try to use existing metadata if available
        # Or provide empty metadata if none exists

        metadata_exists = False

        # Check if we have real metadata
        if extra_pnginfo is not None:
            try:
                # Try to access workflow nodes - this would fail if metadata is invalid
                if (
                    isinstance(extra_pnginfo, dict)
                    and "workflow" in extra_pnginfo
                    and "nodes" in extra_pnginfo["workflow"]
                ):
                    metadata_exists = True
                    print(
                        f"EmptyMetadataCreator: Using existing metadata with {len(extra_pnginfo['workflow']['nodes'])} nodes"
                    )
            except Exception as e:
                print(
                    f"EmptyMetadataCreator: Existing metadata validation failed: {str(e)}"
                )
                metadata_exists = False

        # If no valid metadata exists, we'll create our own
        if not metadata_exists:
            # Create minimal but valid workflow metadata structure
            empty_metadata = {
                "workflow": {
                    "nodes": [],
                    "links": [],
                    "extra": {},
                }
            }
            return {
                "ui": {},
                "result": (passthrough_value,),
                "extra_pnginfo": empty_metadata,
            }

        # If we got here, we have valid metadata, so just pass it through
        return (passthrough_value,)

    @classmethod
    def VALIDATE_INPUTS(cls, input_types):
        # Accept any input type - this node should handle anything
        return True


NODE_CLASS_MAPPINGS = {
    "ComfyUIDeployDummyPngInfo": ComfyUIDeployDummyPngInfo,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIDeployDummyPngInfo": "Dummy Png Info (ComfyUI Deploy)",
}
