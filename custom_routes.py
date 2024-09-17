from io import BytesIO
from pprint import pprint
from aiohttp import web
import os
import requests
import folder_paths
import json
import server
from PIL import Image
import time
import execution
import random
import traceback
import uuid
import asyncio
import logging
from urllib.parse import quote
import threading
import hashlib
import aiohttp
from aiohttp import ClientSession, web
import aiofiles
from typing import Dict, List, Union, Any, Optional
from PIL import Image
import copy
import struct
from aiohttp import web, ClientSession, ClientError, ClientTimeout
import atexit

# Global session
# client_session = None

# def create_client_session():
#     global client_session
#     if client_session is None:
#         client_session = aiohttp.ClientSession()
        
# async def ensure_client_session():
#     global client_session
#     if client_session is None:
#         client_session = aiohttp.ClientSession()

# async def cleanup():
#     global client_session
#     if client_session:
#         await client_session.close()
        
def exit_handler():
    print("Exiting the application. Initiating cleanup...")
    # loop = asyncio.get_event_loop()
    # loop.run_until_complete(cleanup())

atexit.register(exit_handler)

max_retries = int(os.environ.get('MAX_RETRIES', '5'))
retry_delay_multiplier = float(os.environ.get('RETRY_DELAY_MULTIPLIER', '2'))

print(f"max_retries: {max_retries}, retry_delay_multiplier: {retry_delay_multiplier}")

import time

async def async_request_with_retry(method, url, disable_timeout=False, token=None, **kwargs):
    # global client_session
    # await ensure_client_session()
    async with aiohttp.ClientSession() as client_session:
        retry_delay = 1  # Start with 1 second delay
        initial_timeout = 5  # 5 seconds timeout for the initial connection

        start_time = time.time()
        for attempt in range(max_retries):
            try:
                if not disable_timeout:
                    timeout = ClientTimeout(total=None, connect=initial_timeout)
                    kwargs['timeout'] = timeout

                if token is not None:
                    if 'headers' not in kwargs:
                        kwargs['headers'] = {}
                    kwargs['headers']['Authorization'] = f"Bearer {token}"

                request_start = time.time()
                async with client_session.request(method, url, **kwargs) as response:
                    request_end = time.time()
                    logger.info(f"Request attempt {attempt + 1} took {request_end - request_start:.2f} seconds")
                    
                    if response.status != 200:
                        error_body = await response.text()
                        logger.error(f"Request failed with status {response.status} and body {error_body}")
                        # raise Exception(f"Request failed with status {response.status}")
                    
                    response.raise_for_status()
                    if method.upper() == 'GET':
                        await response.read()
                    
                    total_time = time.time() - start_time
                    logger.info(f"Request succeeded after {total_time:.2f} seconds (attempt {attempt + 1}/{max_retries})")
                    return response
            except asyncio.TimeoutError:
                logger.warning(f"Request timed out after {initial_timeout} seconds (attempt {attempt + 1}/{max_retries})")
            except ClientError as e:
                end_time = time.time()
                logger.error(f"Request failed (attempt {attempt + 1}/{max_retries}): {e}")
                logger.error(f"Time taken for failed attempt: {end_time - request_start:.2f} seconds")
                logger.error(f"Total time elapsed: {end_time - start_time:.2f} seconds")
                
                # Log the response body for ClientError as well
                if hasattr(e, 'response') and e.response is not None:
                    error_body = await e.response.text()
                    logger.error(f"Error response body: {error_body}")
                
                if attempt == max_retries - 1:
                    logger.error(f"Request failed after {max_retries} attempts: {e}")
                    raise
            
            await asyncio.sleep(retry_delay)
            retry_delay *= retry_delay_multiplier

        total_time = time.time() - start_time
        raise Exception(f"Request failed after {max_retries} attempts and {total_time:.2f} seconds")

from logging import basicConfig, getLogger

# Check for an environment variable to enable/disable Logfire
use_logfire = os.environ.get('USE_LOGFIRE', 'false').lower() == 'true'

if use_logfire:
    try:
        import logfire
        logfire.configure(
            send_to_logfire="if-token-present"
        )
        logger = logfire
    except ImportError:
        print("Logfire not installed or disabled. Using standard Python logger.")
        use_logfire = False

if not use_logfire:
    # Use a standard Python logger when Logfire is disabled or not available
    logger = getLogger("comfy-deploy")
    basicConfig(level="INFO")  # You can adjust the logging level as needed

def log(level, message, **kwargs):
    if use_logfire:
        getattr(logger, level)(message, **kwargs)
    else:
        getattr(logger, level)(f"{message} {kwargs}")
        
# For a span, you might need to create a context manager
from contextlib import contextmanager

@contextmanager
def log_span(name):
    if use_logfire:
        with logger.span(name):
            yield
    else:
        yield
    #     logger.info(f"Start: {name}")
    #     yield
    #     logger.info(f"End: {name}")


from globals import StreamingPrompt, Status, sockets, SimplePrompt, streaming_prompt_metadata, prompt_metadata

class EventEmitter:
    def __init__(self):
        self.listeners = {}

    def on(self, event, listener):
        if event not in self.listeners:
            self.listeners[event] = []
        self.listeners[event].append(listener)

    def off(self, event, listener):
        if event in self.listeners:
            self.listeners[event].remove(listener)
            if not self.listeners[event]:
                del self.listeners[event]

    def emit(self, event, *args, **kwargs):
        if event in self.listeners:
            for listener in self.listeners[event]:
                listener(*args, **kwargs)

# Create a global event emitter instance
event_emitter = EventEmitter()

api = None
api_task = None

cd_enable_log = os.environ.get('CD_ENABLE_LOG', 'false').lower() == 'true'
cd_enable_run_log = os.environ.get('CD_ENABLE_RUN_LOG', 'false').lower() == 'true'
bypass_upload = os.environ.get('CD_BYPASS_UPLOAD', 'false').lower() == 'true'

logger.info(f"CD_BYPASS_UPLOAD {bypass_upload}")


def clear_current_prompt(sid):
    prompt_server = server.PromptServer.instance
    to_delete = list(streaming_prompt_metadata[sid].running_prompt_ids)  # Convert set to list

    logger.info(f"clearing out prompt: {to_delete}")
    for id_to_delete in to_delete:
        delete_func = lambda a: a[1] == id_to_delete
        prompt_server.prompt_queue.delete_queue_item(delete_func)
        logger.info(f"deleted prompt: {id_to_delete}, remaining tasks: {prompt_server.prompt_queue.get_tasks_remaining()}")

    streaming_prompt_metadata[sid].running_prompt_ids.clear()

def post_prompt(json_data):
    prompt_server = server.PromptServer.instance
    json_data = prompt_server.trigger_on_prompt(json_data)

    if "number" in json_data:
        number = float(json_data["number"])
    else:
        number = prompt_server.number
        if "front" in json_data:
            if json_data["front"]:
                number = -number

        prompt_server.number += 1

    if "prompt" in json_data:
        prompt = json_data["prompt"]
        valid = execution.validate_prompt(prompt)
        extra_data = {}
        if "extra_data" in json_data:
            extra_data = json_data["extra_data"]

        if "client_id" in json_data:
            extra_data["client_id"] = json_data["client_id"]
        if valid[0]:
            # if the prompt id is provided
            prompt_id = json_data.get("prompt_id") or str(uuid.uuid4())
            outputs_to_execute = valid[2]
            prompt_server.prompt_queue.put(
                (number, prompt_id, prompt, extra_data, outputs_to_execute)
            )
            response = {
                "prompt_id": prompt_id,
                "number": number,
                "node_errors": valid[3],
            }
            return response
        else:
            logger.info("invalid prompt:", valid[1])
            return {"error": valid[1], "node_errors": valid[3]}
    else:
        return {"error": "no prompt", "node_errors": []}

def randomSeed(num_digits=15):
    range_start = 10 ** (num_digits - 1)
    range_end = (10**num_digits) - 1
    return random.randint(range_start, range_end)

def apply_random_seed_to_workflow(workflow_api):
    """
    Applies a random seed to each element in the workflow_api that has a 'seed' input.

    Args:
        workflow_api (dict): The workflow API dictionary to modify.
    """
    for key in workflow_api:
        if 'inputs' in workflow_api[key]:
            if 'seed' in workflow_api[key]['inputs']:
                if isinstance(workflow_api[key]['inputs']['seed'], list):
                    continue
                if workflow_api[key]['class_type'] == "PromptExpansion":
                    workflow_api[key]['inputs']['seed'] = randomSeed(8)
                    logger.info(f"Applied random seed {workflow_api[key]['inputs']['seed']} to PromptExpansion")
                    continue
                workflow_api[key]['inputs']['seed'] = randomSeed()
                logger.info(f"Applied random seed {workflow_api[key]['inputs']['seed']} to {workflow_api[key]['class_type']}")

            if 'noise_seed' in workflow_api[key]['inputs']:
                if workflow_api[key]['class_type'] == "RandomNoise":
                    workflow_api[key]['inputs']['noise_seed'] = randomSeed()
                    logger.info(f"Applied random noise_seed {workflow_api[key]['inputs']['noise_seed']} to RandomNoise")
                    continue
                if workflow_api[key]['class_type'] == "KSamplerAdvanced":
                    workflow_api[key]['inputs']['noise_seed'] = randomSeed()
                    logger.info(f"Applied random noise_seed {workflow_api[key]['inputs']['noise_seed']} to KSamplerAdvanced")
                    continue
                if workflow_api[key]['class_type'] == "SamplerCustom":
                    workflow_api[key]['inputs']['noise_seed'] = randomSeed()
                    logger.info(f"Applied random noise_seed {workflow_api[key]['inputs']['noise_seed']} to SamplerCustom")
                    continue

def apply_inputs_to_workflow(workflow_api: Any, inputs: Any, sid: str = None):
    # Loop through each of the inputs and replace them
    for key, value in workflow_api.items():
        if 'inputs' in value:

            # Support websocket
            if sid is not None:
                if (value["class_type"] == "ComfyDeployWebscoketImageOutput"):
                    value['inputs']["client_id"] = sid
                if (value["class_type"] == "ComfyDeployWebscoketImageInput"):
                    value['inputs']["client_id"] = sid

            if "input_id" in value['inputs'] and inputs is not None and value['inputs']['input_id'] in inputs:
                new_value = inputs[value['inputs']['input_id']]

                # Lets skip it if its an image
                if isinstance(new_value, Image.Image):
                    continue

                # Backward compactibility
                value['inputs']["input_id"] = new_value

                # Fix for external text default value
                if (value["class_type"] == "ComfyUIDeployExternalText"):
                    value['inputs']["default_value"] = new_value

                if (value["class_type"] == "ComfyUIDeployExternalCheckpoint"):
                    value['inputs']["default_value"] = new_value

                if (value["class_type"] == "ComfyUIDeployExternalImageBatch"):
                    value['inputs']["images"] = new_value

                if value["class_type"] == "ComfyUIDeployExternalLora":
                    value["inputs"]["lora_url"] = new_value

                if value["class_type"] == "ComfyUIDeployExternalSlider":
                    value["inputs"]["default_value"] = new_value

                if value["class_type"] == "ComfyUIDeployExternalBoolean":
                    value["inputs"]["default_value"] = new_value

def send_prompt(sid: str, inputs: StreamingPrompt):
    # workflow_api = inputs.workflow_api
    workflow_api = copy.deepcopy(inputs.workflow_api)

    # Random seed
    apply_random_seed_to_workflow(workflow_api)

    logger.info("getting inputs" , inputs.inputs)

    apply_inputs_to_workflow(workflow_api, inputs.inputs, sid=sid)

    logger.info(workflow_api)

    prompt_id = str(uuid.uuid4())

    prompt = {
        "prompt": workflow_api,
        "client_id": sid, #"comfy_deploy_instance", #api.client_id
        "prompt_id": prompt_id
    }

    try:
        res = post_prompt(prompt)
        inputs.running_prompt_ids.add(prompt_id)
        prompt_metadata[prompt_id] = SimplePrompt(
            status_endpoint=inputs.status_endpoint,
            file_upload_endpoint=inputs.file_upload_endpoint,
            workflow_api=workflow_api,
            is_realtime=True
        )
    except Exception as e:
        error_type = type(e).__name__
        stack_trace_short = traceback.format_exc().strip().split('\n')[-2]
        stack_trace = traceback.format_exc().strip()
        logger.info(f"error: {error_type}, {e}")
        logger.info(f"stack trace: {stack_trace_short}")

@server.PromptServer.instance.routes.post("/comfyui-deploy/run")
async def comfy_deploy_run(request):
    # Extract the bearer token from the Authorization header
    auth_header = request.headers.get('Authorization')
    token = None
    if auth_header:
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() == 'bearer':
            token = parts[1]

    data = await request.json()

    # In older version, we use workflow_api, but this has inputs already swapped in nextjs frontend, which is tricky
    workflow_api = data.get("workflow_api_raw")
    # The prompt id generated from comfy deploy, can be None
    prompt_id = data.get("prompt_id")
    inputs = data.get("inputs")

    # Now it handles directly in here
    apply_random_seed_to_workflow(workflow_api)
    apply_inputs_to_workflow(workflow_api, inputs)

    prompt = {
        "prompt": workflow_api,
        "client_id": "comfy_deploy_instance", #api.client_id
        "prompt_id": prompt_id,
    }

    prompt_metadata[prompt_id] = SimplePrompt(
        status_endpoint=data.get('status_endpoint'),
        file_upload_endpoint=data.get('file_upload_endpoint'),
        workflow_api=workflow_api,
        token=token
    )

    try:
        res = post_prompt(prompt)
    except Exception as e:
        error_type = type(e).__name__
        stack_trace_short = traceback.format_exc().strip().split('\n')[-2]
        stack_trace = traceback.format_exc().strip()
        logger.info(f"error: {error_type}, {e}")
        logger.info(f"stack trace: {stack_trace_short}")
        await update_run_with_output(prompt_id, {
            "error": {
                "error_type": error_type,
                "stack_trace": stack_trace
            }
        })
         # When there are critical errors, the prompt is actually not run
        await update_run(prompt_id, Status.FAILED)
        return web.Response(status=500, reason=f"{error_type}: {e}, {stack_trace_short}")

    status = 200

    if "node_errors" in res and res["node_errors"] is not None and len(res["node_errors"]) > 0:
        # Even tho there are node_errors it can still be run
        status = 400
        await update_run_with_output(prompt_id, {
            "error": {
                **res
            }
        })

        # When there are critical errors, the prompt is actually not run
        if "error" in res:
            await update_run(prompt_id, Status.FAILED)

    return web.json_response(res, status=status)

async def stream_prompt(data, token):
    # In older version, we use workflow_api, but this has inputs already swapped in nextjs frontend, which is tricky
    workflow_api = data.get("workflow_api_raw")
    # The prompt id generated from comfy deploy, can be None
    prompt_id = data.get("prompt_id")
    inputs = data.get("inputs")

    # Now it handles directly in here
    apply_random_seed_to_workflow(workflow_api)
    apply_inputs_to_workflow(workflow_api, inputs)

    prompt = {
        "prompt": workflow_api,
        "client_id": "comfy_deploy_instance", #api.client_id
        "prompt_id": prompt_id
    }

    prompt_metadata[prompt_id] = SimplePrompt(
        status_endpoint=data.get('status_endpoint'),
        file_upload_endpoint=data.get('file_upload_endpoint'),
        workflow_api=workflow_api,
        token=token
    )

    # log('info', "Begin prompt", prompt=prompt)

    try:
        res = post_prompt(prompt)
    except Exception as e:
        error_type = type(e).__name__
        stack_trace_short = traceback.format_exc().strip().split('\n')[-2]
        stack_trace = traceback.format_exc().strip()
        logger.info(f"error: {error_type}, {e}")
        logger.info(f"stack trace: {stack_trace_short}")
        await update_run_with_output(prompt_id, {
            "error": {
                "error_type": error_type,
                "stack_trace": stack_trace
            }
        })
         # When there are critical errors, the prompt is actually not run
        await update_run(prompt_id, Status.FAILED)
        # return web.Response(status=500, reason=f"{error_type}: {e}, {stack_trace_short}")
        # raise Exception("Prompt failed")

    status = 200

    if "node_errors" in res and res["node_errors"] is not None and len(res["node_errors"]) > 0:
        # Even tho there are node_errors it can still be run
        status = 400
        await update_run_with_output(prompt_id, {
            "error": {
                **res
            }
        })

        # When there are critical errors, the prompt is actually not run
        if "error" in res:
            await update_run(prompt_id, Status.FAILED)
            # raise Exception("Prompt failed")

    return res
    # return web.json_response(res, status=status)

comfy_message_queues: Dict[str, asyncio.Queue] = {}

@server.PromptServer.instance.routes.post('/comfyui-deploy/run/streaming')
async def stream_response(request):
    response = web.StreamResponse(status=200, reason='OK', headers={'Content-Type': 'text/event-stream'})
    await response.prepare(request)
    
    # Extract the bearer token from the Authorization header
    auth_header = request.headers.get('Authorization')
    token = None
    if auth_header:
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() == 'bearer':
            token = parts[1]

    pending = True
    data = await request.json()

    prompt_id = data.get("prompt_id")
    comfy_message_queues[prompt_id] = asyncio.Queue()

    with log_span('Streaming Run'):
        log('info', 'Streaming prompt')

        try:
            result = await stream_prompt(data=data, token=token)
            await response.write(f"event: event_update\ndata: {json.dumps(result)}\n\n".encode('utf-8'))
            # await response.write(.encode('utf-8'))
            await response.drain()  # Ensure the buffer is flushed

            while pending:
                if prompt_id in comfy_message_queues:
                    if not comfy_message_queues[prompt_id].empty():
                        data = await comfy_message_queues[prompt_id].get()

                        # log('info', data["event"], data=json.dumps(data))
                        # logger.info("listener", data)
                        await response.write(f"event: event_update\ndata: {json.dumps(data)}\n\n".encode('utf-8'))
                        await response.drain()  # Ensure the buffer is flushed

                        if data["event"] == "status":
                            if data["data"]["status"] in (Status.FAILED.value, Status.SUCCESS.value):
                                pending = False

                await asyncio.sleep(0.1)  # Adjust the sleep duration as needed
        except asyncio.CancelledError:
            log('info', "Streaming was cancelled")
            raise
        except Exception as e:
            log('error', "Streaming error", error=e)
        finally:
            # event_emitter.off("send_json", task)
            await response.write_eof()
            comfy_message_queues.pop(prompt_id, None)
            return response

def get_comfyui_path_from_file_path(file_path):
    file_path_parts = file_path.split("\\")

    if file_path_parts[0] == "input":
        logger.info("matching input")
        file_path = os.path.join(folder_paths.get_directory_by_type("input"), *file_path_parts[1:])
    elif file_path_parts[0] == "models":
        logger.info("matching models")
        file_path = folder_paths.get_full_path(file_path_parts[1], os.path.join(*file_path_parts[2:]))

    logger.info(file_path)

    return file_path

# Form ComfyUI Manager
async def compute_sha256_checksum(filepath):
    logger.info("computing sha256 checksum")
    chunk_size = 1024 * 256  # Example: 256KB
    filepath = get_comfyui_path_from_file_path(filepath)
    """Compute the SHA256 checksum of a file, in chunks, asynchronously"""
    sha256 = hashlib.sha256()
    async with aiofiles.open(filepath, 'rb') as f:
        while True:
            chunk = await f.read(chunk_size)
            if not chunk:
                break
            sha256.update(chunk)
    return sha256.hexdigest()

@server.PromptServer.instance.routes.get('/comfyui-deploy/models')
async def get_installed_models(request):
    # Directly return the list of paths as JSON
    new_dict = {}
    for key, value in folder_paths.folder_names_and_paths.items():
        # Convert set to list for JSON compatibility
        # for path in value[0]:
        file_list = folder_paths.get_filename_list(key)
        value_json_compatible = (value[0], list(value[1]), file_list)
        new_dict[key] = value_json_compatible
    # logger.info(new_dict)
    return web.json_response(new_dict)

# This is start uploading the files to Comfy Deploy
@server.PromptServer.instance.routes.post('/comfyui-deploy/upload-file')
async def upload_file_endpoint(request):
    data = await request.json()

    file_path = data.get("file_path")

    logger.info("Original file path", file_path)

    file_path = get_comfyui_path_from_file_path(file_path)

    # return web.json_response({
    #     "error": f"File not uploaded"
    # }, status=500)

    token = data.get("token")
    get_url = data.get("url")

    try:
        base = folder_paths.base_path
        file_path = os.path.join(base, file_path)

        if os.path.exists(file_path):
            file_size = os.path.getsize(file_path)
            file_extension = os.path.splitext(file_path)[1]

            if file_extension in ['.jpg', '.jpeg']:
                file_type = 'image/jpeg'
            elif file_extension == '.png':
                file_type = 'image/png'
            elif file_extension == '.webp':
                file_type = 'image/webp'
            else:
                file_type = 'application/octet-stream'  # Default to binary file type if unknown
        else:
            return web.json_response({
                "error": f"File not found: {file_path}"
            }, status=404)

    except Exception as e:
        return web.json_response({
            "error": str(e)
        }, status=500)

    if get_url:
        try:
            headers = {'Authorization': f'Bearer {token}'}
            params = {'file_size': file_size, 'type': file_type}
            response = await async_request_with_retry('GET', get_url, params=params, headers=headers)
            if response.status == 200:
                content = await response.json()
                upload_url = content["upload_url"]

                with open(file_path, 'rb') as f:
                    headers = {
                        "Content-Type": file_type,
                        # "Content-Length": str(file_size)
                    }
                    if content.get('include_acl') is True:
                        headers["x-amz-acl"] = "public-read"
                    upload_response = await async_request_with_retry('PUT', upload_url, data=f, headers=headers)
                    if upload_response.status == 200:
                        return web.json_response({
                            "message": "File uploaded successfully",
                            "download_url": content["download_url"]
                        })
                    else:
                        return web.json_response({
                            "error": f"Failed to upload file to {upload_url}. Status code: {upload_response.status}"
                        }, status=upload_response.status)
            else:
                return web.json_response({
                    "error": f"Failed to fetch data from {get_url}. Status code: {response.status}"
                }, status=response.status)
        except Exception as e:
            return web.json_response({
                "error": f"An error occurred while fetching data from {get_url}: {str(e)}"
            }, status=500)

    return web.json_response({
        "error": f"File not uploaded"
    }, status=500)


script_dir = os.path.dirname(os.path.abspath(__file__))
# Assuming the cache file is stored in the same directory as this script
CACHE_FILE_PATH = script_dir + '/file-hash-cache.json'

# Global in-memory cache
file_hash_cache = {}

# Load cache from disk at startup
def load_cache():
    global file_hash_cache
    try:
        with open(CACHE_FILE_PATH, 'r') as cache_file:
            file_hash_cache = json.load(cache_file)
    except (FileNotFoundError, json.JSONDecodeError):
        file_hash_cache = {}

# Save cache to disk
def save_cache():
    with open(CACHE_FILE_PATH, 'w') as cache_file:
        json.dump(file_hash_cache, cache_file)

# Initialize cache on application start
load_cache()

@server.PromptServer.instance.routes.get('/comfyui-deploy/get-file-hash')
async def get_file_hash(request):
    file_path = request.rel_url.query.get('file_path', '')

    if not file_path:
        return web.json_response({
            "error": "file_path is required"
        }, status=400)

    try:
        base = folder_paths.base_path
        full_file_path = os.path.join(base, file_path)

        # Check if the file hash is in the cache
        if full_file_path in file_hash_cache:
            file_hash = file_hash_cache[full_file_path]
        else:
            start_time = time.time()
            file_hash = await compute_sha256_checksum(full_file_path)
            end_time = time.time()
            elapsed_time = end_time - start_time
            logger.info(f"Cache miss -> Execution time: {elapsed_time} seconds")

            # Update the in-memory cache
            file_hash_cache[full_file_path] = file_hash

            save_cache()

        return web.json_response({
            "file_hash": file_hash
        })
    except Exception as e:
        return web.json_response({
            "error": str(e)
        }, status=500)

async def update_realtime_run_status(realtime_id: str, status_endpoint: str, status: Status):
    body = {
        "run_id": realtime_id,
        "status": status.value,
    }
    if (status_endpoint is None):
        return
    # requests.post(status_endpoint, json=body)
    await async_request_with_retry('POST', status_endpoint, json=body)

@server.PromptServer.instance.routes.get('/comfyui-deploy/ws')
async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    sid = request.rel_url.query.get('clientId', '')
    if sid:
        # Reusing existing session, remove old
        sockets.pop(sid, None)
    else:
        sid = uuid.uuid4().hex

    sockets[sid] = ws

    auth_token = request.rel_url.query.get('token', None)
    get_workflow_endpoint_url = request.rel_url.query.get('workflow_endpoint', None)
    realtime_id = request.rel_url.query.get('realtime_id', None)
    status_endpoint = request.rel_url.query.get('status_endpoint', None)

    if auth_token is not None and get_workflow_endpoint_url is not None:
        headers = {'Authorization': f'Bearer {auth_token}'}
        response = await async_request_with_retry('GET', get_workflow_endpoint_url, headers=headers)
        if response.status == 200:
            workflow = await response.json()

            logger.info(f"Loaded workflow version ${workflow['version']}")

            streaming_prompt_metadata[sid] = StreamingPrompt(
                workflow_api=workflow["workflow_api"],
                auth_token=auth_token,
                inputs={},
                status_endpoint=status_endpoint,
                file_upload_endpoint=request.rel_url.query.get('file_upload_endpoint', None),
            )

            await update_realtime_run_status(realtime_id, status_endpoint, Status.RUNNING)
            # await send("workflow_api", workflow_api, sid)
        else:
            error_message = await response.text()
            logger.info(f"Failed to fetch workflow endpoint. Status: {response.status}, Error: {error_message}")
            # await send("error", {"message": error_message}, sid)

    try:
        # Send initial state to the new client
        await send("status", { 'sid': sid }, sid)

        # Make sure when its connected via client, the full log is not being sent
        if cd_enable_log and get_workflow_endpoint_url is None:
            await send_first_time_log(sid)

        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                    logger.info(data)
                    event_type = data.get('event')
                    if event_type == 'input':
                        logger.info(f"Got input: ${data.get('inputs')}")
                        input = data.get('inputs')
                        streaming_prompt_metadata[sid].inputs.update(input)
                    elif event_type == 'queue_prompt':
                        clear_current_prompt(sid)
                        send_prompt(sid, streaming_prompt_metadata[sid])
                    else:
                        # Handle other event types
                        pass
                except json.JSONDecodeError:
                    logger.info('Failed to decode JSON from message')

            if msg.type == aiohttp.WSMsgType.BINARY:
                data = msg.data
                event_type, = struct.unpack("<I", data[:4])
                if event_type == 0:  # Image input
                    image_type_code, = struct.unpack("<I", data[4:8])
                    input_id_bytes = data[8:32]  # Extract the next 24 bytes for the input ID
                    input_id = input_id_bytes.decode('ascii').strip()  # Decode the input ID from ASCII
                    logger.info(event_type)
                    logger.info(image_type_code)
                    logger.info(input_id)
                    image_data = data[32:]  # The rest is the image data
                    if image_type_code == 1:
                        image_type = "JPEG"
                    elif image_type_code == 2:
                        image_type = "PNG"
                    elif image_type_code == 3:
                        image_type = "WEBP"
                    else:
                        logger.info(f"Unknown image type code: ${image_type_code}")
                        return
                    image = Image.open(BytesIO(image_data))
                    # Check if the input ID already exists and replace the input with the new one
                    if input_id in streaming_prompt_metadata[sid].inputs:
                        # If the input exists, we assume it's an image and attempt to close it to free resources
                        try:
                            existing_image = streaming_prompt_metadata[sid].inputs[input_id]
                            if hasattr(existing_image, 'close'):
                                existing_image.close()
                        except Exception as e:
                            logger.info(f"Error closing previous image for input ID {input_id}: {e}")
                    streaming_prompt_metadata[sid].inputs[input_id] = image
                    # clear_current_prompt(sid)
                    # send_prompt(sid, streaming_prompt_metadata[sid])
                    logger.info(f"Received {image_type} image of size {image.size} with input ID {input_id}")

            if msg.type == aiohttp.WSMsgType.ERROR:
                logger.info('ws connection closed with exception %s' % ws.exception())
    finally:
        sockets.pop(sid, None)

        if realtime_id is not None:
            await update_realtime_run_status(realtime_id, status_endpoint, Status.SUCCESS)
    return ws

@server.PromptServer.instance.routes.get('/comfyui-deploy/check-status')
async def comfy_deploy_check_status(request):
    prompt_id = request.rel_url.query.get('prompt_id', None)
    if prompt_id in prompt_metadata:
        return web.json_response({
            "status": prompt_metadata[prompt_id].status.value
        })
    else:
        return web.json_response({
            "message": "prompt_id not found"
        })

@server.PromptServer.instance.routes.get('/comfyui-deploy/check-ws-status')
async def comfy_deploy_check_ws_status(request):
    client_id = request.rel_url.query.get('client_id', None)
    if client_id in streaming_prompt_metadata:
        remaining_queue = 0  # Initialize remaining queue count
        for prompt_id in streaming_prompt_metadata[client_id].running_prompt_ids:
            prompt_status = prompt_metadata[prompt_id].status
            if prompt_status not in [Status.FAILED, Status.SUCCESS]:
                remaining_queue += 1  # Increment for each prompt still running
        return web.json_response({"remaining_queue": remaining_queue})
    else:
        return web.json_response({"message": "client_id not found"}, status=404)

async def send(event, data, sid=None):
    try:
        # message = {"event": event, "data": data}
        if sid:
            ws = sockets.get(sid)
            if ws != None and not ws.closed:  # Check if the WebSocket connection is open and not closing
                await ws.send_json({ 'event': event, 'data': data })
        else:
            for ws in sockets.values():
                if not ws.closed:  # Check if the WebSocket connection is open and not closing
                    await ws.send_json({ 'event': event, 'data': data })
    except Exception as e:
        logger.info(f"Exception: {e}")
        traceback.print_exc()
        
@server.PromptServer.instance.routes.get('/comfydeploy/{tail:.*}')
@server.PromptServer.instance.routes.post('/comfydeploy/{tail:.*}')
async def proxy_to_comfydeploy(request):
    # Get the base URL
    base_url = f'https://www.comfydeploy.com/{request.match_info["tail"]}'
    
    # Get all query parameters
    query_params = request.query_string
    
    # Construct the full target URL with query parameters
    target_url = f"{base_url}?{query_params}" if query_params else base_url
    
    # print(f"Proxying request to: {target_url}")

    try:
        # Create a new ClientSession for each request
        async with ClientSession() as client_session:
            # Forward the request
            client_req = await client_session.request(
                method=request.method,
                url=target_url,
                headers={k: v for k, v in request.headers.items() if k.lower() not in ('host', 'content-length')},
                data=await request.read(),
                allow_redirects=False,
            )

            # Read the entire response content
            content = await client_req.read()

            # Try to decode the content as JSON
            try:
                json_data = json.loads(content)
                # If successful, return a JSON response
                return web.json_response(json_data, status=client_req.status)
            except json.JSONDecodeError:
                # If it's not valid JSON, return the content as-is
                return web.Response(body=content, status=client_req.status, headers=client_req.headers)

    except ClientError as e:
        print(f"Client error occurred while proxying request: {str(e)}")
        return web.Response(status=502, text=f"Bad Gateway: {str(e)}")
    except Exception as e:
        print(f"Error occurred while proxying request: {str(e)}")
        return web.Response(status=500, text=f"Internal Server Error: {str(e)}")


prompt_server = server.PromptServer.instance
send_json = prompt_server.send_json

async def send_json_override(self, event, data, sid=None):
    # logger.info("INTERNAL:", event, data, sid)
    prompt_id = data.get('prompt_id')

    target_sid = sid
    if target_sid == "comfy_deploy_instance":
        target_sid = None

    # now we send everything
    await asyncio.wait([
        asyncio.create_task(send(event, data, sid=target_sid)),
        asyncio.create_task(self.send_json_original(event, data, sid))
    ])

    if prompt_id in comfy_message_queues:
        comfy_message_queues[prompt_id].put_nowait({
            "event": event,
            "data": data
        })

    asyncio.create_task(update_run_ws_event(prompt_id, event, data))
    # event_emitter.emit("send_json", {
    #     "event": event,
    #     "data": data
    # })

    if event == 'execution_start':
        await update_run(prompt_id, Status.RUNNING)

        if prompt_id in prompt_metadata:
            prompt_metadata[prompt_id].start_time = time.perf_counter()

    # the last executing event is none, then the workflow is finished
    if event == 'executing' and data.get('node') is None:
        mark_prompt_done(prompt_id=prompt_id)
        if not have_pending_upload(prompt_id):
            await update_run(prompt_id, Status.SUCCESS)
            if prompt_id in prompt_metadata:
                current_time = time.perf_counter()
                if prompt_metadata[prompt_id].start_time is not None:
                    elapsed_time = current_time - prompt_metadata[prompt_id].start_time
                    logger.info(f"Elapsed time: {elapsed_time} seconds")
                    await send("elapsed_time", {
                        "prompt_id": prompt_id,
                        "elapsed_time": elapsed_time
                    }, sid=sid)

    if event == 'executing' and data.get('node') is not None:
        node = data.get('node')

        if prompt_id in prompt_metadata:
            # if 'progress' not in prompt_metadata[prompt_id]:
            #     prompt_metadata[prompt_id]["progress"] = set()

            prompt_metadata[prompt_id].progress.add(node)
            calculated_progress = len(prompt_metadata[prompt_id].progress) / len(prompt_metadata[prompt_id].workflow_api)
            calculated_progress = round(calculated_progress, 2)
            # logger.info("calculated_progress", calculated_progress)

            if prompt_metadata[prompt_id].last_updated_node is not None and prompt_metadata[prompt_id].last_updated_node == node:
                return
            prompt_metadata[prompt_id].last_updated_node = node
            class_type = prompt_metadata[prompt_id].workflow_api[node]['class_type']
            logger.info(f"At: {calculated_progress * 100}% - {class_type}")
            await send("live_status", {
                "prompt_id": prompt_id,
                "current_node": class_type,
                "progress": calculated_progress,
            }, sid=sid)
            await update_run_live_status(prompt_id, "Executing " + class_type, calculated_progress)

    if event == 'execution_cached' and data.get('nodes') is not None:
        if prompt_id in prompt_metadata:
            # if 'progress' not in prompt_metadata[prompt_id]:
            #     prompt_metadata[prompt_id].progress = set()

            if 'nodes' in data:
                for node in data.get('nodes', []):
                    prompt_metadata[prompt_id].progress.add(node)
            # prompt_metadata[prompt_id]["progress"].update(data.get('nodes'))

    if event == 'execution_error':
        # Careful this might not be fully awaited.
        await update_run_with_output(prompt_id, data)
        await update_run(prompt_id, Status.FAILED)
        # await update_run_with_output(prompt_id, data)

    if event == 'executed' and 'node' in data and 'output' in data:
        node_meta = None
        if prompt_id in prompt_metadata:
            node = data.get('node')
            class_type = prompt_metadata[prompt_id].workflow_api[node]['class_type']
            logger.info(f"Executed {class_type} {data}")
            node_meta = {
                "node_id": node,
                "node_class": class_type, 
            }
            if class_type == "PreviewImage":
                logger.info("Skipping preview image")
                return
        else:
            logger.info(f"Executed {data}")
            
        await update_run_with_output(prompt_id, data.get('output'), node_id=data.get('node'), node_meta=node_meta)
        # await update_run_with_output(prompt_id, data.get('output'), node_id=data.get('node'))
        # update_run_with_output(prompt_id, data.get('output'))

# Global variable to keep track of the last read line number
last_read_line_number = 0

async def update_run_live_status(prompt_id, live_status, calculated_progress: float):
    if prompt_id not in prompt_metadata:
        return

    if prompt_metadata[prompt_id].is_realtime is True:
        return

    status_endpoint = prompt_metadata[prompt_id].status_endpoint
    token = prompt_metadata[prompt_id].token

    if (status_endpoint is None):
        return

    # logger.info(f"progress {calculated_progress}")

    body = {
        "run_id": prompt_id,
        "live_status": live_status,
        "progress": calculated_progress
    }

    if prompt_id in comfy_message_queues:
        comfy_message_queues[prompt_id].put_nowait({
            "event": "live_status",
            "data": {
                "prompt_id": prompt_id,
                "live_status": live_status,
                "progress": calculated_progress
            }
        })

    # requests.post(status_endpoint, json=body)
    await async_request_with_retry('POST', status_endpoint, token=token, json=body)

async def update_run_ws_event(prompt_id: str, event: str, data: dict):
    if prompt_id not in prompt_metadata:
        return
    
    # print("update_run_ws_event", prompt_id, event, data)
    status_endpoint = prompt_metadata[prompt_id].status_endpoint
    
    if status_endpoint is None:
        return
    
    token = prompt_metadata[prompt_id].token
    body = {
        "run_id": prompt_id,
        "ws_event": {
            "event": event,
            "data": data,
        },
    }
    await async_request_with_retry('POST', status_endpoint, token=token, json=body)


async def update_run(prompt_id: str, status: Status):
    global last_read_line_number

    if prompt_id not in prompt_metadata:
        return

    # if prompt_metadata[prompt_id].start_time is None and status == Status.RUNNING:
    # if its realtime prompt we need to skip that.
    if prompt_metadata[prompt_id].is_realtime is True:
        prompt_metadata[prompt_id].status = status
        return

    if (prompt_metadata[prompt_id].status != status):

        # when the status is already failed, we don't want to update it to success
        if (prompt_metadata[prompt_id].status is Status.FAILED):
            return

        status_endpoint = prompt_metadata[prompt_id].status_endpoint
        body = {
            "run_id": prompt_id,
            "status": status.value,
        }
        logger.info(f"Status: {status.value}")

        try:
            # requests.post(status_endpoint, json=body)
            if (status_endpoint is not None):
                token = prompt_metadata[prompt_id].token
                await async_request_with_retry('POST', status_endpoint, token=token, json=body)

            if (status_endpoint is not None) and cd_enable_run_log and (status == Status.SUCCESS or status == Status.FAILED):
                try:
                    with open(comfyui_file_path, 'r') as log_file:
                        # log_data = log_file.read()
                        # Move to the last read line
                        all_log_data = log_file.read()  # Read all log data
                        # logger.info("All log data before skipping: ")  # Log all data before skipping
                        log_file.seek(0)  # Reset file pointer to the beginning

                        for _ in range(last_read_line_number):
                            next(log_file)
                        log_data = log_file.read()
                        # Update the last read line number
                        last_read_line_number += log_data.count('\n')
                        # logger.info("last_read_line_number", last_read_line_number)
                        # logger.info("log_data", log_data)
                        # logger.info("log_data.count(n)", log_data.count('\n'))

                        body = {
                            "run_id": prompt_id,
                            "log_data": [
                                {
                                    "logs": log_data,
                                    # "timestamp": time.time(),
                                }
                            ]
                        }

                        await async_request_with_retry('POST', status_endpoint, token=token, json=body)
                        # requests.post(status_endpoint, json=body)
                except Exception as log_error:
                    logger.info(f"Error reading log file: {log_error}")

        except Exception as e:
            error_type = type(e).__name__
            stack_trace = traceback.format_exc().strip()
            logger.info(f"Error occurred while updating run: {e} {stack_trace}")
        finally:
            prompt_metadata[prompt_id].status = status
            if prompt_id in comfy_message_queues:
                comfy_message_queues[prompt_id].put_nowait({
                    "event": "status",
                    "data": {
                        "prompt_id": prompt_id,
                        "status": status.value,
                    }
                })


async def upload_file(prompt_id, filename, subfolder=None, content_type="image/png", type="output", item=None):
    """
    Uploads file to S3 bucket using S3 client object
    :return: None
    """
    filename,output_dir = folder_paths.annotated_filepath(filename)

    # validation for security: prevent accessing arbitrary path
    if filename[0] == '/' or '..' in filename:
        return

    if output_dir is None:
        output_dir = folder_paths.get_directory_by_type(type)

    if output_dir is None:
        logger.info(f"{filename} Upload failed: output_dir is None")
        return

    if subfolder != None:
        full_output_dir = os.path.join(output_dir, subfolder)
        if os.path.commonpath((os.path.abspath(full_output_dir), output_dir)) != output_dir:
            return
        output_dir = full_output_dir

    filename = os.path.basename(filename)
    file = os.path.join(output_dir, filename)

    logger.info(f"Uploading file {file}")

    file_upload_endpoint = prompt_metadata[prompt_id].file_upload_endpoint
    token = prompt_metadata[prompt_id].token
    filename = quote(filename)
    prompt_id = quote(prompt_id)
    content_type = quote(content_type)

    async with aiofiles.open(file, 'rb') as f:
        data = await f.read()
        size = str(len(data))
        target_url = f"{file_upload_endpoint}?file_name={filename}&run_id={prompt_id}&type={content_type}&version=v2"

        start_time = time.time()  # Start timing here
        logger.info(f"Target URL: {target_url}")
        result = await async_request_with_retry("GET", target_url, disable_timeout=True, token=token)
        end_time = time.time()  # End timing after the request is complete
        logger.info("Time taken for getting file upload endpoint: {:.2f} seconds".format(end_time - start_time))
        ok = await result.json()
        
        logger.info(f"Result: {ok}")

        start_time = time.time()  # Start timing here
        headers = {
            "Content-Type": content_type,
            # "Content-Length": size,
        }
        
        if ok.get('include_acl') is True:
            headers["x-amz-acl"] = "public-read"
        
        # response = requests.put(ok.get("url"), headers=headers, data=data)
        response = await async_request_with_retry('PUT', ok.get("url"), headers=headers, data=data)
        logger.info(f"Upload file response status: {response.status}, status text: {response.reason}")
        end_time = time.time()  # End timing after the request is complete
        logger.info("Upload time: {:.2f} seconds".format(end_time - start_time))
        
        if item is not None:
            file_download_url = ok.get("download_url")
            if file_download_url is not None:
                item["url"] = file_download_url
            item["upload_duration"] = end_time - start_time
            if ok.get("is_public") is not None:
                item["is_public"] = ok.get("is_public")

def have_pending_upload(prompt_id):
    if prompt_id in prompt_metadata and len(prompt_metadata[prompt_id].uploading_nodes) > 0:
        logger.info(f"Have pending upload {len(prompt_metadata[prompt_id].uploading_nodes)}")
        return True

    logger.info("No pending upload")
    return False

def mark_prompt_done(prompt_id):
    """
    Mark the prompt as done in the prompt metadata.

    Args:
        prompt_id (str): The ID of the prompt to mark as done.
    """
    if prompt_id in prompt_metadata:
        prompt_metadata[prompt_id].done = True
        logger.info("Prompt done")

def is_prompt_done(prompt_id: str):
    """
    Check if the prompt with the given ID is marked as done.

    Args:
        prompt_id (str): The ID of the prompt to check.

    Returns:
        bool: True if the prompt is marked as done, False otherwise.
    """
    if prompt_id in prompt_metadata and prompt_metadata[prompt_id].done is True:
        return True

    return False

# Use to handle upload error and send back to ComfyDeploy
async def handle_error(prompt_id, data, e: Exception):
    error_type = type(e).__name__
    stack_trace = traceback.format_exc().strip()
    body = {
        "run_id": prompt_id,
        "output_data": {
            "error": {
                "type": error_type,
                "message": str(e),
                "stack_trace": stack_trace
            }
        }
    }
    await update_file_status(prompt_id, data, False, have_error=True)
    logger.info(body)
    logger.info(f"Error occurred while uploading file: {e}")

# Mark the current prompt requires upload, and block it from being marked as success
async def update_file_status(prompt_id: str, data, uploading, have_error=False, node_id=None):
    # if 'uploading_nodes' not in prompt_metadata[prompt_id]:
    #     prompt_metadata[prompt_id]['uploading_nodes'] = set()

    if node_id is not None:
        if uploading:
            prompt_metadata[prompt_id].uploading_nodes.add(node_id)
        else:
            prompt_metadata[prompt_id].uploading_nodes.discard(node_id)

    logger.info(f"Remaining uploads: {prompt_metadata[prompt_id].uploading_nodes}")
    # Update the remote status

    if have_error:
        await update_run(prompt_id, Status.FAILED)
        await send("failed", {
            "prompt_id": prompt_id,
        })
        return

    # if there are still nodes that are uploading, then we set the status to uploading
    if uploading:
        if prompt_metadata[prompt_id].status != Status.UPLOADING:
            await update_run(prompt_id, Status.UPLOADING)
            await send("uploading", {
                "prompt_id": prompt_id,
            })

    # if there are no nodes that are uploading, then we set the status to success
    elif not uploading and not have_pending_upload(prompt_id) and is_prompt_done(prompt_id=prompt_id):
        await update_run(prompt_id, Status.SUCCESS)
        # logger.info("Status: SUCCUSS")
        await send("success", {
            "prompt_id": prompt_id,
        })

async def handle_upload(prompt_id: str, data, key: str, content_type_key: str, default_content_type: str):
    items = data.get(key, [])
    upload_tasks = []

    for item in items:
        # Skipping temp files
        if item.get("type") == "temp":
            continue

        file_type = item.get(content_type_key, default_content_type)
        file_extension = os.path.splitext(item.get("filename"))[1]
        if file_extension in ['.jpg', '.jpeg']:
            file_type = 'image/jpeg'
        elif file_extension == '.png':
            file_type = 'image/png'
        elif file_extension == '.webp':
            file_type = 'image/webp'

        upload_tasks.append(upload_file(
            prompt_id,
            item.get("filename"),
            subfolder=item.get("subfolder"),
            type=item.get("type"),
            content_type=file_type,
            item=item
        ))

    # Execute all upload tasks concurrently
    await asyncio.gather(*upload_tasks)

# Upload files in the background
async def upload_in_background(prompt_id: str, data, node_id=None, have_upload=True, node_meta=None):
    try:
        await handle_upload(prompt_id, data, 'images', "content_type", "image/png")
        await handle_upload(prompt_id, data, 'files', "content_type", "image/png")
        await handle_upload(prompt_id, data, 'gifs', "format", "image/gif")
        await handle_upload(prompt_id, data, 'mesh', "format", "application/octet-stream")

        status_endpoint = prompt_metadata[prompt_id].status_endpoint
        token = prompt_metadata[prompt_id].token
        if have_upload:
            if status_endpoint is not None:
                body = {
                    "run_id": prompt_id,
                    "output_data": data,
                    "node_meta": node_meta,
                }
                # pprint(body)
                await async_request_with_retry('POST', status_endpoint, token=token, json=body)
            await update_file_status(prompt_id, data, False, node_id=node_id)
    except Exception as e:
        await handle_error(prompt_id, data, e)

async def update_run_with_output(prompt_id, data, node_id=None, node_meta=None):
    if prompt_id not in prompt_metadata:
        return

    if prompt_metadata[prompt_id].is_realtime is True:
        return

    status_endpoint = prompt_metadata[prompt_id].status_endpoint

    body = {
        "run_id": prompt_id,
        "output_data": data,
        "node_meta": node_meta,
    }
    have_upload_media = False
    if data is not None:
        have_upload_media = 'images' in data or 'files' in data or 'gifs' in data or 'mesh' in data
    if bypass_upload and have_upload_media:
        print("CD_BYPASS_UPLOAD is enabled, skipping the upload of the output:", node_id)
        return

    if have_upload_media:
        try:
            logger.info(f"\nHave_upload {have_upload_media} Node Id: {node_id}")

            if have_upload_media:
                await update_file_status(prompt_id, data, True, node_id=node_id)

            # asyncio.create_task(upload_in_background(prompt_id, data, node_id=node_id, have_upload=have_upload_media, node_meta=node_meta))
            await upload_in_background(prompt_id, data, node_id=node_id, have_upload=have_upload_media, node_meta=node_meta)
            # await upload_in_background(prompt_id, data, node_id=node_id, have_upload=have_upload)

        except Exception as e:
            await handle_error(prompt_id, data, e)
    # requests.post(status_endpoint, json=body)
    elif status_endpoint is not None:
        token = prompt_metadata[prompt_id].token
        await async_request_with_retry('POST', status_endpoint, token=token, json=body)

    await send('outputs_uploaded', {
        "prompt_id": prompt_id
    })

prompt_server.send_json_original = prompt_server.send_json
prompt_server.send_json = send_json_override.__get__(prompt_server, server.PromptServer)

root_path = os.path.dirname(os.path.abspath(__file__))
two_dirs_up = os.path.dirname(os.path.dirname(root_path))
log_file_path = os.path.join(two_dirs_up, 'comfy-deploy.log')
comfyui_file_path = os.path.join(two_dirs_up, 'comfyui.log')

last_read_line = 0

async def watch_file_changes(file_path, callback):
    global last_read_line
    last_modified_time = os.stat(file_path).st_mtime
    while True:
        time.sleep(1)  # sleep for a while to reduce CPU usage
        modified_time = os.stat(file_path).st_mtime
        if modified_time != last_modified_time:
            last_modified_time = modified_time
            with open(file_path, 'r') as file:
                lines = file.readlines()
            if last_read_line > len(lines):
                last_read_line = 0  # Reset if log file has been rotated
            new_lines = lines[last_read_line:]
            last_read_line = len(lines)
            if new_lines:
                await callback(''.join(new_lines))


async def send_first_time_log(sid):
    with open(log_file_path, 'r') as file:
        lines = file.readlines()
    await send("LOGS", ''.join(lines), sid)

async def send_logs_to_websocket(logs):
    await send("LOGS", logs)

def start_loop(loop):
    asyncio.set_event_loop(loop)
    loop.run_forever()

def run_in_new_thread(coroutine):
    new_loop = asyncio.new_event_loop()
    t = threading.Thread(target=start_loop, args=(new_loop,), daemon=True)
    t.start()
    asyncio.run_coroutine_threadsafe(coroutine, new_loop)

if cd_enable_log:
    run_in_new_thread(watch_file_changes(log_file_path, send_logs_to_websocket))

# use after calling GET /object_info (it populates the `filename_list_cache` variable)
@server.PromptServer.instance.routes.get("/comfyui-deploy/filename_list_cache")
async def get_filename_list_cache(_):
    from folder_paths import filename_list_cache
    return web.json_response({'filename_list': filename_list_cache})