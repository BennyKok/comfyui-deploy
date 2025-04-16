"""
@author: BennyKok
@title: comfyui-deploy
@nickname: Comfy Deploy
@description:
"""

import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__)))

import inspect
import sys
import importlib
import subprocess
import requests
import folder_paths
from folder_paths import add_model_folder_path, get_filename_list, get_folder_paths
from tqdm import tqdm
import re

from . import custom_routes
# import routes

ag_path = os.path.join(os.path.dirname(__file__))


def get_python_files(path):
    return [f[:-3] for f in os.listdir(path) if f.endswith(".py")]


def append_to_sys_path(path):
    if path not in sys.path:
        sys.path.append(path)


paths = ["comfy-nodes"]
files = []

for path in paths:
    full_path = os.path.join(ag_path, path)
    append_to_sys_path(full_path)
    files.extend(get_python_files(full_path))

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}


def split_camel_case(name):
    # Split on underscores first, then split each part on camelCase
    parts = []
    for part in name.split("_"):
        # Find all camelCase boundaries
        words = re.findall("[A-Z][^A-Z]*", part)
        if not words:  # If no camelCase found, use the whole part
            words = [part]
        parts.extend(words)
    return parts


# Import all the modules and append their mappings
for file in files:
    module = importlib.import_module(file)

    # Check if the module has explicit mappings
    if hasattr(module, "NODE_CLASS_MAPPINGS"):
        NODE_CLASS_MAPPINGS.update(module.NODE_CLASS_MAPPINGS)
    if hasattr(module, "NODE_DISPLAY_NAME_MAPPINGS"):
        NODE_DISPLAY_NAME_MAPPINGS.update(module.NODE_DISPLAY_NAME_MAPPINGS)

    # Auto-discover classes with ComfyUI node attributes
    for name, obj in inspect.getmembers(module):
        # Check if it's a class and has the required ComfyUI node attributes
        if (
            inspect.isclass(obj)
            and hasattr(obj, "INPUT_TYPES")
            and hasattr(obj, "RETURN_TYPES")
        ):
            # Use the class name as the key if not already in mappings
            if name not in NODE_CLASS_MAPPINGS:
                NODE_CLASS_MAPPINGS[name] = obj
                # Create a display name by converting camelCase to Title Case with spaces
                words = split_camel_case(name.replace("ComfyUIDeploy", ""))
                display_name = " ".join(word.capitalize() for word in words)
                # print(display_name, name)
                NODE_DISPLAY_NAME_MAPPINGS[name] = display_name

WEB_DIRECTORY = "web-plugin"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
