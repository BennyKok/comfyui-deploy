"""
This is a standalone script to download models into a modal Volume using civitai

Example Usage
`modal run insert_models::insert_model --civitai-url https://civitai.com/models/36520/ghostmix`
This inserts an individual model from a civitai url (public not API url)

`modal run insert_models::insert_models` 
This inserts a bunch of models based on the models retrieved by civitai

civitai's API reference https://github.com/civitai/civitai/wiki/REST-API-Reference
"""
import modal
import subprocess
import requests

stub = modal.Stub()

# NOTE: volume name can be variable
volume = modal.Volume.persisted("private-model-store")
model_store_path = "/vol/models"
MODEL_ROUTE = "models"
image = (
    modal.Image.debian_slim().apt_install("wget").pip_install("requests")
)

@stub.function(volumes={model_store_path: volume}, gpu="any", image=image, timeout=600)
def download_model(model):
    # wget https://civitai.com/api/download/models/{modelVersionId} --content-disposition
    # model_id = model['modelVersions'][0]['id']
    # download_url = f"https://civitai.com/api/download/models/{model_id}"

    download_url = model['modelVersions'][0]['downloadUrl'] 
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
    if not civitai_url.startswith("https://civitai.com/models/"):
        return "Error: URL must be from civitai.com and contain /models/"

    # Extract the model ID
    try:
        model_id = civitai_url.split("/")[4]
        int(model_id)  # Check if the ID is an integer
    except (IndexError, ValueError):
        return None #Error: Invalid model ID in URL

    # Make the API request
    api_url = f"https://civitai.com/api/v1/models/{model_id}"
    response = requests.get(api_url)

    # Check for successful response
    if response.status_code != 200:
        return f"Error: Unable to fetch data from {api_url}"

    # Return the response data
    return response.json()



@stub.local_entrypoint()
def insert_models(type: str = "Checkpoint", sort = "Highest Rated", page: int = 1):
    civitai_models = get_civitai_models.local(type, sort, page)
    if civitai_models:
        for _ in download_model.map(civitai_models['items'][1:]):
            pass
    else:
        print("Failed to retrieve models.")

@stub.local_entrypoint()
def insert_model(civitai_url: str):
    civitai_model = get_civitai_model_url.local(civitai_url)
    if civitai_model: 
        download_model.remote(civitai_model)
