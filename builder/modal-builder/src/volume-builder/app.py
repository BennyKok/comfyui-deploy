import modal
from config import config
import os
import uuid
import subprocess

stub = modal.Stub()

base_path = "/volumes"

# Volume names may only contain alphanumeric characters, dashes, periods, and underscores, and must be less than 64 characters in length.
def is_valid_name(name: str) -> bool:
    allowed_characters = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._")
    return 0 < len(name) <= 64 and all(char in allowed_characters for char in name)

def create_volumes(volume_names):
    path_to_vol = {}
    vol_to_path = {}
    for volume_name in volume_names.keys():
        if not is_valid_name(volume_name):
            pass
        modal_volume = modal.Volume.persisted(volume_name)
        volume_path = create_volume_path(base_path)
        path_to_vol[volume_path] = modal_volume
        vol_to_path[volume_name] = volume_path
 
    return (path_to_vol, vol_to_path)

def create_volume_path(base_path: str):
    random_path = str(uuid.uuid4())
    return os.path.join(base_path, random_path)

vol_name_to_links = config["volume_names"]
(path_to_vol, vol_name_to_path) = create_volumes(vol_name_to_links)
image = ( 
   modal.Image.debian_slim().apt_install("wget").pip_install("requests")
)

print(vol_name_to_links)
print(path_to_vol)
print(vol_name_to_path)

@stub.function(volumes=path_to_vol, image=image, timeout=5000, gpu=None)
def download_model(volume_name, download_url):
    model_store_path = vol_name_to_path[volume_name]
    subprocess.run(["wget", download_url, "--content-disposition", "-P", model_store_path])
    subprocess.run(["ls", "-la", model_store_path])
    path_to_vol[model_store_path].commit()

@stub.local_entrypoint()
def simple_download():
    print(vol_name_to_links)
    print([(vol_name, link) for vol_name,link in vol_name_to_links.items()])
    list(download_model.starmap([(vol_name, link) for vol_name,link in vol_name_to_links.items()]))
