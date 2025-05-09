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
                "control": (["Randomize", "Fixed", "Increment", "Decrement"],),
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
        control,
        default_value=None,
    ):
        """Inform ComfyUI whether the node output should be considered changed.

        If `control` is "Fixed", we return the inputs tuple so the cached result is reused until the user changes something.
        For "Randomize", "Increment", "Decrement", we force re-execution each queue.
        """
        if control == "Fixed":
            return (input_id, control, default_value)

        # For Randomize, Increment, Decrement we force re-execution each queue
        import random as _rnd

        return _rnd.random()

    def run(
        self,
        input_id,
        lower_limit: int,
        upper_limit: int,
        control: str = "Randomize",
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

        # Control logic
        if control == "Fixed":
            if default_value is None:
                seed = self._cached_seed if self._cached_seed is not None else 1
            else:
                seed = int(default_value)
            self._cached_seed = seed
            return [seed]

        elif control == "Increment":
            if self._cached_seed is None:
                self._cached_seed = int(
                    default_value if default_value is not None else lower_limit
                )
            else:
                self._cached_seed += 1
            # Clamp to upper_limit
            if self._cached_seed > upper_limit:
                self._cached_seed = upper_limit
            return [self._cached_seed]

        elif control == "Decrement":
            if self._cached_seed is None:
                self._cached_seed = int(
                    default_value if default_value is not None else upper_limit
                )
            else:
                self._cached_seed -= 1
            # Clamp to lower_limit
            if self._cached_seed < lower_limit:
                self._cached_seed = lower_limit
            return [self._cached_seed]

        # Randomize (default)
        seed = random.randint(lower_limit, upper_limit)
        self._cached_seed = seed
        return [seed]


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalSeed": ComfyUIDeployExternalSeed}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIDeployExternalSeed": "External Seed (ComfyUI Deploy)"
}
