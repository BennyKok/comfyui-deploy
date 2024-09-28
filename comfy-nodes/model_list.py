import folder_paths
class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False

from os import walk

WILDCARD = AnyType("*")

MODEL_EXTENSIONS = {
    "safetensors": "SafeTensors file format",
    "ckpt": "Checkpoint file",
    "pth": "PyTorch serialized file",
    "pkl": "Pickle file",
    "onnx": "ONNX file",
}

def fetch_files(path):
    for (dirpath, dirnames, filenames) in walk(path):
        fs = []
        if len(dirnames) > 0:
            for dirname in dirnames:
                fs.extend(fetch_files(f"{dirpath}/{dirname}"))
        for filename in filenames:
            # Remove "./models/" from the beginning of dirpath
            relative_dirpath = dirpath.replace("./models/", "", 1)
            file_path = f"{relative_dirpath}/{filename}"
            
            # Only add files that are known model extensions
            file_extension = filename.split('.')[-1].lower()
            if file_extension in MODEL_EXTENSIONS:
                fs.append(file_path)

        return fs
allModels = fetch_files("./models")

class ComfyUIDeployModalList:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "model": (allModels, ),
            }
        }

    RETURN_TYPES = (WILDCARD,)
    RETURN_NAMES = ("model",)

    FUNCTION = "run"

    CATEGORY = "model"

    def run(self, model=""):
        # Split the model path by '/' and select the last item
        model_name = model.split('/')[-1]
        return [model_name]


NODE_CLASS_MAPPINGS = {"ComfyUIDeployModelList": ComfyUIDeployModalList}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyUIDeployModelList": "Model List (ComfyUI Deploy)"}