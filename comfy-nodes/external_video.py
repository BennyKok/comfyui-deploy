# credit goes to https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite
# Intended to work with https://github.com/NicholasKao1029/ComfyUI-VideoHelperSuite/tree/main
import os
import itertools
import numpy as np
import torch
from typing import Union
from torch import Tensor
import cv2
import psutil

from collections.abc import Mapping
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


def is_safe_path(path):
    if "VHS_STRICT_PATHS" not in os.environ:
        return True
    basedir = os.path.abspath(".")
    try:
        common_path = os.path.commonpath([basedir, path])
    except:
        # Different drive on windows
        return False
    return common_path == basedir


def get_sorted_dir_files_from_directory(
    directory: str,
    skip_first_images: int = 0,
    select_every_nth: int = 1,
    extensions: Iterable = None,
):
    directory = strip_path(directory)
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
    args = [ffmpeg_path, "-i", file]
    if start_time > 0:
        args += ["-ss", str(start_time)]
    if duration > 0:
        args += ["-t", str(duration)]
    try:
        # TODO: scan for sample rate and maintain
        res = subprocess.run(
            args + ["-f", "f32le", "-"], capture_output=True, check=True
        )
        audio = torch.frombuffer(bytearray(res.stdout), dtype=torch.float32)
        match = re.search(", (\\d+) Hz, (\\w+), ", res.stderr.decode("utf-8"))
    except subprocess.CalledProcessError as e:
        raise Exception(
            f"VHS failed to extract audio from {file}:\n" + e.stderr.decode("utf-8")
        )
    if match:
        ar = int(match.group(1))
        # NOTE: Just throwing an error for other channel types right now
        # Will deal with issues if they come
        ac = {"mono": 1, "stereo": 2}[match.group(2)]
    else:
        ar = 44100
        ac = 2
    audio = audio.reshape((-1, ac)).transpose(0, 1).unsqueeze(0)
    return {"waveform": audio, "sample_rate": ar}


class LazyAudioMap(Mapping):
    def __init__(self, file, start_time, duration):
        self.file = file
        self.start_time = start_time
        self.duration = duration
        self._dict = None

    def __getitem__(self, key):
        if self._dict is None:
            self._dict = get_audio(self.file, self.start_time, self.duration)
        return self._dict[key]

    def __iter__(self):
        if self._dict is None:
            self._dict = get_audio(self.file, self.start_time, self.duration)
        return iter(self._dict)

    def __len__(self):
        if self._dict is None:
            self._dict = get_audio(self.file, self.start_time, self.duration)
        return len(self._dict)


def lazy_get_audio(file, start_time=0, duration=0):
    return LazyAudioMap(file, start_time, duration)


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


def strip_path(path):
    # This leaves whitespace inside quotes and only a single "
    # thus ' ""test"' -> '"test'
    # consider path.strip(string.whitespace+"\"")
    # or weightier re.fullmatch("[\\s\"]*(.+?)[\\s\"]*", path).group(1)
    path = path.strip()
    if path.startswith('"'):
        path = path[1:]
    if path.endswith('"'):
        path = path[:-1]
    return path


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


def validate_index(
    index: int,
    length: int = 0,
    is_range: bool = False,
    allow_negative=False,
    allow_missing=False,
) -> int:
    # if part of range, do nothing
    if is_range:
        return index
    # otherwise, validate index
    # validate not out of range - only when latent_count is passed in
    if length > 0 and index > length - 1 and not allow_missing:
        raise IndexError(f"Index '{index}' out of range for {length} item(s).")
    # if negative, validate not out of range
    if index < 0:
        if not allow_negative:
            raise IndexError(f"Negative indeces not allowed, but was '{index}'.")
        conv_index = length + index
        if conv_index < 0 and not allow_missing:
            raise IndexError(
                f"Index '{index}', converted to '{conv_index}' out of range for {length} item(s)."
            )
        index = conv_index
    return index


def convert_to_index_int(
    raw_index: str,
    length: int = 0,
    is_range: bool = False,
    allow_negative=False,
    allow_missing=False,
) -> int:
    try:
        return validate_index(
            int(raw_index),
            length=length,
            is_range=is_range,
            allow_negative=allow_negative,
            allow_missing=allow_missing,
        )
    except ValueError as e:
        raise ValueError(f"Index '{raw_index}' must be an integer.", e)


def convert_str_to_indexes(
    indexes_str: str, length: int = 0, allow_missing=False
) -> list[int]:
    if not indexes_str:
        return []
    int_indexes = list(range(0, length))
    allow_negative = length > 0
    chosen_indexes = []
    # parse string - allow positive ints, negative ints, and ranges separated by ':'
    groups = indexes_str.split(",")
    groups = [g.strip() for g in groups]
    for g in groups:
        # parse range of indeces (e.g. 2:16)
        if ":" in g:
            index_range = g.split(":", 2)
            index_range = [r.strip() for r in index_range]

            start_index = index_range[0]
            if len(start_index) > 0:
                start_index = convert_to_index_int(
                    start_index,
                    length=length,
                    is_range=True,
                    allow_negative=allow_negative,
                    allow_missing=allow_missing,
                )
            else:
                start_index = 0
            end_index = index_range[1]
            if len(end_index) > 0:
                end_index = convert_to_index_int(
                    end_index,
                    length=length,
                    is_range=True,
                    allow_negative=allow_negative,
                    allow_missing=allow_missing,
                )
            else:
                end_index = length
            # support step as well, to allow things like reversing, every-other, etc.
            step = 1
            if len(index_range) > 2:
                step = index_range[2]
                if len(step) > 0:
                    step = convert_to_index_int(
                        step,
                        length=length,
                        is_range=True,
                        allow_negative=True,
                        allow_missing=True,
                    )
                else:
                    step = 1
            # if latents were passed in, base indeces on known latent count
            if len(int_indexes) > 0:
                chosen_indexes.extend(int_indexes[start_index:end_index][::step])
            # otherwise, assume indeces are valid
            else:
                chosen_indexes.extend(list(range(start_index, end_index, step)))
        # parse individual indeces
        else:
            chosen_indexes.append(
                convert_to_index_int(
                    g,
                    length=length,
                    allow_negative=allow_negative,
                    allow_missing=allow_missing,
                )
            )
    return chosen_indexes


def select_indexes(input_obj: Union[Tensor, list], idxs: list):
    if type(input_obj) == Tensor:
        return input_obj[idxs]
    else:
        return [input_obj[i] for i in idxs]


def select_indexes_from_str(
    input_obj: Union[Tensor, list], indexes: str, err_if_missing=True, err_if_empty=True
):
    real_idxs = convert_str_to_indexes(
        indexes, len(input_obj), allow_missing=not err_if_missing
    )
    if err_if_empty and len(real_idxs) == 0:
        raise Exception(f"Nothing was selected based on indexes found in '{indexes}'.")
    return select_indexes(input_obj, real_idxs)


###


def cv_frame_generator(
    video,
    force_rate,
    frame_load_cap,
    skip_first_frames,
    select_every_nth,
    meta_batch=None,
    unique_id=None,
):
    video_cap = cv2.VideoCapture(strip_path(video))
    if not video_cap.isOpened():
        raise ValueError(f"{video} could not be loaded with cv.")
    pbar = None

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
    if meta_batch is not None:
        yield min(frame_load_cap, total_frames)

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
        frame = np.array(frame, dtype=np.float32)
        torch.from_numpy(frame).div_(255)
        if prev_frame is not None:
            inp = yield prev_frame
            if inp is not None:
                # ensure the finally block is called
                return
        prev_frame = frame
        frames_added += 1
        if pbar is not None:
            pbar.update_absolute(frames_added, frame_load_cap)
        # if cap exists and we've reached it, stop processing frames
        if frame_load_cap > 0 and frames_added >= frame_load_cap:
            break
    if meta_batch is not None:
        meta_batch.inputs.pop(unique_id)
        meta_batch.has_closed_inputs = True
    if prev_frame is not None:
        yield prev_frame


def batched(it, n):
    while batch := tuple(itertools.islice(it, n)):
        yield batch


def batched_vae_encode(images, vae, frames_per_batch):
    for batch in batched(images, frames_per_batch):
        image_batch = torch.from_numpy(np.array(batch))
        yield from vae.encode(image_batch).numpy()


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
    memory_limit_mb=None,
    vae=None,
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
            meta_batch.total_frames = min(meta_batch.total_frames, next(gen))

    else:
        (gen, width, height, fps, duration, total_frames, target_frame_time) = (
            meta_batch.inputs[unique_id]
        )

    memory_limit = None
    if memory_limit_mb is not None:
        memory_limit *= 2**20
    else:
        # TODO: verify if garbage collection should be performed here.
        # leaves ~128 MB unreserved for safety
        try:
            memory_limit = (
                psutil.virtual_memory().available + psutil.swap_memory().free
            ) - 2**27
        except:
            print(
                "Failed to calculate available memory. Memory load limit has been disabled"
            )
    if memory_limit is not None:
        if vae is not None:
            # space required to load as f32, exist as latent with wiggle room, decode to f32
            max_loadable_frames = int(
                memory_limit // (width * height * 3 * (4 + 4 + 1 / 10))
            )
        else:
            # TODO: use better estimate for when vae is not None
            # Consider completely ignoring for load_latent case?
            max_loadable_frames = int(memory_limit // (width * height * 3 * (0.1)))
        if meta_batch is not None:
            if meta_batch.frames_per_batch > max_loadable_frames:
                raise RuntimeError(
                    f"Meta Batch set to {meta_batch.frames_per_batch} frames but only {max_loadable_frames} can fit in memory"
                )
            gen = itertools.islice(gen, meta_batch.frames_per_batch)
        else:
            original_gen = gen
            gen = itertools.islice(gen, max_loadable_frames)
    downscale_ratio = getattr(vae, "downscale_ratio", 8)
    frames_per_batch = (1920 * 1080 * 16) // (width * height) or 1
    if force_size != "Disabled" or vae is not None:
        new_size = target_size(
            width, height, force_size, custom_width, custom_height, downscale_ratio
        )
        if new_size[0] != width or new_size[1] != height:

            def rescale(frame):
                s = torch.from_numpy(
                    np.fromiter(frame, np.dtype((np.float32, (height, width, 3))))
                )
                s = s.movedim(-1, 1)
                s = common_upscale(s, new_size[0], new_size[1], "lanczos", "center")
                return s.movedim(1, -1).numpy()

            gen = itertools.chain.from_iterable(
                map(rescale, batched(gen, frames_per_batch))
            )
    else:
        new_size = width, height
    if vae is not None:
        gen = batched_vae_encode(gen, vae, frames_per_batch)
        vw, vh = new_size[0] // downscale_ratio, new_size[1] // downscale_ratio
        images = torch.from_numpy(np.fromiter(gen, np.dtype((np.float32, (4, vh, vw)))))
    else:
        # Some minor wizardry to eliminate a copy and reduce max memory by a factor of ~2
        images = torch.from_numpy(
            np.fromiter(gen, np.dtype((np.float32, (new_size[1], new_size[0], 3))))
        )
    if meta_batch is None and memory_limit is not None:
        try:
            next(original_gen)
            raise RuntimeError(
                f"Memory limit hit after loading {len(images)} frames. Stopping execution."
            )
        except StopIteration:
            pass
    if len(images) == 0:
        raise RuntimeError("No frames generated")

    # Setup lambda for lazy audio capture
    audio = lazy_get_audio(
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
        "loaded_width": new_size[0],
        "loaded_height": new_size[1],
    }
    if vae is None:
        return (images, len(images), audio, video_info, None)
    else:
        return (None, len(images), audio, video_info, {"samples": images})


# modeled after Video upload node
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
                "vae": ("VAE",),
                "default_video": (sorted(files),),
                "display_name": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
                "description": (
                    "STRING",
                    {"multiline": True, "default": ""},
                ),
                "default_value_url": ("STRING", {"image_preview": True, "default": ""}),
            },
            "hidden": {"unique_id": "UNIQUE_ID"},
        }

    CATEGORY = "Video Helper Suite 🎥🅥🅗🅢"

    RETURN_TYPES = ("IMAGE", "INT", "AUDIO", "VHS_VIDEOINFO", "LATENT")
    RETURN_NAMES = (
        "IMAGE",
        "frame_count",
        "audio",
        "video_info",
        "LATENT",
    )

    FUNCTION = "load_video"
    CATEGORY = "🔗ComfyDeploy"

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
        default_value_url = kwargs.get("default_value_url")

        input_dir = folder_paths.get_input_directory()
        if input_id.startswith("http") or (
            default_value_url and default_value_url.startswith("http")
        ):
            import requests

            # Use input_id if it's a URL, otherwise use default_value_url
            url = input_id if input_id.startswith("http") else default_value_url

            print("Fetching video from URL: ", url)
            response = requests.get(url, stream=True)
            file_size = int(response.headers.get("Content-Length", 0))
            file_extension = url.split(".")[-1].split("?")[
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
        else:
            video = kwargs.get("default_video", None)
            if video is None:
                raise "No default video given and no external video provided"
            video_path = folder_paths.get_annotated_filepath(video.strip('"'))

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
