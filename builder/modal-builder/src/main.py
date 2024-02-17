from typing import Union, Optional, Dict, List
from pydantic import BaseModel, Field, field_validator
from fastapi import FastAPI, HTTPException, WebSocket, BackgroundTasks, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.logger import logger as fastapi_logger
import os
from enum import Enum
import json
import subprocess
import time
from contextlib import asynccontextmanager
import asyncio
import threading
import signal
import logging
from fastapi.logger import logger as fastapi_logger
import requests
from urllib.parse import parse_qs
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp, Scope, Receive, Send

from concurrent.futures import ThreadPoolExecutor

# executor = ThreadPoolExecutor(max_workers=5)

gunicorn_error_logger = logging.getLogger("gunicorn.error")
gunicorn_logger = logging.getLogger("gunicorn")
uvicorn_access_logger = logging.getLogger("uvicorn.access")
uvicorn_access_logger.handlers = gunicorn_error_logger.handlers

fastapi_logger.handlers = gunicorn_error_logger.handlers

if __name__ != "__main__":
    fastapi_logger.setLevel(gunicorn_logger.level)
else:
    fastapi_logger.setLevel(logging.DEBUG)

logger = logging.getLogger("uvicorn")
logger.setLevel(logging.INFO)

last_activity_time = time.time()
global_timeout = 60 * 4

machine_id_websocket_dict = {}
machine_id_status = {}

fly_instance_id = os.environ.get('FLY_ALLOC_ID', 'local').split('-')[0]


class FlyReplayMiddleware(BaseHTTPMiddleware):
    """
    If the wrong instance was picked by the fly.io load balancer we use the fly-replay header
    to repeat the request again on the right instance.

    This only works if the right instance is provided as a query_string parameter.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        target_instance = query_params.get(
            'fly_instance_id', [fly_instance_id])[0]

        async def send_wrapper(message):
            if target_instance != fly_instance_id:
                if message['type'] == 'websocket.close' and 'Invalid session' in message['reason']:
                    # fly.io only seems to look at the fly-replay header if websocket is accepted
                    message = {'type': 'websocket.accept'}
                if 'headers' not in message:
                    message['headers'] = []
                message['headers'].append(
                    [b'fly-replay', f'instance={target_instance}'.encode()])
            await send(message)
        await self.app(scope, receive, send_wrapper)


async def check_inactivity():
    global last_activity_time
    while True:
        # logger.info("Checking inactivity...")
        if time.time() - last_activity_time > global_timeout:
            if len(machine_id_status) == 0:
                # The application has been inactive for more than 60 seconds.
                # Scale it down to zero here.
                logger.info(
                    f"No activity for {global_timeout} seconds, exiting...")
                # os._exit(0)
                os.kill(os.getpid(), signal.SIGINT)
                break
            else:
                pass
                # logger.info(f"Timeout but still in progress")

        await asyncio.sleep(1)  # Check every second


@asynccontextmanager
async def lifespan(app: FastAPI):
    thread = run_in_new_thread(check_inactivity())
    yield
    logger.info("Cancelling")

#
app = FastAPI(lifespan=lifespan)
app.add_middleware(FlyReplayMiddleware)
# MODAL_ORG = os.environ.get("MODAL_ORG")


@app.get("/")
def read_root():
    global last_activity_time
    last_activity_time = time.time()
    logger.info(f"Extended inactivity time to {global_timeout}")
    return {"Hello": "World"}

# create a post route called /create takes in a json of example
# {
#     name: "my first image",
#     deps: {
#         "comfyui": "d0165d819afe76bd4e6bdd710eb5f3e571b6a804",
#         "git_custom_nodes": {
#             "https://github.com/cubiq/ComfyUI_IPAdapter_plus": {
#                 "hash": "2ca0c6dd0b2ad64b1c480828638914a564331dcd",
#                 "disabled": true
#             },
#             "https://github.com/ltdrdata/ComfyUI-Manager.git": {
#                 "hash": "9c86f62b912f4625fe2b929c7fc61deb9d16f6d3",
#                 "disabled": false
#             },
#         },
#         "file_custom_nodes": []
#     }
# }


class GitCustomNodes(BaseModel):
    hash: str
    disabled: bool

class FileCustomNodes(BaseModel):
    filename: str
    disabled: bool


class Snapshot(BaseModel):
    comfyui: str
    git_custom_nodes: Dict[str, GitCustomNodes]
    file_custom_nodes: List[FileCustomNodes]

class Model(BaseModel):
    name: str
    type: str
    base: str
    save_path: str
    description: str
    reference: str
    filename: str
    url: str


class GPUType(str, Enum):
    T4 = "T4"
    A10G = "A10G"
    A100 = "A100"
    L4 = "L4"


class Item(BaseModel):
    machine_id: str
    name: str
    snapshot: Snapshot
    models: List[Model]
    callback_url: str
    gpu: GPUType = Field(default=GPUType.T4)

    @field_validator('gpu')
    @classmethod
    def check_gpu(cls, value):
        if value not in GPUType.__members__:
            raise ValueError(
                f"Invalid GPU option. Choose from: {', '.join(GPUType.__members__.keys())}")
        return GPUType(value)


@app.websocket("/ws/{machine_id}")
async def websocket_endpoint(websocket: WebSocket, machine_id: str):
    await websocket.accept()
    machine_id_websocket_dict[machine_id] = websocket
    # Send existing logs
    if machine_id in machine_logs_cache:
        combined_logs = "\n".join(
            log_entry['logs'] for log_entry in machine_logs_cache[machine_id])
        await websocket.send_text(json.dumps({"event": "LOGS", "data": {
            "machine_id": machine_id,
            "logs": combined_logs,
            "timestamp": time.time()
        }}))
    try:
        while True:
            data = await websocket.receive_text()
            global last_activity_time
            last_activity_time = time.time()
            logger.info(f"Extended inactivity time to {global_timeout}")
            # You can handle received messages here if needed
    except WebSocketDisconnect:
        if machine_id in machine_id_websocket_dict:
            machine_id_websocket_dict.pop(machine_id)

# @app.get("/test")
# async def test():
#     machine_id_status["123"] = True
#     global last_activity_time
#     last_activity_time = time.time()
#     logger.info(f"Extended inactivity time to {global_timeout}")

#     await asyncio.sleep(10)

#     machine_id_status["123"] = False
#     machine_id_status.pop("123")

#     return {"Hello": "World"}


@app.post("/create")
async def create_machine(item: Item):
    global last_activity_time
    last_activity_time = time.time()
    logger.info(f"Extended inactivity time to {global_timeout}")

    if item.machine_id in machine_id_status and machine_id_status[item.machine_id]:
        return JSONResponse(status_code=400, content={"error": "Build already in progress."})

    # Run the building logic in a separate thread
    # future = executor.submit(build_logic, item)
    task = asyncio.create_task(build_logic(item))

    return JSONResponse(status_code=200, content={"message": "Build Queued", "build_machine_instance_id": fly_instance_id})


class StopAppItem(BaseModel):
    machine_id: str


def find_app_id(app_list, app_name):
    for app in app_list:
        if app['Name'] == app_name:
            return app['App ID']
    return None

@app.post("/stop-app")
async def stop_app(item: StopAppItem):
    # cmd = f"modal app list | grep {item.machine_id} | awk -F '│' '{{print $2}}'"
    cmd = f"modal app list --json"

    env = os.environ.copy()
    env["COLUMNS"] = "10000"  # Set the width to a large value
    find_id_process = await asyncio.subprocess.create_subprocess_shell(cmd,
                                                                      stdout=asyncio.subprocess.PIPE,
                                                                      stderr=asyncio.subprocess.PIPE,
                                                                      env=env)
    await find_id_process.wait()

    stdout, stderr = await find_id_process.communicate()
    if stdout:
        app_id = stdout.decode().strip()
        app_list = json.loads(app_id)
        app_id = find_app_id(app_list, item.machine_id)
        logger.info(f"cp_process stdout: {app_id}")
    if stderr:
        logger.info(f"cp_process stderr: {stderr.decode()}")

    cp_process = await asyncio.subprocess.create_subprocess_exec("modal", "app", "stop", app_id,
                                                                 stdout=asyncio.subprocess.PIPE,
                                                                 stderr=asyncio.subprocess.PIPE,)
    await cp_process.wait()
    logger.info(f"Stopping app {item.machine_id}")
    stdout, stderr = await cp_process.communicate()
    if stdout:
        logger.info(f"cp_process stdout: {stdout.decode()}")
    if stderr:
        logger.info(f"cp_process stderr: {stderr.decode()}")

    if cp_process.returncode == 0:
        return JSONResponse(status_code=200, content={"status": "success"})
    else:
        return JSONResponse(status_code=500, content={"status": "error", "error": stderr.decode()})

# Initialize the logs cache
machine_logs_cache = {}


async def build_logic(item: Item):
    # Deploy to modal
    folder_path = f"/app/builds/{item.machine_id}"
    machine_id_status[item.machine_id] = True

    # Ensure the os path is same as the current directory
    # os.chdir(os.path.dirname(os.path.realpath(__file__)))
    # print(
    #     f"builder - Current working directory: {os.getcwd()}"
    # )

    # Copy the app template
    # os.system(f"cp -r template {folder_path}")
    cp_process = await asyncio.subprocess.create_subprocess_exec("cp", "-r", "/app/src/template", folder_path)
    await cp_process.wait()

    # Write the config file
    config = {
        "name": item.name,
        "deploy_test": os.environ.get("DEPLOY_TEST_FLAG", "False"),
        "gpu": item.gpu,
        "civitai_token": os.environ.get("CIVITAI_TOKEN", "")
    }
    with open(f"{folder_path}/config.py", "w") as f:
        f.write("config = " + json.dumps(config))

    with open(f"{folder_path}/data/snapshot.json", "w") as f:
        f.write(item.snapshot.json())

    with open(f"{folder_path}/data/models.json", "w") as f:
        models_json_list = [model.dict() for model in item.models]
        models_json_string = json.dumps(models_json_list)
        f.write(models_json_string)

    # os.chdir(folder_path)
    # process = subprocess.Popen(f"modal deploy {folder_path}/app.py", stdout=subprocess.PIPE, stderr=subprocess.STDOUT, shell=True)
    process = await asyncio.subprocess.create_subprocess_shell(
        f"modal deploy app.py",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=folder_path,
        env={**os.environ, "COLUMNS": "10000"}
    )

    url = None

    if item.machine_id not in machine_logs_cache:
        machine_logs_cache[item.machine_id] = []

    machine_logs = machine_logs_cache[item.machine_id]

    url_queue = asyncio.Queue()

    async def read_stream(stream, isStderr, url_queue: asyncio.Queue):
        while True:
            line = await stream.readline()
            if line:
                l = line.decode('utf-8').strip()

                if l == "":
                    continue

                if not isStderr:
                    logger.info(l)
                    machine_logs.append({
                        "logs": l,
                        "timestamp": time.time()
                    })

                    if item.machine_id in machine_id_websocket_dict:
                        await machine_id_websocket_dict[item.machine_id].send_text(json.dumps({"event": "LOGS", "data": {
                            "machine_id": item.machine_id,
                            "logs": l,
                            "timestamp": time.time()
                        }}))

                    if "Created comfyui_api =>" in l or ((l.startswith("https://") or l.startswith("│")) and l.endswith(".modal.run")):
                        if "Created comfyui_api =>" in l:
                            url = l.split("=>")[1].strip()
                        # making sure it is a url
                        elif "comfyui-api" in l:
                            # Some case it only prints the url on a blank line
                            if l.startswith("│"):
                                url = l.split("│")[1].strip()
                            else:
                                url = l

                        if url:
                            machine_logs.append({
                                "logs": f"App image built, url: {url}",
                                "timestamp": time.time()
                            })

                            await url_queue.put(url)

                            if item.machine_id in machine_id_websocket_dict:
                                await machine_id_websocket_dict[item.machine_id].send_text(json.dumps({"event": "LOGS", "data": {
                                    "machine_id": item.machine_id,
                                    "logs": f"App image built, url: {url}",
                                    "timestamp": time.time()
                                }}))
                                await machine_id_websocket_dict[item.machine_id].send_text(json.dumps({"event": "FINISHED", "data": {
                                    "status": "succuss",
                                }}))

                else:
                    # is error
                    logger.error(l)
                    machine_logs.append({
                        "logs": l,
                        "timestamp": time.time()
                    })

                    if item.machine_id in machine_id_websocket_dict:
                        await machine_id_websocket_dict[item.machine_id].send_text(json.dumps({"event": "LOGS", "data": {
                            "machine_id": item.machine_id,
                            "logs": l,
                            "timestamp": time.time()
                        }}))
                        await machine_id_websocket_dict[item.machine_id].send_text(json.dumps({"event": "FINISHED", "data": {
                            "status": "failed",
                        }}))
            else:
                break

    stdout_task = asyncio.create_task(
        read_stream(process.stdout, False, url_queue))
    stderr_task = asyncio.create_task(
        read_stream(process.stderr, True, url_queue))

    await asyncio.wait([stdout_task, stderr_task])

    # Wait for the subprocess to finish
    await process.wait()

    if not url_queue.empty():
        # The queue is not empty, you can get an item
        url = await url_queue.get()

    # Close the ws connection and also pop the item
    if item.machine_id in machine_id_websocket_dict and machine_id_websocket_dict[item.machine_id] is not None:
        await machine_id_websocket_dict[item.machine_id].close()

    if item.machine_id in machine_id_websocket_dict:
        machine_id_websocket_dict.pop(item.machine_id)

    if item.machine_id in machine_id_status:
        machine_id_status[item.machine_id] = False

    # Check for errors
    if process.returncode != 0:
        logger.info("An error occurred.")
        # Send a post request with the json body machine_id to the callback url
        machine_logs.append({
            "logs": "Unable to build the app image.",
            "timestamp": time.time()
        })
        requests.post(item.callback_url, json={
                      "machine_id": item.machine_id, "build_log": json.dumps(machine_logs)})

        if item.machine_id in machine_logs_cache:
            del machine_logs_cache[item.machine_id]

        return
        # return JSONResponse(status_code=400, content={"error": "Unable to build the app image."})

    # app_suffix = "comfyui-app"

    if url is None:
        machine_logs.append({
            "logs": "App image built, but url is None, unable to parse the url.",
            "timestamp": time.time()
        })
        requests.post(item.callback_url, json={
                      "machine_id": item.machine_id, "build_log": json.dumps(machine_logs)})

        if item.machine_id in machine_logs_cache:
            del machine_logs_cache[item.machine_id]

        return
        # return JSONResponse(status_code=400, content={"error": "App image built, but url is None, unable to parse the url."})
    # example https://bennykok--my-app-comfyui-app.modal.run/
    # my_url = f"https://{MODAL_ORG}--{item.container_id}-{app_suffix}.modal.run"

    requests.post(item.callback_url, json={
                  "machine_id": item.machine_id, "endpoint": url, "build_log": json.dumps(machine_logs)})
    if item.machine_id in machine_logs_cache:
        del machine_logs_cache[item.machine_id]

    logger.info("done")
    logger.info(url)


def start_loop(loop):
    asyncio.set_event_loop(loop)
    loop.run_forever()


def run_in_new_thread(coroutine):
    new_loop = asyncio.new_event_loop()
    t = threading.Thread(target=start_loop, args=(new_loop,), daemon=True)
    t.start()
    asyncio.run_coroutine_threadsafe(coroutine, new_loop)
    return t


if __name__ == "__main__":
    import uvicorn
    # , log_level="debug"
    uvicorn.run("main:app", host="0.0.0.0", port=8080, lifespan="on")
