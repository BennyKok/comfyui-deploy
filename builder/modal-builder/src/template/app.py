from config import config
import modal
from modal import Image, Mount, web_endpoint, Stub, asgi_app
import json
import urllib.request
import urllib.parse
from pydantic import BaseModel
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse

# deploy_test = False

import os
current_directory = os.path.dirname(os.path.realpath(__file__))

deploy_test = config["deploy_test"] == "True"
# MODAL_IMAGE_ID = os.environ.get('MODAL_IMAGE_ID', None)

# print(MODAL_IMAGE_ID)

# config_file_path = current_directory if MODAL_IMAGE_ID is None else ""
# with open(f'{config_file_path}/data/config.json') as f:
#     config = json.load(f)
# config["name"]
# print(config)

web_app = FastAPI()
print(config)
print("deploy_test ", deploy_test)
stub = Stub(name=config["name"])
# print(stub.app_id)

if not deploy_test:
    # dockerfile_image = Image.from_dockerfile(f"{current_directory}/Dockerfile", context_mount=Mount.from_local_dir(f"{current_directory}/data", remote_path="/data"))
    # dockerfile_image = Image.from_dockerfile(f"{current_directory}/Dockerfile", context_mount=Mount.from_local_dir(f"{current_directory}/data", remote_path="/data"))

    dockerfile_image = (
        modal.Image.debian_slim()
        .env({
            "CIVITAI_TOKEN": config["civitai_token"],
        })
        .apt_install("git", "wget")
        .pip_install(
            "git+https://github.com/modal-labs/asgiproxy.git", "httpx", "tqdm"
        )
        .apt_install("libgl1-mesa-glx", "libglib2.0-0")
        .run_commands(
            # Basic comfyui setup
            "git clone https://github.com/comfyanonymous/ComfyUI.git /comfyui",
            "cd /comfyui && pip install xformers!=0.0.18 -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cu121",

            # Install comfyui manager
            "cd /comfyui/custom_nodes && git clone https://github.com/ltdrdata/ComfyUI-Manager.git",
            "cd /comfyui/custom_nodes/ComfyUI-Manager && git reset --hard 9c86f62b912f4625fe2b929c7fc61deb9d16f6d3",
            "cd /comfyui/custom_nodes/ComfyUI-Manager && pip install -r requirements.txt",
            "cd /comfyui/custom_nodes/ComfyUI-Manager && mkdir startup-scripts",
        )
        # .run_commands(
        #     # Install comfy deploy
        #     "cd /comfyui/custom_nodes && git clone https://github.com/BennyKok/comfyui-deploy.git",
        # )
        # .copy_local_file(f"{current_directory}/data/extra_model_paths.yaml", "/comfyui")

        .copy_local_file(f"{current_directory}/data/start.sh", "/start.sh")
        .run_commands("chmod +x /start.sh")

        # Restore the custom nodes first
        .copy_local_file(f"{current_directory}/data/restore_snapshot.py", "/")
        .copy_local_file(f"{current_directory}/data/snapshot.json", "/comfyui/custom_nodes/ComfyUI-Manager/startup-scripts/restore-snapshot.json")
        .run_commands("python restore_snapshot.py")

        # Then install the models
        .copy_local_file(f"{current_directory}/data/install_deps.py", "/")
        .copy_local_file(f"{current_directory}/data/models.json", "/")
        .copy_local_file(f"{current_directory}/data/deps.json", "/")

        .run_commands("python install_deps.py")
    )

# Time to wait between API check attempts in milliseconds
COMFY_API_AVAILABLE_INTERVAL_MS = 50
# Maximum number of API check attempts
COMFY_API_AVAILABLE_MAX_RETRIES = 500
# Time to wait between poll attempts in milliseconds
COMFY_POLLING_INTERVAL_MS = 250
# Maximum number of poll attempts
COMFY_POLLING_MAX_RETRIES = 1000
# Host where ComfyUI is running
COMFY_HOST = "127.0.0.1:8188"


def check_server(url, retries=50, delay=500):
    import requests
    import time
    """
    Check if a server is reachable via HTTP GET request

    Args:
    - url (str): The URL to check
    - retries (int, optional): The number of times to attempt connecting to the server. Default is 50
    - delay (int, optional): The time in milliseconds to wait between retries. Default is 500

    Returns:
    bool: True if the server is reachable within the given number of retries, otherwise False
    """

    for i in range(retries):
        try:
            response = requests.get(url)

            # If the response status code is 200, the server is up and running
            if response.status_code == 200:
                print(f"runpod-worker-comfy - API is reachable")
                return True
        except requests.RequestException as e:
            # If an exception occurs, the server may not be ready
            pass

        # print(f"runpod-worker-comfy - trying")

        # Wait for the specified delay before retrying
        time.sleep(delay / 1000)

    print(
        f"runpod-worker-comfy - Failed to connect to server at {url} after {retries} attempts."
    )
    return False


def check_status(prompt_id):
    req = urllib.request.Request(
        f"http://{COMFY_HOST}/comfyui-deploy/check-status?prompt_id={prompt_id}")
    return json.loads(urllib.request.urlopen(req).read())


class Input(BaseModel):
    prompt_id: str
    workflow_api: dict
    status_endpoint: str
    file_upload_endpoint: str


def queue_workflow_comfy_deploy(data: Input):
    data_str = data.json()
    data_bytes = data_str.encode('utf-8')
    req = urllib.request.Request(
        f"http://{COMFY_HOST}/comfyui-deploy/run", data=data_bytes)
    return json.loads(urllib.request.urlopen(req).read())


class RequestInput(BaseModel):
    input: Input


image = Image.debian_slim()

target_image = image if deploy_test else dockerfile_image


@stub.function(image=target_image, gpu=config["gpu"])
def run(input: Input):
    import subprocess
    import time
    # Make sure that the ComfyUI API is available
    print(f"comfy-modal - check server")

    command = ["python", "main.py",
               "--disable-auto-launch", "--disable-metadata"]
    server_process = subprocess.Popen(command, cwd="/comfyui")

    check_server(
        f"http://{COMFY_HOST}",
        COMFY_API_AVAILABLE_MAX_RETRIES,
        COMFY_API_AVAILABLE_INTERVAL_MS,
    )

    job_input = input

    # print(f"comfy-modal - got input {job_input}")

    # Queue the workflow
    try:
        # job_input is the json input
        queued_workflow = queue_workflow_comfy_deploy(
            job_input)  # queue_workflow(workflow)
        prompt_id = queued_workflow["prompt_id"]
        print(f"comfy-modal - queued workflow with ID {prompt_id}")
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return {"error": f"Error queuing workflow: {str(e)}"}

    # Poll for completion
    print(f"comfy-modal - wait until image generation is complete")
    retries = 0
    status = ""
    try:
        print("getting request")
        while retries < COMFY_POLLING_MAX_RETRIES:
            status_result = check_status(prompt_id=prompt_id)
            # history = get_history(prompt_id)

            # Exit the loop if we have found the history
            # if prompt_id in history and history[prompt_id].get("outputs"):
            #     break

            # Exit the loop if we have found the status both success or failed
            if 'status' in status_result and (status_result['status'] == 'success' or status_result['status'] == 'failed'):
                status = status_result['status']
                print(status)
                break
            else:
                # Wait before trying again
                time.sleep(COMFY_POLLING_INTERVAL_MS / 1000)
                retries += 1
        else:
            return {"error": "Max retries reached while waiting for image generation"}
    except Exception as e:
        return {"error": f"Error waiting for image generation: {str(e)}"}

    print(f"comfy-modal - Finished, turning off")
    server_process.terminate()

    # Get the generated image and return it as URL in an AWS bucket or as base64
    # images_result = process_output_images(history[prompt_id].get("outputs"), job["id"])
    # result = {**images_result, "refresh_worker": REFRESH_WORKER}
    result = {"status": status}

    return result
    print("Running remotely on Modal!")


@web_app.post("/run")
async def bar(request_input: RequestInput):
    # print(request_input)
    if not deploy_test:
        run.spawn(request_input.input)
        return {"status": "success"}
    # pass


@stub.function(image=image)
@asgi_app()
def comfyui_api():
    return web_app


HOST = "127.0.0.1"
PORT = "8188"


def spawn_comfyui_in_background():
    import socket
    import subprocess

    process = subprocess.Popen(
        [
            "python",
            "main.py",
            "--dont-print-server",
            "--port",
            PORT,
        ],
        cwd="/comfyui",
    )

    # Poll until webserver accepts connections before running inputs.
    while True:
        try:
            socket.create_connection((HOST, int(PORT)), timeout=1).close()
            print("ComfyUI webserver ready!")
            break
        except (socket.timeout, ConnectionRefusedError):
            # Check if launcher webserving process has exited.
            # If so, a connection can never be made.
            retcode = process.poll()
            if retcode is not None:
                raise RuntimeError(
                    f"comfyui main.py exited unexpectedly with code {retcode}"
                )


@stub.function(
    image=target_image,
    gpu=config["gpu"],
    # Allows 100 concurrent requests per container.
    allow_concurrent_inputs=100,
    # Restrict to 1 container because we want to our ComfyUI session state
    # to be on a single container.
    concurrency_limit=1,
    timeout=10 * 60,
)
@asgi_app()
def comfyui_app():
    from asgiproxy.config import BaseURLProxyConfigMixin, ProxyConfig
    from asgiproxy.context import ProxyContext
    from asgiproxy.simple_proxy import make_simple_proxy_app

    spawn_comfyui_in_background()

    config = type(
        "Config",
        (BaseURLProxyConfigMixin, ProxyConfig),
        {
            "upstream_base_url": f"http://{HOST}:{PORT}",
            "rewrite_host_header": f"{HOST}:{PORT}",
        },
    )()

    return make_simple_proxy_app(ProxyContext(config))