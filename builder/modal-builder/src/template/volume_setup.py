import modal
from config import config

public_model_volume = modal.Volume.persisted(config["public_checkpoint_volume"])
private_volume = modal.Volume.persisted(config["private_checkpoint_volume"])

PUBLIC_BASEMODEL_DIR = "/public_models"
PRIVATE_BASEMODEL_DIR = "/private_models"
volumes = {PUBLIC_BASEMODEL_DIR: public_model_volume, PRIVATE_BASEMODEL_DIR: private_volume}
