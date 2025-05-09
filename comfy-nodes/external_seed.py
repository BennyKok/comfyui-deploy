import random


class ComfyUIDeployExternalSeed:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_seed"},
                ),
                "default_value": (
                    "INT",
                    {"default": -1},
                ),
                "min_value": (
                    "INT",
                    {"default": 1, "min": 1, "max": 999999999999999},
                ),
                "max_value": (
                    "INT",
                    {"default": 4294967295, "min": 1, "max": 999999999999999},
                ),
            },
            "optional": {
                "display_name": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
                "description": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": 'For default value:\n"-1" (i.e. not in range): Randomize within the min and max value range. \nin range: Fixed, always the same value\n',
                    },
                ),
            },
        }

    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("seed",)
    FUNCTION = "run"
    CATEGORY = "🔗ComfyDeploy"

    # Limits
    _MAX_LIMIT = 999_999_999_999_999  # 15 digits

    # Store cached seed when fixed flag is enabled
    _cached_seed = None

    @classmethod
    def IS_CHANGED(
        cls,
        input_id,
        min_value,
        max_value,
        default_value=None,
        **kwargs,
    ):
        """Inform ComfyUI whether the node output should be considered changed.

        If default_value is within range (Fixed mode), we return the inputs tuple
        so the cached result is reused until the user changes something.
        For Randomize mode, we force re-execution each queue.
        """
        # Clamp values to allowed range for check
        min_value = max(1, min_value)
        max_value = min(cls._MAX_LIMIT, max_value)

        # Fixed mode when default_value is within range
        if (
            default_value is not None
            and default_value >= min_value
            and default_value <= max_value
        ):
            return (input_id, default_value)

        # For Randomize (default_value is -1 or out of range) we force re-execution
        import random as _rnd

        return _rnd.random()

    def run(
        self,
        input_id,
        min_value: int,
        max_value: int,
        display_name=None,
        description=None,
        default_value: int = -1,
    ):
        # Clamp values to allowed range
        min_value = max(1, min_value)
        max_value = min(self._MAX_LIMIT, max_value)

        # Ensure limits are in correct order after clamping
        if min_value > max_value:
            min_value, max_value = max_value, min_value

        # Fixed mode: default_value is within range
        if default_value >= min_value and default_value <= max_value:
            seed = int(default_value)
            self._cached_seed = seed
            return [seed]

        # Randomize mode: default_value is -1 or out of range
        seed = random.randint(min_value, max_value)
        self._cached_seed = seed
        return [seed]


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalSeed": ComfyUIDeployExternalSeed}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIDeployExternalSeed": "External Seed (ComfyUI Deploy)"
}
