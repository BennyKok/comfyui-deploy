import modal
from config import config

public_model_volume = modal.Volume.persisted(config["public_checkpoint_volume"])
private_volume = modal.Volume.persisted(config["private_checkpoint_volume"])

BASEMODEL_DIR = "/extra_models/"
MODEL_DIR = BASEMODEL_DIR + "checkpoints"
PRIVATE_MODEL_DIR = BASEMODEL_DIR + "private_checkpoints"
volumes = {MODEL_DIR: public_model_volume, PRIVATE_MODEL_DIR: private_volume}
