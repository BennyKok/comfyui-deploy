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
                    {"default": 1},
                ),
                "lower_limit": (
                    "INT",
                    {"default": 1, "min": 1, "max": 999999999999999},
                ),
                "upper_limit": (
                    "INT",
                    {"default": 4294967295, "min": 1, "max": 999999999999999},
                ),
                "is_fixed": ("BOOLEAN", {"default": False}),
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
        lower_limit,
        upper_limit,
        is_fixed,
        default_value=None,
    ):
        """Inform ComfyUI whether the node output should be considered changed.

        If `is_fixed` is False, we always signal that the node changed by returning a
        fresh random value.  This forces ComfyUI to re-execute the node so we get a
        new seed on every graph run.  When `is_fixed` is True we return the inputs
        tuple so the cached result is reused until the user changes something.
        """
        if is_fixed:
            # When fixed, output depends only on default_value
            return (input_id, is_fixed, default_value)

        # Not fixed: force change each time by returning a unique random number
        import random as _rnd

        return _rnd.random()

    def run(
        self,
        input_id,
        lower_limit: int,
        upper_limit: int,
        is_fixed: bool = False,
        display_name=None,
        description=None,
        default_value: int | None = None,
    ):
        # Clamp values to allowed range
        lower_limit = max(1, lower_limit)
        upper_limit = min(self._MAX_LIMIT, upper_limit)

        # Ensure limits are in correct order after clamping
        if lower_limit > upper_limit:
            lower_limit, upper_limit = upper_limit, lower_limit

        if is_fixed:
            # Always use default_value if provided (ignore limits)
            if default_value is None:
                # Fallback to cached or first generation when missing
                if self._cached_seed is not None:
                    return [self._cached_seed]
                default_value = 1
            self._cached_seed = int(default_value)
            return [self._cached_seed]

        # Generate random seed within range (inclusive)
        generated_seed = random.randint(lower_limit, upper_limit)

        return [generated_seed]


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalSeed": ComfyUIDeployExternalSeed}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIDeployExternalSeed": "External Seed (ComfyUI Deploy)"
}
