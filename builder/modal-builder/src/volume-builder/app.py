import modal
from config import config
import os
import subprocess
from pprint import pprint

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
vol_name_to_path = config["volume_paths"]
callback_url = config["callback_url"]
callback_body = config["callback_body"]
civitai_key = config["civitai_api_key"]

volumes = create_volumes(vol_name_to_links, vol_name_to_path)
image = ( 
   modal.Image.debian_slim().apt_install("wget").pip_install("requests")
)

# download config { "download_url": "", "folder_path": ""}
timeout=5000
@stub.function(volumes=volumes, image=image, timeout=timeout, gpu=None)
def download_model(volume_name, download_config):
    import requests
    download_url = download_config["download_url"]
    folder_path = download_config["folder_path"]

    volume_base_path = vol_name_to_path[volume_name]
    model_store_path = os.path.join(volume_base_path, folder_path)
    modified_download_url = download_url + ("&" if "?" in download_url else "?") + "token=" + civitai_key
    print('downlodaing', modified_download_url)

    subprocess.run(["wget", modified_download_url , "--content-disposition", "-P", model_store_path])
    subprocess.run(["ls", "-la", volume_base_path])
    subprocess.run(["ls", "-la", model_store_path])
    volumes[volume_base_path].commit()


    status =  {"status": "success"}
    requests.post(callback_url, json={**status, **callback_body})
    print(f"finished! sending to {callback_url}")
    pprint({**status, **callback_body})

@stub.local_entrypoint()
def simple_download():
    import requests
    print(vol_name_to_links)
    print([(vol_name, link) for vol_name,link in vol_name_to_links.items()])
    try:
        list(download_model.starmap([(vol_name, link) for vol_name,link in vol_name_to_links.items()]))
    except modal.exception.FunctionTimeoutError as e:
        status =  {"status": "failed", "error_logs": f"{str(e)}", "timeout": timeout}
        requests.post(callback_url, json={**status, **callback_body})
        print(f"finished! sending to {callback_url}")
        pprint({**status, **callback_body})
    except Exception as e:
        status =  {"status": "failed", "error_logs": str(e)}
        requests.post(callback_url, json={**status, **callback_body})
        print(f"finished! sending to {callback_url}")
        pprint({**status, **callback_body})
        
