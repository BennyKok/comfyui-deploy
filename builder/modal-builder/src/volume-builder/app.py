import modal
from config import config
import os
import subprocess

stub = modal.Stub()

# Volume names may only contain alphanumeric characters, dashes, periods, and underscores, and must be less than 64 characters in length.
def is_valid_name(name: str) -> bool:
    allowed_characters = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._")
    return 0 < len(name) <= 64 and all(char in allowed_characters for char in name)

def create_volumes(volume_names, paths):
    path_to_vol = {}
    for volume_name in volume_names.keys():
        if not is_valid_name(volume_name):
            pass
        modal_volume = modal.Volume.persisted(volume_name)
        path_to_vol[paths[volume_name]] = modal_volume
 
    return path_to_vol

vol_name_to_links = config["volume_names"]
vol_name_to_path = config["paths"]
volumes = create_volumes(vol_name_to_links, vol_name_to_path)
image = ( 
   modal.Image.debian_slim().apt_install("wget").pip_install("requests")
)

print(vol_name_to_links)
print(vol_name_to_path)
print(volumes)

@stub.function(volumes=volumes, image=image, timeout=5000, gpu=None)
def download_model(volume_name, download_url):
    model_store_path = vol_name_to_path[volume_name]
    subprocess.run(["wget", download_url, "--content-disposition", "-P", model_store_path])
    subprocess.run(["ls", "-la", model_store_path])
    volumes[model_store_path].commit()

@stub.local_entrypoint()
def simple_download():
    print(vol_name_to_links)
    print([(vol_name, link) for vol_name,link in vol_name_to_links.items()])
    list(download_model.starmap([(vol_name, link) for vol_name,link in vol_name_to_links.items()]))
