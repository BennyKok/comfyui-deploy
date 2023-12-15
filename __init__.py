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

# Import all the modules and append their mappings
for file in files:
    module = importlib.import_module(file)

    if hasattr(module, "NODE_CLASS_MAPPINGS"):
        NODE_CLASS_MAPPINGS.update(module.NODE_CLASS_MAPPINGS)
    if hasattr(module, "NODE_DISPLAY_NAME_MAPPINGS"):
        NODE_DISPLAY_NAME_MAPPINGS.update(module.NODE_DISPLAY_NAME_MAPPINGS)

WEB_DIRECTORY = "web-plugin"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
