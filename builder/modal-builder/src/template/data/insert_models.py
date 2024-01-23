"""
This is a standalone script to download models into a modal Volume using civitai

Example Usage
`modal run insert_models::insert_model --civitai-url https://civitai.com/models/36520/ghostmix`
This inserts an individual model from a civitai url 

`modal run insert_models::insert_models_civitai_api` 
This inserts a bunch of models based on the models retrieved by civitai

civitai's API reference https://github.com/civitai/civitai/wiki/REST-API-Reference
"""
import modal
import subprocess
import requests
import json

stub = modal.Stub()

# NOTE: volume name can be variable
volume = modal.Volume.persisted("rah")
model_store_path = "/vol/models"
MODEL_ROUTE = "models"
image = (
    modal.Image.debian_slim().apt_install("wget").pip_install("requests")
)

@stub.function(volumes={model_store_path: volume}, image=image, timeout=50000, gpu=None)
def download_model(download_url):
    print(download_url)
    subprocess.run(["wget", download_url, "--content-disposition", "-P", model_store_path])
    subprocess.run(["ls", "-la", model_store_path])
    volume.commit()

# file is raw output from Civitai API https://github.com/civitai/civitai/wiki/REST-API-Reference

@stub.function()
def get_civitai_models(model_type: str, sort: str = "Highest Rated", page: int = 1):
    """Fetch models from CivitAI API based on type."""
    try:
        response = requests.get(f"https://civitai.com/api/v1/models", params={"types": model_type, "page": page, "sort": sort})
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching models: {e}")
        return None


@stub.function()
def get_civitai_model_url(civitai_url: str):
    # Validate the URL

    if civitai_url.startswith("https://civitai.com/api/"):
        api_url = civitai_url
    elif civitai_url.startswith("https://civitai.com/models/"):  
        try:
            model_id = civitai_url.split("/")[4]
            int(model_id) 
        except (IndexError, ValueError):
            return None 
        api_url = f"https://civitai.com/api/v1/models/{model_id}"
    else:
        return "Error: URL must be from civitai.com and contain /models/"

    response = requests.get(api_url)
    # Check for successful response
    if response.status_code != 200:
        return f"Error: Unable to fetch data from {api_url}"
    # Return the response data
    return response.json()



@stub.local_entrypoint()
def insert_models_civitai_api(type: str = "Checkpoint", sort = "Highest Rated", page: int = 1):
    civitai_models = get_civitai_models.local(type, sort, page)
    if civitai_models:
        for _ in download_model.map(map(lambda model: model['modelVersions'][0]['downloadUrl'], civitai_models['items'])):
            pass
    else:
        print("Failed to retrieve models.")

@stub.local_entrypoint()
def insert_model(civitai_url: str):
    if civitai_url.startswith("'https://civitai.com/api/download/models/"):
        download_url = civitai_url
    else:
        civitai_model = get_civitai_model_url.local(civitai_url)
        if civitai_model:
            download_url = civitai_model['modelVersions'][0]['downloadUrl']
        else:
            return "invalid URL"

    download_model.remote(download_url)

@stub.local_entrypoint()
def simple_download():
    download_urls = ['https://civitai.com/api/download/models/119057', 'https://civitai.com/api/download/models/130090', 'https://civitai.com/api/download/models/31859', 'https://civitai.com/api/download/models/128713', 'https://civitai.com/api/download/models/179657', 'https://civitai.com/api/download/models/143906', 'https://civitai.com/api/download/models/9208', 'https://civitai.com/api/download/models/136078', 'https://civitai.com/api/download/models/134065', 'https://civitai.com/api/download/models/288775', 'https://civitai.com/api/download/models/95263', 'https://civitai.com/api/download/models/288982', 'https://civitai.com/api/download/models/87153', 'https://civitai.com/api/download/models/10638', 'https://civitai.com/api/download/models/263809', 'https://civitai.com/api/download/models/130072', 'https://civitai.com/api/download/models/117019', 'https://civitai.com/api/download/models/95256', 'https://civitai.com/api/download/models/197181', 'https://civitai.com/api/download/models/256915', 'https://civitai.com/api/download/models/118945', 'https://civitai.com/api/download/models/125843', 'https://civitai.com/api/download/models/179015', 'https://civitai.com/api/download/models/245598', 'https://civitai.com/api/download/models/223670', 'https://civitai.com/api/download/models/90072', 'https://civitai.com/api/download/models/290817', 'https://civitai.com/api/download/models/154097', 'https://civitai.com/api/download/models/143497', 'https://civitai.com/api/download/models/5637']

    for _ in download_model.map(download_urls):
        pass
