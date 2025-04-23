import io
from folder_paths import get_annotated_filepath


class ComfyUIDeployExternalAudio:
    RETURN_TYPES = ("AUDIO",)
    RETURN_NAMES = ("audio",)
    FUNCTION = "load_audio"
    CATEGORY = "🔗ComfyDeploy"

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
            },
        }

    @classmethod
    def VALIDATE_INPUTS(s, audio_file, **kwargs):
        return True

    def load_audio(
        self,
        input_id,
        audio_file,
        default_value=None,
        display_name=None,
        description=None,
    ):
        try:
            import torchaudio

            if audio_file and audio_file != "":
                if audio_file.startswith(("http://", "https://")):
                    # Handle URL input
                    try:
                        import requests

                        response = requests.get(audio_file)
                        audio_data = io.BytesIO(response.content)
                        waveform, sample_rate = torchaudio.load(audio_data)
                    except Exception as e:
                        print(f"Error loading audio from URL: {e}")
                        return (default_value,)
                else:
                    # Handle local file
                    try:
                        audio_path = get_annotated_filepath(audio_file)
                        waveform, sample_rate = torchaudio.load(audio_path)
                    except Exception as e:
                        print(f"Error loading local audio file: {e}")
                        return (default_value,)

                audio = {"waveform": waveform.unsqueeze(0), "sample_rate": sample_rate}
                return (audio,)
            else:
                return (default_value,)
        except ImportError as e:
            print(f"Error: torchaudio not installed or cannot be imported: {e}")
            return (default_value,)


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalAudio": ComfyUIDeployExternalAudio}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIDeployExternalAudio": "External Audio (ComfyUI Deploy)"
}
