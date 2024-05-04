# credit goes to https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite and is meant to work with
import os
import itertools
import numpy as np
import torch
import cv2

import folder_paths
from comfy.utils import common_upscale

### Utils
import hashlib
from typing import Iterable
import shutil
import subprocess
import re
import uuid

import server
from tqdm import tqdm

BIGMIN = -(2**53 - 1)
BIGMAX = 2**53 - 1

DIMMAX = 8192


def ffmpeg_suitability(path):
    try:
        version = subprocess.run(
            [path, "-version"], check=True, capture_output=True
        ).stdout.decode("utf-8")
    except:
        return 0
    score = 0
    # rough layout of the importance of various features
    simple_criterion = [
        ("libvpx", 20),
        ("264", 10),
        ("265", 3),
        ("svtav1", 5),
        ("libopus", 1),
    ]
    for criterion in simple_criterion:
        if version.find(criterion[0]) >= 0:
            score += criterion[1]
    # obtain rough compile year from copyright information
    copyright_index = version.find("2000-2")
    if copyright_index >= 0:
        copyright_year = version[copyright_index + 6 : copyright_index + 9]
        if copyright_year.isnumeric():
            score += int(copyright_year)
    return score


if "VHS_FORCE_FFMPEG_PATH" in os.environ:
    ffmpeg_path = os.environ.get("VHS_FORCE_FFMPEG_PATH")
else:
    ffmpeg_paths = []
    try:
        from imageio_ffmpeg import get_ffmpeg_exe

        imageio_ffmpeg_path = get_ffmpeg_exe()
        ffmpeg_paths.append(imageio_ffmpeg_path)
    except:
        if "VHS_USE_IMAGEIO_FFMPEG" in os.environ:
            raise
    if "VHS_USE_IMAGEIO_FFMPEG" in os.environ:
        ffmpeg_path = imageio_ffmpeg_path
    else:
        system_ffmpeg = shutil.which("ffmpeg")
        if system_ffmpeg is not None:
            ffmpeg_paths.append(system_ffmpeg)
        if os.path.isfile("ffmpeg"):
            ffmpeg_paths.append(os.path.abspath("ffmpeg"))
        if os.path.isfile("ffmpeg.exe"):
            ffmpeg_paths.append(os.path.abspath("ffmpeg.exe"))
        if len(ffmpeg_paths) == 0:
            ffmpeg_path = None
        elif len(ffmpeg_paths) == 1:
            # Evaluation of suitability isn't required, can take sole option
            # to reduce startup time
            ffmpeg_path = ffmpeg_paths[0]
        else:
            ffmpeg_path = max(ffmpeg_paths, key=ffmpeg_suitability)
gifski_path = os.environ.get("VHS_GIFSKI", None)
if gifski_path is None:
    gifski_path = os.environ.get("JOV_GIFSKI", None)
    if gifski_path is None:
        gifski_path = shutil.which("gifski")


def get_sorted_dir_files_from_directory(
    directory: str,
    skip_first_images: int = 0,
    select_every_nth: int = 1,
    extensions: Iterable = None,
):
    directory = directory.strip()
    dir_files = os.listdir(directory)
    dir_files = sorted(dir_files)
    dir_files = [os.path.join(directory, x) for x in dir_files]
    dir_files = list(filter(lambda filepath: os.path.isfile(filepath), dir_files))
    # filter by extension, if needed
    if extensions is not None:
        extensions = list(extensions)
        new_dir_files = []
        for filepath in dir_files:
            ext = "." + filepath.split(".")[-1]
            if ext.lower() in extensions:
                new_dir_files.append(filepath)
        dir_files = new_dir_files
    # start at skip_first_images
    dir_files = dir_files[skip_first_images:]
    dir_files = dir_files[0::select_every_nth]
    return dir_files


# modified from https://stackoverflow.com/questions/22058048/hashing-a-file-in-python
def calculate_file_hash(filename: str, hash_every_n: int = 1):
    # Larger video files were taking >.5 seconds to hash even when cached,
    # so instead the modified time from the filesystem is used as a hash
    h = hashlib.sha256()
    h.update(filename.encode())
    h.update(str(os.path.getmtime(filename)).encode())
    return h.hexdigest()


prompt_queue = server.PromptServer.instance.prompt_queue


def requeue_workflow_unchecked():
    """Requeues the current workflow without checking for multiple requeues"""
    currently_running = prompt_queue.currently_running
    (_, _, prompt, extra_data, outputs_to_execute) = next(
        iter(currently_running.values())
    )

    # Ensure batch_managers are marked stale
    prompt = prompt.copy()
    for uid in prompt:
        if prompt[uid]["class_type"] == "VHS_BatchManager":
            prompt[uid]["inputs"]["requeue"] = (
                prompt[uid]["inputs"].get("requeue", 0) + 1
            )

    # execution.py has guards for concurrency, but server doesn't.
    # TODO: Check that this won't be an issue
    number = -server.PromptServer.instance.number
    server.PromptServer.instance.number += 1
    prompt_id = str(server.uuid.uuid4())
    prompt_queue.put((number, prompt_id, prompt, extra_data, outputs_to_execute))


requeue_guard = [None, 0, 0, {}]


def requeue_workflow(requeue_required=(-1, True)):
    assert len(prompt_queue.currently_running) == 1
    global requeue_guard
    (run_number, _, prompt, _, _) = next(iter(prompt_queue.currently_running.values()))
    if requeue_guard[0] != run_number:
        # Calculate a count of how many outputs are managed by a batch manager
        managed_outputs = 0
        for bm_uid in prompt:
            if prompt[bm_uid]["class_type"] == "VHS_BatchManager":
                for output_uid in prompt:
                    if prompt[output_uid]["class_type"] in ["VHS_VideoCombine"]:
                        for inp in prompt[output_uid]["inputs"].values():
                            if inp == [bm_uid, 0]:
                                managed_outputs += 1
        requeue_guard = [run_number, 0, managed_outputs, {}]
    requeue_guard[1] = requeue_guard[1] + 1
    requeue_guard[3][requeue_required[0]] = requeue_required[1]
    if requeue_guard[1] == requeue_guard[2] and max(requeue_guard[3].values()):
        requeue_workflow_unchecked()


def get_audio(file, start_time=0, duration=0):
    args = [ffmpeg_path, "-v", "error", "-i", file]
    if start_time > 0:
        args += ["-ss", str(start_time)]
    if duration > 0:
        args += ["-t", str(duration)]
    try:
        res = subprocess.run(
            args + ["-f", "wav", "-"], stdout=subprocess.PIPE, check=True
        ).stdout
    except subprocess.CalledProcessError as e:
        return False
    return res


def lazy_eval(func):
    class Cache:
        def __init__(self, func):
            self.res = None
            self.func = func

        def get(self):
            if self.res is None:
                self.res = self.func()
            return self.res

    cache = Cache(func)
    return lambda: cache.get()


def is_url(url):
    return url.split("://")[0] in ["http", "https"]


def validate_sequence(path):
    # Check if path is a valid ffmpeg sequence that points to at least one file
    (path, file) = os.path.split(path)
    if not os.path.isdir(path):
        return False
    match = re.search("%0?\d+d", file)
    if not match:
        return False
    seq = match.group()
    if seq == "%d":
        seq = "\\\\d+"
    else:
        seq = "\\\\d{%s}" % seq[1:-1]
    file_matcher = re.compile(re.sub("%0?\d+d", seq, file))
    for file in os.listdir(path):
        if file_matcher.fullmatch(file):
            return True
    return False


def hash_path(path):
    if path is None:
        return "input"
    if is_url(path):
        return "url"
    return calculate_file_hash(path.strip('"'))


def validate_path(path, allow_none=False, allow_url=True):
    if path is None:
        return allow_none
    if is_url(path):
        # Probably not feasible to check if url resolves here
        return True if allow_url else "URLs are unsupported for this path"
    if not os.path.isfile(path.strip('"')):
        return "Invalid file path: {}".format(path)
    return True


### Utils

video_extensions = ["webm", "mp4", "mkv", "gif"]


def is_gif(filename) -> bool:
    file_parts = filename.split(".")
    return len(file_parts) > 1 and file_parts[-1] == "gif"


def target_size(
    width, height, force_size, custom_width, custom_height
) -> tuple[int, int]:
    if force_size == "Custom":
        return (custom_width, custom_height)
    elif force_size == "Custom Height":
        force_size = "?x" + str(custom_height)
    elif force_size == "Custom Width":
        force_size = str(custom_width) + "x?"

    if force_size != "Disabled":
        force_size = force_size.split("x")
        if force_size[0] == "?":
            width = (width * int(force_size[1])) // height
            # Limit to a multple of 8 for latent conversion
            width = int(width) + 4 & ~7
            height = int(force_size[1])
        elif force_size[1] == "?":
            height = (height * int(force_size[0])) // width
            height = int(height) + 4 & ~7
            width = int(force_size[0])
        else:
            width = int(force_size[0])
            height = int(force_size[1])
    return (width, height)


def cv_frame_generator(
    video,
    force_rate,
    frame_load_cap,
    skip_first_frames,
    select_every_nth,
    meta_batch=None,
    unique_id=None,
):
    video_cap = cv2.VideoCapture(video)
    if not video_cap.isOpened():
        raise ValueError(f"{video} could not be loaded with cv.")

    # extract video metadata
    fps = video_cap.get(cv2.CAP_PROP_FPS)
    width = int(video_cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(video_cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(video_cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps

    # set video_cap to look at start_index frame
    total_frame_count = 0
    total_frames_evaluated = -1
    frames_added = 0
    base_frame_time = 1 / fps
    prev_frame = None

    if force_rate == 0:
        target_frame_time = base_frame_time
    else:
        target_frame_time = 1 / force_rate

    yield (width, height, fps, duration, total_frames, target_frame_time)

    time_offset = target_frame_time - base_frame_time
    while video_cap.isOpened():
        if time_offset < target_frame_time:
            is_returned = video_cap.grab()
            # if didn't return frame, video has ended
            if not is_returned:
                break
            time_offset += base_frame_time
        if time_offset < target_frame_time:
            continue
        time_offset -= target_frame_time
        # if not at start_index, skip doing anything with frame
        total_frame_count += 1
        if total_frame_count <= skip_first_frames:
            continue
        else:
            total_frames_evaluated += 1

        # if should not be selected, skip doing anything with frame
        if total_frames_evaluated % select_every_nth != 0:
            continue

        # opencv loads images in BGR format (yuck), so need to convert to RGB for ComfyUI use
        # follow up: can videos ever have an alpha channel?
        # To my testing: No. opencv has no support for alpha
        unused, frame = video_cap.retrieve()
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        # convert frame to comfyui's expected format
        # TODO: frame contains no exif information. Check if opencv2 has already applied
        frame = np.array(frame, dtype=np.float32) / 255.0
        if prev_frame is not None:
            inp = yield prev_frame
            if inp is not None:
                # ensure the finally block is called
                return
        prev_frame = frame
        frames_added += 1
        # if cap exists and we've reached it, stop processing frames
        if frame_load_cap > 0 and frames_added >= frame_load_cap:
            break
    if meta_batch is not None:
        meta_batch.inputs.pop(unique_id)
        meta_batch.has_closed_inputs = True
    if prev_frame is not None:
        yield prev_frame


def load_video_cv(
    video: str,
    force_rate: int,
    force_size: str,
    custom_width: int,
    custom_height: int,
    frame_load_cap: int,
    skip_first_frames: int,
    select_every_nth: int,
    meta_batch=None,
    unique_id=None,
):
    if meta_batch is None or unique_id not in meta_batch.inputs:
        gen = cv_frame_generator(
            video,
            force_rate,
            frame_load_cap,
            skip_first_frames,
            select_every_nth,
            meta_batch,
            unique_id,
        )
        (width, height, fps, duration, total_frames, target_frame_time) = next(gen)

        if meta_batch is not None:
            meta_batch.inputs[unique_id] = (
                gen,
                width,
                height,
                fps,
                duration,
                total_frames,
                target_frame_time,
            )

    else:
        (gen, width, height, fps, duration, total_frames, target_frame_time) = (
            meta_batch.inputs[unique_id]
        )

    if meta_batch is not None:
        gen = itertools.islice(gen, meta_batch.frames_per_batch)

    # Some minor wizardry to eliminate a copy and reduce max memory by a factor of ~2
    images = torch.from_numpy(
        np.fromiter(gen, np.dtype((np.float32, (height, width, 3))))
    )
    if len(images) == 0:
        raise RuntimeError("No frames generated")
    if force_size != "Disabled":
        new_size = target_size(width, height, force_size, custom_width, custom_height)
        if new_size[0] != width or new_size[1] != height:
            s = images.movedim(-1, 1)
            s = common_upscale(s, new_size[0], new_size[1], "lanczos", "center")
            images = s.movedim(1, -1)

    # Setup lambda for lazy audio capture
    audio = lambda: get_audio(
        video,
        skip_first_frames * target_frame_time,
        frame_load_cap * target_frame_time * select_every_nth,
    )
    # Adjust target_frame_time for select_every_nth
    target_frame_time *= select_every_nth
    video_info = {
        "source_fps": fps,
        "source_frame_count": total_frames,
        "source_duration": duration,
        "source_width": width,
        "source_height": height,
        "loaded_fps": 1 / target_frame_time,
        "loaded_frame_count": len(images),
        "loaded_duration": len(images) * target_frame_time,
        "loaded_width": images.shape[2],
        "loaded_height": images.shape[1],
    }

    return (images, len(images), lazy_eval(audio), video_info)


class ComfyUIDeployExternalVideo:
    @classmethod
    def INPUT_TYPES(s):
        input_dir = folder_paths.get_input_directory()
        files = []
        for f in os.listdir(input_dir):
            if os.path.isfile(os.path.join(input_dir, f)):
                file_parts = f.split(".")
                if len(file_parts) > 1 and (file_parts[-1] in video_extensions):
                    files.append(f)
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_video"},
                ),
                "force_rate": ("INT", {"default": 0, "min": 0, "max": 60, "step": 1}),
                "force_size": (
                    [
                        "Disabled",
                        "Custom Height",
                        "Custom Width",
                        "Custom",
                        "256x?",
                        "?x256",
                        "256x256",
                        "512x?",
                        "?x512",
                        "512x512",
                    ],
                ),
                "custom_width": (
                    "INT",
                    {"default": 512, "min": 0, "max": DIMMAX, "step": 8},
                ),
                "custom_height": (
                    "INT",
                    {"default": 512, "min": 0, "max": DIMMAX, "step": 8},
                ),
                "frame_load_cap": (
                    "INT",
                    {"default": 0, "min": 0, "max": BIGMAX, "step": 1},
                ),
                "skip_first_frames": (
                    "INT",
                    {"default": 0, "min": 0, "max": BIGMAX, "step": 1},
                ),
                "select_every_nth": (
                    "INT",
                    {"default": 1, "min": 1, "max": BIGMAX, "step": 1},
                ),
            },
            "optional": {
                "meta_batch": ("VHS_BatchManager",),
                "default_value": (sorted(files),),
            },
            "hidden": {"unique_id": "UNIQUE_ID"},
        }

    CATEGORY = "Video Helper Suite 🎥🅥🅗🅢"

    RETURN_TYPES = (
        "IMAGE",
        "INT",
        "VHS_AUDIO",
        "VHS_VIDEOINFO",
    )
    RETURN_NAMES = (
        "IMAGE",
        "frame_count",
        "audio",
        "video_info",
    )

    FUNCTION = "load_video"

    def load_video(self, **kwargs):
        input_id = kwargs.get("input_id")
        force_rate = kwargs.get("force_rate")
        force_size = kwargs.get("force_size", "Disabled")
        custom_width = kwargs.get("custom_width")
        custom_height = kwargs.get("custom_height")
        frame_load_cap = kwargs.get("frame_load_cap")
        skip_first_frames = kwargs.get("skip_first_frames")
        select_every_nth = kwargs.get("select_every_nth")
        meta_batch = kwargs.get("meta_batch")
        unique_id = kwargs.get("unique_id")

        video = kwargs.get("default_value")
        video_path = folder_paths.get_annotated_filepath(video.strip('"'))

        input_dir = folder_paths.get_input_directory()
        if input_id.startswith("http"):
            import requests

            print("Fetching video from URL: ", input_id)
            response = requests.get(input_id, stream=True)
            file_size = int(response.headers.get("Content-Length", 0))
            file_extension = input_id.split(".")[-1].split("?")[
                0
            ]  # Extract extension and handle URLs with parameters
            if file_extension not in video_extensions:
                file_extension = ".mp4"

            unique_filename = str(uuid.uuid4()) + "." + file_extension
            video_path = os.path.join(input_dir, unique_filename)
            chunk_size = 1024  # 1 Kibibyte

            num_bars = int(file_size / chunk_size)

            with open(video_path, "wb") as out_file:
                for chunk in tqdm(
                    response.iter_content(chunk_size=chunk_size),
                    total=num_bars,
                    unit="KB",
                    desc="Downloading",
                    leave=True,
                ):
                    out_file.write(chunk)

        print("video path: ", video_path)

        return load_video_cv(
            video=video_path,
            force_rate=force_rate,
            force_size=force_size,
            custom_width=custom_width,
            custom_height=custom_height,
            frame_load_cap=frame_load_cap,
            skip_first_frames=skip_first_frames,
            select_every_nth=select_every_nth,
            meta_batch=meta_batch,
            unique_id=unique_id,
        )

    @classmethod
    def IS_CHANGED(s, video, **kwargs):
        image_path = folder_paths.get_annotated_filepath(video)
        return calculate_file_hash(image_path)


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalVideo": ComfyUIDeployExternalVideo}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIDeployExternalVideo": "External Video (ComfyUI Deploy x VHS)"
}
