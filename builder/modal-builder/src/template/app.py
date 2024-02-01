from config import config
import modal
from modal import Image, Mount, web_endpoint, Stub, asgi_app, method, enter, exit
import json
import urllib.request
import urllib.parse
from pydantic import BaseModel
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from volume_setup import volumes
from datetime import datetime
import aiohttp
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
print('volumes', volumes)
stub = Stub(name=config["name"])

if not deploy_test:
    # dockerfile_image = Image.from_dockerfile(f"{current_directory}/Dockerfile", context_mount=Mount.from_local_dir(f"{current_directory}/data", remote_path="/data"))
    # dockerfile_image = Image.from_dockerfile(f"{current_directory}/Dockerfile", context_mount=Mount.from_local_dir(f"{current_directory}/data", remote_path="/data"))

    dockerfile_image = (
        modal.Image.debian_slim(
            python_version="3.11",
        )
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
        .run_commands(f"cat /comfyui/server.py")
        .run_commands(f"ls /comfyui/app")
        # .run_commands(
        #     # Install comfy deploy
        #     "cd /comfyui/custom_nodes && git clone https://github.com/BennyKok/comfyui-deploy.git",
        # )
        .copy_local_file(f"{current_directory}/data/extra_model_paths.yaml", "/comfyui")

        .copy_local_file(f"{current_directory}/data/start.sh", "/start.sh")
        .run_commands("chmod +x /start.sh")

        # Restore the custom nodes first
        .pip_install(config["pip"])

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
COMFY_API_AVAILABLE_MAX_RETRIES = 1000
# Time to wait between poll attempts in milliseconds
COMFY_POLLING_INTERVAL_MS = 250
# Maximum number of poll attempts
COMFY_POLLING_MAX_RETRIES = 1000
# Host where ComfyUI is running
COMFY_HOST = "127.0.0.1:8188"


async def check_server(url, retries=50, delay=500):
    import aiohttp
    # for i in range(retries):
    while True:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    # If the response status code is 200, the server is up and running
                    if response.status == 200:
                        print(f"comfy-modal - API is reachable")
                        return True
        except Exception as e:
            # If an exception occurs, the server may not be ready
            pass

        # Wait for the specified delay before retrying
        await asyncio.sleep(delay / 1000)

    print(
        f"comfy-modal - Failed to connect to server at {url} after {retries} attempts."
    )
    return False


async def check_status(prompt_id):
    async with aiohttp.ClientSession() as session:
        async with session.get(f"http://{COMFY_HOST}/comfyui-deploy/check-status?prompt_id={prompt_id}") as response:
            return await response.json()


class Input(BaseModel):
    prompt_id: str
    workflow_api: dict
    status_endpoint: str
    file_upload_endpoint: str


async def queue_workflow_comfy_deploy(data: Input):
    data_str = data.json()
    data_bytes = data_str.encode('utf-8')
    async with aiohttp.ClientSession() as session:
        async with session.post(f"http://{COMFY_HOST}/comfyui-deploy/run", data=data_bytes) as response:
            return await response.json()


class RequestInput(BaseModel):
    input: Input


image = Image.debian_slim()

target_image = image if deploy_test else dockerfile_image

run_timeout = config["run_timeout"]
idle_timeout = config["idle_timeout"]

import asyncio

@stub.cls(image=target_image, gpu=config["gpu"] ,volumes=volumes, timeout=60 * 10, container_idle_timeout=idle_timeout)
class ComfyDeployRunner:

    machine_logs = []

    async def read_stream(self, stream, isStderr):
        import time
        while True:
            try:
                line = await stream.readline()
                if line:
                    l = line.decode('utf-8').strip()

                    if l == "":
                        continue

                    if not isStderr:
                        print(l, flush=True)
                        self.machine_logs.append({
                            "logs": l,
                            "timestamp": time.time()
                        })

                    else:
                        # is error
                        # logger.error(l)
                        print(l, flush=True)
                        self.machine_logs.append({
                            "logs": l,
                            "timestamp": time.time()
                        })
                else:
                    break
            except asyncio.CancelledError:
                # Handle the cancellation here if needed
                break  # Break out of the loop on cancellation

    @enter()
    async def setup(self):
        import subprocess
        import time
        # Make sure that the ComfyUI API is available
        print(f"comfy-modal - check server")

        self.server_process = await asyncio.subprocess.create_subprocess_shell(
            f"python main.py --disable-auto-launch --disable-metadata",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd="/comfyui",
            # env={**os.environ, "COLUMNS": "10000"}
        )

    @exit()
    async def cleanup(self, exc_type, exc_value, traceback):
        print(f"comfy-modal - cleanup", exc_type, exc_value, traceback)
        # Get the current event loop
        loop = asyncio.get_event_loop()

        # Check if the event loop is closed
        if loop.is_closed():
            print("The event loop is closed.")
        else:
            try:
                self.server_process.terminate()
                await self.server_process.wait()
            except Exception as e:
                print("Issues when cleaning up", e)
            print("The event loop is open.")

    @method()
    async def run(self, input: Input):
        import signal
        import time
        import asyncio
        import aiohttp

        stdout_task = asyncio.create_task(
            self.read_stream(self.server_process.stdout, False))
        stderr_task = asyncio.create_task(
            self.read_stream(self.server_process.stderr, True))
        
        try:
            class TimeoutError(Exception):
                pass

            def timeout_handler(signum, frame):
                data = json.dumps({
                    "run_id": input.prompt_id,
                    "status": "timeout",
                    "time": datetime.now().isoformat()
                }).encode('utf-8')
                req = urllib.request.Request(input.status_endpoint, data=data, method='POST')
                urllib.request.urlopen(req)
                raise TimeoutError("Operation timed out")
            
            signal.signal(signal.SIGALRM, timeout_handler)

            try:
                signal.alarm(run_timeout)  # 5 seconds timeout

                ok = await check_server(
                    f"http://{COMFY_HOST}",
                    COMFY_API_AVAILABLE_MAX_RETRIES,
                    COMFY_API_AVAILABLE_INTERVAL_MS,
                )

                if not ok:
                    raise Exception("ComfyUI API is not available")
                # Set an alarm for some seconds in the future

                data = json.dumps({
                    "run_id": input.prompt_id,
                    "status": "started",
                    "time": datetime.now().isoformat()
                }).encode('utf-8')
                async with aiohttp.ClientSession() as session:
                    async with session.post(input.status_endpoint, data=data) as response:
                        pass

                job_input = input

                try:
                    queued_workflow = await queue_workflow_comfy_deploy(job_input)  # queue_workflow(workflow)
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
                        status_result = await check_status(prompt_id=prompt_id)
                        if 'status' in status_result and (status_result['status'] == 'success' or status_result['status'] == 'failed'):
                            status = status_result['status']
                            print(status)
                            break
                        else:
                            # Wait before trying again
                            await asyncio.sleep(COMFY_POLLING_INTERVAL_MS / 1000)
                            retries += 1
                    else:
                        return {"error": "Max retries reached while waiting for image generation"}
                except Exception as e:
                    return {"error": f"Error waiting for image generation: {str(e)}"}

                print(f"comfy-modal - Finished, turning off")

                result = {"status": status}

            except TimeoutError:
                print("Operation timed out")
                return {"status": "failed"}
            except Exception as e:
                print(f"Unexpected error occurred: {str(e)}")
                data = json.dumps({
                    "run_id": input.prompt_id,
                    "status": "failed",
                    "time": datetime.now().isoformat()
                }).encode('utf-8')
                async with aiohttp.ClientSession() as session:
                    async with session.post(input.status_endpoint, data=data) as response:
                        print("response", response)
                self.machine_logs.append({
                    "logs": str(e),
                    "timestamp": time.time()
                })
            finally:
                signal.alarm(0)
                
            print("uploading log_data")
            data = json.dumps({
                "run_id": input.prompt_id,
                "time": datetime.now().isoformat(),
                "log_data": self.machine_logs
            }).encode('utf-8')
            print("my logs", len(self.machine_logs))
            # Clear logs
            async with aiohttp.ClientSession() as session:
                async with session.post(input.status_endpoint, data=data) as response:
                    print("response", response)
            print("uploaded log_data")
            # print(data)
            self.machine_logs = []
        finally:
            stdout_task.cancel()
            stderr_task.cancel()
            await stdout_task
            await stderr_task
        
        return result
        
    

@web_app.post("/run")
async def post_run(request_input: RequestInput):
    if not deploy_test:
        # print(request_input.input.prompt_id, request_input.input.status_endpoint)
        data = json.dumps({
            "run_id": request_input.input.prompt_id,
            "status": "queued",
            "time": datetime.now().isoformat()
        }).encode('utf-8')
        req = urllib.request.Request(request_input.input.status_endpoint, data=data, method='POST')
        urllib.request.urlopen(req)

        model = ComfyDeployRunner()
        call = await model.run.spawn.aio(request_input.input)

        print("call", call)

        # call = run.spawn()
        return {"call_id": None}
    
    return {"call_id": None}

@stub.function(image=image
   ,volumes=volumes
)
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
    volumes=volumes,
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
