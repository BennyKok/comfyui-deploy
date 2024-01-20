import modal
import subprocess
import requests

stub = modal.Stub()

# NOTE: volume name can be variable
volume = modal.Volume.persisted("model-store")
model_store_path = "/vol/models"
MODEL_ROUTE = "models"
image = (
    modal.Image.debian_slim().apt_install("wget").pip_install("requests")
)

@stub.function(volumes={model_store_path: volume}, gpu="any", image=image, timeout=600)
def download_model(model):
    # wget https://civitai.com/api/download/models/{modelVersionId} --content-disposition
    model_id = model['modelVersions'][0]['id']
    download_url = f"https://civitai.com/api/download/models/{model_id}"
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

@stub.local_entrypoint()
def insert_model(type: str = "Checkpoint", sort = "Highest Rated", page: int = 1):
    civitai_models = get_civitai_models.local(type, sort, page)
    if civitai_models:
        for _ in download_model.map(civitai_models['items'][1:]):
            pass
    else:
        print("Failed to retrieve models.")
