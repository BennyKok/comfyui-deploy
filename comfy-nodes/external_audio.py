import os

def get_vhs_load_audio():
    try:
        vhs_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'ComfyUI-VideoHelperSuite'))
        print(vhs_path)
        # Add the VHS directory to sys.path temporarily
        import sys
        sys.path.insert(0, vhs_path)
        
        # Import the module using the package path
        from videohelpersuite.nodes import LoadAudio
        
        # Remove the temporary path
        sys.path.pop(0)
        
        print("LoadAudio from VHS: ", LoadAudio)
        
        return LoadAudio
    except Exception as e:
        print(f"Failed to load VideoHelperSuite LoadAudio: {str(e)}")
        return None

VHSLoadAudio = get_vhs_load_audio()
if VHSLoadAudio:
    class ComfyUIDeployExternalAudio(VHSLoadAudio):
        RETURN_TYPES = ("AUDIO",)
        # RETURN_NAMES = ("audio",)
        
        @classmethod
        def INPUT_TYPES(cls):
            return {
                "required": {
                    "input_id": (
                        "STRING",
                        {"multiline": False, "default": "input_audio"},
                    ),
                    "audio_file": ("STRING", {"default": ""}),
                },
                "optional": {
                    "default_value": ("AUDIO",),
                    "display_name": (
                        "STRING",
                        {"multiline": False, "default": ""},
                    ),
                    "description": (
                        "STRING",
                        {"multiline": False, "default": ""},
                    ),
                }
            }
        
        @classmethod
        def VALIDATE_INPUTS(s, audio_file, **kwargs):
            return True

        def load_audio(self, input_id, audio_file, default_value=None, display_name=None, description=None):
            # Use audio_file for loading audio, ignoring input_id for actual loading
            # , start_time=0.0, duration=0.0
            if audio_file and audio_file != "":
                return super().load_audio(audio_file, seek_seconds=0.0)
            else:
                return (default_value, )
else:
    class ComfyUIDeployExternalAudio:
        @classmethod
        def INPUT_TYPES(cls):
            return {
                "required": {
                    "input_id": (
                        "STRING",
                        {"multiline": False, "default": "input_audio"},
                    ),
                },
                "optional": {
                    "default_value": ("AUDIO",),
                    "display_name": (
                        "STRING",
                        {"multiline": False, "default": ""},
                    ),
                    "description": (
                        "STRING",
                        {"multiline": False, "default": ""},
                    ),
                }
            }
        
        RETURN_TYPES = ("AUDIO",)
        RETURN_NAMES = ("audio",)
        FUNCTION = "load_audio"
            
        def load_audio(self, input_id, default_value=None, display_name=None, description=None):
            raise NotImplementedError("VideoHelperSuite is required for audio loading functionality")

NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalAudio": ComfyUIDeployExternalAudio}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyUIDeployExternalAudio": "External Audio (ComfyUI Deploy)"}
