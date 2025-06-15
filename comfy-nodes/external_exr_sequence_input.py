import os
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
import cv2 as cv
import numpy as np
import torch
import re
from folder_paths import get_annotated_filepath

def linear_to_srgb(np_array):
    """Converts a linear RGB numpy array to sRGB."""
    less = np_array <= 0.0031308
    np_array[less] = np_array[less] * 12.92
    np_array[~less] = np.power(np_array[~less], 1/2.4) * 1.055 - 0.055
    return np_array

class ExternalExrSequenceInput:
    """
    Node to load a sequence of EXR images from a local filepath pattern, a directory,
    or a single file within a sequence.
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "path_or_pattern": ("STRING", {"default": "path/to/frames_or_pattern"}),
                "tonemap": (["linear", "sRGB", "Reinhard"], {"default": "sRGB"}),
                "start_frame": ("INT", {"default": 1, "min": 1}),
                "end_frame": ("INT", {"default": 50, "min": 1}),
            },
            "optional": {
                "default_image": ("IMAGE",),
                "default_mask": ("MASK",),
            }
        }

    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image", "mask",)
    FUNCTION = "run"
    CATEGORY = "🔗ComfyDeploy/EXR"

    def get_image_paths(self, path_input, start_frame, end_frame):
        image_paths = []
        
        # Case 1: Input is a C-style pattern
        if '%' in path_input:
            print(f"Pattern detected: {path_input}")
            for i in range(start_frame, end_frame + 1):
                fpath = get_annotated_filepath(path_input % i)
                if os.path.exists(fpath):
                    image_paths.append(fpath)
            return image_paths

        annotated_path = get_annotated_filepath(path_input)
        
        # Case 2: Input is a directory
        if os.path.isdir(annotated_path):
            print(f"Directory detected: {annotated_path}")
            files_in_dir = sorted(os.listdir(annotated_path))
            for filename in files_in_dir:
                if not filename.lower().endswith('.exr'):
                    continue
                
                matches = re.findall(r'\d+', filename)
                if not matches:
                    continue
                
                frame_number = int(matches[-1])
                if start_frame <= frame_number <= end_frame:
                    image_paths.append(os.path.join(annotated_path, filename))
            return image_paths
            
        # Case 3: Input is a single file from a sequence
        if os.path.isfile(annotated_path):
            print(f"Single file detected: {annotated_path}. Attempting to find sequence.")
            base_dir = os.path.dirname(annotated_path)
            filename = os.path.basename(annotated_path)

            matches = list(re.finditer(r'(\d+)', filename))
            if not matches: # It's a single file with no frame number
                return [annotated_path]

            last_match = matches[-1]
            num_start_pos, num_end_pos = last_match.span()
            prefix = filename[:num_start_pos]
            suffix = filename[num_end_pos:]
            padding = len(last_match.group(0))

            for i in range(start_frame, end_frame + 1):
                potential_filename = f"{prefix}{str(i).zfill(padding)}{suffix}"
                potential_path = os.path.join(base_dir, potential_filename)
                if os.path.exists(potential_path):
                    image_paths.append(potential_path)
            return image_paths

        return [] # Return empty if no cases match

    def run(self, path_or_pattern, tonemap, start_frame, end_frame, default_image=None, default_mask=None):
        try:
            image_paths = self.get_image_paths(path_or_pattern, start_frame, end_frame)
            if not image_paths:
                raise ValueError(f"No EXR files found for '{path_or_pattern}' between frames {start_frame}-{end_frame}.")

            print(f"Found {len(image_paths)} EXR files to load.")
            rgb_frames = []
            mask_frames = []
            
            for path in image_paths:
                image = cv.imread(path, cv.IMREAD_UNCHANGED)
                if image is None:
                    print(f"Warning: Could not read file {path}, skipping.")
                    continue
                
                image = image.astype(np.float32)
                if len(image.shape) == 2:
                    image = np.repeat(image[..., np.newaxis], 3, axis=2)
                
                rgb = np.flip(image[:, :, :3], 2).copy()
                
                if tonemap == "sRGB":
                    rgb = linear_to_srgb(rgb)
                    rgb = np.clip(rgb, 0, 1)
                elif tonemap == "Reinhard":
                    rgb = np.clip(rgb, 0, None)
                    rgb = rgb / (rgb + 1)
                    rgb = linear_to_srgb(rgb)
                    rgb = np.clip(rgb, 0, 1)
                
                rgb_frames.append(torch.from_numpy(rgb))
                
                if image.shape[2] > 3:
                    mask = np.clip(image[:, :, 3], 0, 1)
                else:
                    mask = np.ones_like(rgb[:, :, 0])
                mask_frames.append(torch.from_numpy(mask))

            if not rgb_frames:
                raise ValueError("No frames were loaded successfully.")

            print(f"Successfully loaded {len(rgb_frames)} frames into a batch.")
            return (torch.stack(rgb_frames, 0), torch.stack(mask_frames, 0))

        except Exception as e:
            print(f"Error loading EXR sequence: {e}")
            if default_image is not None and default_mask is not None:
                print("Returning default image.")
                return (default_image, default_mask)

            print("Warning: Error loading sequence and no default image. Returning a black image.")
            blank_image = torch.zeros((1, 64, 64, 3), dtype=torch.float32)
            blank_mask = torch.zeros((1, 64, 64), dtype=torch.float32)
            return (blank_image, blank_mask)

NODE_CLASS_MAPPINGS = {
    "ExternalExrSequenceInput": ExternalExrSequenceInput
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ExternalExrSequenceInput": "External EXR Sequence Input (ComfyDeploy)"
} 