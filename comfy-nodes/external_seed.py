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
                "control": (["Randomize", "Fixed"],),
            },
            "optional": {
                "display_name": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
                "description": (
                    "STRING",
                    {"multiline": True, "default": ""},
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
        control,
        default_value=None,
        **kwargs,
    ):
        """Inform ComfyUI whether the node output should be considered changed.

        If `control` is "Fixed", we return the inputs tuple so the cached result is reused until the user changes something.
        For "Randomize", we force re-execution each queue.
        """
        if control == "Fixed":
            return (input_id, control, default_value)

        # For Randomize we force re-execution each queue
        import random as _rnd

        return _rnd.random()

    def run(
        self,
        input_id,
        min_value: int,
        max_value: int,
        control: str = "Randomize",
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

        # If default_value is within range, switch to Fixed mode
        if default_value >= min_value and default_value <= max_value:
            control = "Fixed"

        # Control logic
        if control == "Fixed":
            seed = int(default_value)
            self._cached_seed = seed
            return [seed]

        # Randomize (default or when default_value is -1)
        seed = random.randint(min_value, max_value)
        self._cached_seed = seed
        return [seed]


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalSeed": ComfyUIDeployExternalSeed}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIDeployExternalSeed": "External Seed (ComfyUI Deploy)"
}
