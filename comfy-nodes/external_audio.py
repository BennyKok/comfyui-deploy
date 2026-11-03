import io
import os
import tempfile
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

    @staticmethod
    def _load_audio_from_bytes(audio_bytes, source_url=""):
        """Load audio from bytes, trying multiple backends for robustness."""
        import torch

        # Detect format from URL or content
        ext = ""
        if source_url:
            lower = source_url.lower().split("?")[0]
            if lower.endswith(".mp3"):
                ext = ".mp3"
            elif lower.endswith(".wav"):
                ext = ".wav"
            elif lower.endswith(".ogg"):
                ext = ".ogg"
            elif lower.endswith(".flac"):
                ext = ".flac"
            elif lower.endswith(".m4a"):
                ext = ".m4a"

        if not ext:
            # Sniff from magic bytes
            header = audio_bytes[:4]
            if header[:3] == b"ID3" or header[:2] == b"\xff\xfb":
                ext = ".mp3"
            elif header[:4] == b"RIFF":
                ext = ".wav"
            elif header[:4] == b"fLaC":
                ext = ".flac"
            elif header[:4] == b"OggS":
                ext = ".ogg"
            else:
                ext = ".wav"  # default

        # Method 1: torchaudio with file on disk (most reliable)
        tmp_path = os.path.join(tempfile.mkdtemp(), f"input_audio{ext}")
        try:
            with open(tmp_path, "wb") as f:
                f.write(audio_bytes)

            import torchaudio
            waveform, sample_rate = torchaudio.load(tmp_path)
            print(f"[ExternalAudio] Loaded via torchaudio from disk: {waveform.shape}, sr={sample_rate}")
            return waveform, sample_rate
        except Exception as e:
            print(f"[ExternalAudio] torchaudio disk load failed: {e}")

        # Method 2: torchaudio from BytesIO with explicit format
        try:
            import torchaudio
            fmt = ext.lstrip(".")
            audio_io = io.BytesIO(audio_bytes)
            waveform, sample_rate = torchaudio.load(audio_io, format=fmt)
            print(f"[ExternalAudio] Loaded via torchaudio BytesIO (format={fmt}): {waveform.shape}, sr={sample_rate}")
            return waveform, sample_rate
        except Exception as e:
            print(f"[ExternalAudio] torchaudio BytesIO load failed: {e}")

        # Method 3: soundfile (handles WAV/FLAC/OGG well)
        try:
            import soundfile as sf
            import numpy as np
            audio_io = io.BytesIO(audio_bytes)
            data, sample_rate = sf.read(audio_io)
            if data.ndim == 1:
                data = data[np.newaxis, :]
            elif data.ndim == 2:
                data = data.T
            waveform = torch.from_numpy(data).float()
            print(f"[ExternalAudio] Loaded via soundfile: {waveform.shape}, sr={sample_rate}")
            return waveform, sample_rate
        except Exception as e:
            print(f"[ExternalAudio] soundfile load failed: {e}")

        # Method 4: ffmpeg subprocess (handles everything)
        try:
            import subprocess
            import numpy as np
            out_path = os.path.join(tempfile.mkdtemp(), "converted.wav")
            subprocess.run(
                ["ffmpeg", "-y", "-i", tmp_path, "-ar", "44100", "-ac", "1", "-f", "wav", out_path],
                capture_output=True, timeout=30
            )
            if os.path.exists(out_path) and os.path.getsize(out_path) > 44:
                import torchaudio
                waveform, sample_rate = torchaudio.load(out_path)
                print(f"[ExternalAudio] Loaded via ffmpeg conversion: {waveform.shape}, sr={sample_rate}")
                return waveform, sample_rate
        except Exception as e:
            print(f"[ExternalAudio] ffmpeg conversion failed: {e}")

        raise RuntimeError(
            f"[ExternalAudio] Failed to load audio with all methods. "
            f"Format detected: {ext}, size: {len(audio_bytes)} bytes"
        )

    def load_audio(
        self,
        input_id,
        audio_file,
        default_value=None,
        display_name=None,
        description=None,
    ):
        if not audio_file or audio_file.strip() == "":
            if default_value is not None:
                return (default_value,)
            raise ValueError(
                f"[ExternalAudio] No audio provided for input '{input_id}' and no default value set."
            )

        try:
            if audio_file.startswith(("http://", "https://")):
                import requests
                print(f"[ExternalAudio] Downloading audio from: {audio_file[:100]}...")
                response = requests.get(audio_file, timeout=60)
                response.raise_for_status()
                audio_bytes = response.content
                print(f"[ExternalAudio] Downloaded {len(audio_bytes)} bytes")

                waveform, sample_rate = self._load_audio_from_bytes(audio_bytes, source_url=audio_file)
            else:
                import torchaudio
                audio_path = get_annotated_filepath(audio_file)
                print(f"[ExternalAudio] Loading local file: {audio_path}")
                waveform, sample_rate = torchaudio.load(audio_path)

            audio = {"waveform": waveform.unsqueeze(0), "sample_rate": sample_rate}
            return (audio,)

        except Exception as e:
            print(f"[ExternalAudio] ERROR loading audio: {e}")
            if default_value is not None:
                print(f"[ExternalAudio] Falling back to default_value")
                return (default_value,)
            raise RuntimeError(
                f"[ExternalAudio] Failed to load audio for input '{input_id}': {e}"
            ) from e


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalAudio": ComfyUIDeployExternalAudio}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIDeployExternalAudio": "External Audio (ComfyUI Deploy)"
}
