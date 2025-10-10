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
from aiohttp import web, ClientSession, ClientError, ClientTimeout, ClientResponseError
import atexit
from model_management import get_torch_device
import torch
import psutil
from collections import OrderedDict
import io
from urllib.parse import urlencode

# Global session
client_session = None

# def create_client_session():
#     global client_session
#     if client_session is None:
#         client_session = aiohttp.ClientSession()


async def ensure_client_session():
    global client_session
    if client_session is None:
        # Configure TCP connection pooling for better performance
        connector = aiohttp.TCPConnector(
            limit=30,  # Maximum number of connections in the pool
            limit_per_host=10,  # Maximum number of connections per host
            enable_cleanup_closed=True,  # Clean up closed connections
            force_close=False,  # Keep connections alive when possible
            ttl_dns_cache=300,  # Cache DNS results for 5 minutes
        )

        # Create the session with the connector
        client_session = aiohttp.ClientSession(
            connector=connector,
            timeout=ClientTimeout(total=None, connect=5, sock_read=60, sock_connect=5),
            raise_for_status=False,  # We'll handle status manually
        )
        logger.info("Created global client session with optimized connection pooling")


async def cleanup():
    global client_session
    if client_session:
        await client_session.close()


def exit_handler():
    print("Exiting the application. Initiating cleanup...")
    loop = asyncio.get_event_loop()
    loop.run_until_complete(cleanup())


atexit.register(exit_handler)

max_retries = int(os.environ.get("MAX_RETRIES", "5"))
retry_delay_multiplier = float(os.environ.get("RETRY_DELAY_MULTIPLIER", "2"))

print(f"max_retries: {max_retries}, retry_delay_multiplier: {retry_delay_multiplier}")

import time


async def async_request_with_retry(
    method, url, disable_timeout=False, token=None, **kwargs
):
    global client_session
    await ensure_client_session()
    retry_delay = 1  # Start with 1 second delay
    initial_timeout = 5  # 5 seconds timeout for the initial connection

    start_time = time.time()
    for attempt in range(max_retries):
        try:
            if not disable_timeout:
                timeout = ClientTimeout(total=None, connect=initial_timeout)
                kwargs["timeout"] = timeout

            if token is not None:
                if "headers" not in kwargs:
                    kwargs["headers"] = {}
                kwargs["headers"]["Authorization"] = f"Bearer {token}"

            request_start = time.time()
            async with client_session.request(method, url, **kwargs) as response:
                request_end = time.time()
                # logger.info(f"Request attempt {attempt + 1} took {request_end - request_start:.2f} seconds")

                if response.status != 200:
                    error_body = await response.text()
                    # logger.error(f"Request failed with status {response.status} and body {error_body}")
                    # raise Exception(f"Request failed with status {response.status}")

                response.raise_for_status()
                if method.upper() == "GET":
                    await response.read()

                total_time = time.time() - start_time
                # logger.info(f"Request succeeded after {total_time:.2f} seconds (attempt {attempt + 1}/{max_retries})")
                return response
        except asyncio.TimeoutError:
            logger.warning(
                f"Request timed out after {initial_timeout} seconds (attempt {attempt + 1}/{max_retries})"
            )
        except ClientError as e:
            end_time = time.time()
            logger.error(f"Request failed (attempt {attempt + 1}/{max_retries}): {e}")
            logger.error(
                f"Time taken for failed attempt: {end_time - request_start:.2f} seconds"
            )
            logger.error(f"Total time elapsed: {end_time - start_time:.2f} seconds")

            # Log the response body for ClientError as well
            if hasattr(e, "response") and e.response is not None:
                error_body = await e.response.text()
                logger.error(f"Error response body: {error_body}")

            if attempt == max_retries - 1:
                logger.error(
                    f"Request {method} : {url} failed after {max_retries} attempts: {e}"
                )
                raise

        await asyncio.sleep(retry_delay)
        retry_delay *= retry_delay_multiplier

    total_time = time.time() - start_time
    raise Exception(
        f"Request {method} : {url} failed after {max_retries} attempts and {total_time:.2f} seconds"
    )


from logging import basicConfig, getLogger

# Check for an environment variable to enable/disable Logfire
use_logfire = os.environ.get("USE_LOGFIRE", "false").lower() == "true"

API_KEY_COMFY_ORG = os.environ.get("API_KEY_COMFY_ORG", None)

if use_logfire:
    try:
        import logfire

        logfire.configure(send_to_logfire="if-token-present")
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


from globals import (
    StreamingPrompt,
    Status,
    sockets,
    SimplePrompt,
    streaming_prompt_metadata,
    prompt_metadata,
)


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

cd_enable_log = os.environ.get("CD_ENABLE_LOG", "false").lower() == "true"
cd_enable_run_log = os.environ.get("CD_ENABLE_RUN_LOG", "false").lower() == "true"
bypass_upload = os.environ.get("CD_BYPASS_UPLOAD", "false").lower() == "true"

logger.info(f"CD_BYPASS_UPLOAD {bypass_upload}")

create_native_run_endpoint = None
status_endpoint = None
file_upload_endpoint = None


def clear_current_prompt(sid):
    prompt_server = server.PromptServer.instance
    to_delete = list(
        streaming_prompt_metadata[sid].running_prompt_ids
    )  # Convert set to list

    logger.info(f"clearing out prompt: {to_delete}")
    for id_to_delete in to_delete:
        delete_func = lambda a: a[1] == id_to_delete
        prompt_server.prompt_queue.delete_queue_item(delete_func)
        logger.info(
            f"deleted prompt: {id_to_delete}, remaining tasks: {prompt_server.prompt_queue.get_tasks_remaining()}"
        )

    streaming_prompt_metadata[sid].running_prompt_ids.clear()


async def post_prompt(json_data):
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
        prompt_id = json_data.get("prompt_id") or str(uuid.uuid4())

        partial_execution_targets = None
        if "partial_execution_targets" in json_data:
            partial_execution_targets = json_data["partial_execution_targets"]

        # Handle different validate_prompt signatures (newest to oldest)
        valid = None
        last_error = None

        # v0.3.48 (3 args)
        try:
            valid = await execution.validate_prompt(
                prompt_id, prompt, partial_execution_targets
            )
        except TypeError as e:
            last_error = e
            logger.debug(
                f"validate_prompt with 3 params not supported, trying with 2. Debug: {last_error}"
            )

        # v0.3.45 - 0.3.47 (2 args)
        if valid is None:
            try:
                valid = await execution.validate_prompt(prompt_id, prompt)
            except TypeError as e:
                last_error = e
                logger.debug(
                    f"validate_prompt with 2 params not supported, trying legacy signature. Debug: {last_error}"
                )

        # v0.3.44 or older (1 arg)
        if valid is None:
            try:
                valid = execution.validate_prompt(prompt)
            except TypeError as e:
                last_error = e
                logger.error(
                    f"validate_prompt failed with all signatures. Last error: {last_error}"
                )
                raise

        extra_data = {}
        if "extra_data" in json_data:
            extra_data = json_data["extra_data"]

        if API_KEY_COMFY_ORG is not None:
            extra_data["api_key_comfy_org"] = API_KEY_COMFY_ORG

        if "client_id" in json_data:
            extra_data["client_id"] = json_data["client_id"]
        if valid[0]:
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
    # Special case for SONICSampler which uses np.int32
    if num_digits == "sonic":
        return random.randint(0, 2147483647)  # np.iinfo(np.int32).max

    # Original logic for other cases
    range_start = 10 ** (num_digits - 1)
    range_end = (10**num_digits) - 1
    return random.randint(range_start, range_end)


def apply_random_seed_to_workflow(workflow_api, workflow):
    """
    Applies a random seed to each element in the workflow_api that has a 'seed' input.

    Args:
        workflow_api (dict): The workflow API dictionary to modify.
    """
    for key in workflow_api:
        if "inputs" in workflow_api[key]:
            if "seed" in workflow_api[key]["inputs"]:
                # If seed is a list, it's an input from another node (generally `external number int`)
                if isinstance(workflow_api[key]["inputs"]["seed"], list):
                    continue

                # Check node type in workflow to determine if we should randomize
                node_id = key
                should_skip = (
                    False  # Add a flag to track if we should skip randomization
                )

                for node in workflow["nodes"]:
                    if str(node["id"]) == node_id and node["type"] == "KSampler":
                        # Check if this node has widgets_values and if seed setting is not "fixed"
                        if "widgets_values" in node and len(node["widgets_values"]) > 1:
                            seed_mode = node["widgets_values"][1]
                            if seed_mode == "fixed":
                                # Skip randomization for fixed seeds
                                logger.info(
                                    f"Skipping random seed for KSampler (node {node_id}) as it's set to fixed"
                                )
                                should_skip = True  # Set the flag to skip randomization
                                break  # Exit the inner loop

                            # Apply random seed for non-fixed seeds (randomize, iter, etc.)
                            workflow_api[key]["inputs"]["seed"] = randomSeed()
                            logger.info(
                                f"Applied random seed {workflow_api[key]['inputs']['seed']} to KSampler (node {node_id})"
                            )
                            should_skip = (
                                True  # Set the flag to skip default randomization
                            )
                            break  # Exit the inner loop
                        break  # This break will skip checking other nodes if widgets_values doesn't exist

                # Skip the rest of the code for this key if we already handled it
                if should_skip:
                    continue

                # Special case for SONICSampler
                if workflow_api[key]["class_type"] == "SONICSampler":
                    workflow_api[key]["inputs"]["seed"] = randomSeed("sonic")
                    logger.info(
                        f"Applied random seed {workflow_api[key]['inputs']['seed']} to SONICSampler"
                    )
                    continue
                if workflow_api[key]["class_type"] == "PromptExpansion":
                    workflow_api[key]["inputs"]["seed"] = randomSeed(8)
                    logger.info(
                        f"Applied random seed {workflow_api[key]['inputs']['seed']} to PromptExpansion"
                    )
                    continue
                workflow_api[key]["inputs"]["seed"] = randomSeed()
                logger.info(
                    f"Applied random seed {workflow_api[key]['inputs']['seed']} to {workflow_api[key]['class_type']}"
                )

            if "noise_seed" in workflow_api[key]["inputs"]:
                # If noise_seed is a list, it's an input from another node (generally `external number int`)
                if isinstance(workflow_api[key]["inputs"]["noise_seed"], list):
                    continue
                if workflow_api[key]["class_type"] == "RandomNoise":
                    workflow_api[key]["inputs"]["noise_seed"] = randomSeed()
                    logger.info(
                        f"Applied random noise_seed {workflow_api[key]['inputs']['noise_seed']} to RandomNoise"
                    )
                    continue
                if workflow_api[key]["class_type"] == "KSamplerAdvanced":
                    workflow_api[key]["inputs"]["noise_seed"] = randomSeed()
                    logger.info(
                        f"Applied random noise_seed {workflow_api[key]['inputs']['noise_seed']} to KSamplerAdvanced"
                    )
                    continue
                if workflow_api[key]["class_type"] == "SamplerCustom":
                    workflow_api[key]["inputs"]["noise_seed"] = randomSeed()
                    logger.info(
                        f"Applied random noise_seed {workflow_api[key]['inputs']['noise_seed']} to SamplerCustom"
                    )
                    continue
                if workflow_api[key]["class_type"] == "XlabsSampler":
                    workflow_api[key]["inputs"]["noise_seed"] = randomSeed()
                    logger.info(
                        f"Applied random noise_seed {workflow_api[key]['inputs']['noise_seed']} to SamplerCustom"
                    )
                    continue


def apply_inputs_to_workflow(workflow_api: Any, inputs: Any, sid: str = None):
    # Loop through each of the inputs and replace them
    for key, value in workflow_api.items():
        if "inputs" in value:
            # Support websocket
            if sid is not None:
                if value["class_type"] == "ComfyDeployWebscoketImageOutput":
                    value["inputs"]["client_id"] = sid
                if value["class_type"] == "ComfyDeployWebscoketImageInput":
                    value["inputs"]["client_id"] = sid

            if (
                "input_id" in value["inputs"]
                and inputs is not None
                and value["inputs"]["input_id"] in inputs
            ):
                new_value = inputs[value["inputs"]["input_id"]]

                # Lets skip it if its an image
                if isinstance(new_value, Image.Image):
                    continue

                # Backward compactibility
                value["inputs"]["input_id"] = new_value

                # Fix for external text default value
                if (
                    value["class_type"] == "ComfyUIDeployExternalText"
                    or value["class_type"] == "ComfyUIDeployExternalTextAny"
                ):
                    value["inputs"]["default_value"] = new_value

                if value["class_type"] == "ComfyUIDeployExternalCheckpoint":
                    value["inputs"]["default_value"] = new_value

                if value["class_type"] == "ComfyUIDeployExternalImageBatch":
                    value["inputs"]["images"] = new_value

                if value["class_type"] == "ComfyUIDeployExternalEnum":
                    value["inputs"]["default_value"] = new_value

                if value["class_type"] == "ComfyUIDeployExternalLora":
                    value["inputs"]["lora_url"] = new_value

                if value["class_type"] == "ComfyUIDeployExternalSlider":
                    value["inputs"]["default_value"] = new_value

                if value["class_type"] == "ComfyUIDeployExternalBoolean":
                    value["inputs"]["default_value"] = new_value

                if value["class_type"] == "ComfyUIDeployExternalFaceModel":
                    value["inputs"]["face_model_url"] = new_value

                if value["class_type"] == "ComfyUIDeployExternalAudio":
                    value["inputs"]["audio_file"] = new_value

                if value["class_type"] == "ComfyUIDeployExternalEXR":
                    value["inputs"]["exr_file"] = new_value

                if value["class_type"] == "ComfyUIDeployExternalFile":
                    value["inputs"]["file_url"] = new_value

                if value["class_type"] == "ComfyUIDeployExternalSeed":
                    logger.info(
                        f"Applied random seed {new_value} to {value['class_type']}"
                    )
                    value["inputs"]["default_value"] = new_value


def send_prompt(sid: str, inputs: StreamingPrompt):
    # workflow_api = inputs.workflow_api
    workflow_api = copy.deepcopy(inputs.workflow_api)
    workflow = copy.deepcopy(inputs.workflow)

    # Random seed
    apply_random_seed_to_workflow(workflow_api, workflow)

    logger.info("getting inputs", inputs.inputs)

    apply_inputs_to_workflow(workflow_api, inputs.inputs, sid=sid)

    logger.info(workflow_api)

    prompt_id = str(uuid.uuid4())

    # prompt = {
    #     "prompt": workflow_api,
    #     "client_id": sid,  # "comfy_deploy_instance", #api.client_id
    #     "prompt_id": prompt_id,
    #     "extra_data": {"extra_pnginfo": {"workflow": workflow}},
    # }

    try:
        # res = post_prompt(prompt)
        inputs.running_prompt_ids.add(prompt_id)
        prompt_metadata[prompt_id] = SimplePrompt(
            status_endpoint=inputs.status_endpoint,
            file_upload_endpoint=inputs.file_upload_endpoint,
            workflow_api=workflow_api,
            is_realtime=True,
        )
    except Exception as e:
        error_type = type(e).__name__
        stack_trace_short = traceback.format_exc().strip().split("\n")[-2]
        # stack_trace = traceback.format_exc().strip()
        logger.info(f"error: {error_type}, {e}")
        logger.info(f"stack trace: {stack_trace_short}")

    # # Add custom logic here
    # if 'prompt_id' in response:
    #     prompt_id = response['prompt_id']
    #     if prompt_id in prompt_metadata:
    #         metadata = prompt_metadata[prompt_id]

    #         # Add additional information to the response
    #         response['status_endpoint'] = metadata.status_endpoint
    #         response['file_upload_endpoint'] = metadata.file_upload_endpoint


@server.PromptServer.instance.routes.post("/comfyui-deploy/run")
async def comfy_deploy_run(request):
    # Extract the bearer token from the Authorization header
    data = await request.json()

    client_id = data.get("client_id")
    # We proxy the request to Comfy Deploy, this is a native run
    if "is_native_run" in data:
        async with aiohttp.ClientSession() as session:
            # pprint(data)
            # headers = request.headers.copy()
            # headers['Content-Type'] = 'application/json'
            async with session.post(
                data.get("native_run_api_endpoint"),
                json=data,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": request.headers.get("Authorization"),
                },
            ) as response:
                data = await response.json()
                # print(data)

    if "cd_token" in data:
        token = data["cd_token"]
    else:
        auth_header = request.headers.get("Authorization")
        token = None
        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                token = parts[1]

    # In older version, we use workflow_api, but this has inputs already swapped in nextjs frontend, which is tricky
    workflow_api = data.get("workflow_api_raw")
    # The prompt id generated from comfy deploy, can be None
    prompt_id = data.get("prompt_id")
    inputs = data.get("inputs")
    gpu_event_id = data.get("gpu_event_id", None)
    workflow = data.get("workflow")

    # Now it handles directly in here
    apply_random_seed_to_workflow(workflow_api, workflow)
    apply_inputs_to_workflow(workflow_api, inputs)

    prompt = {
        "prompt": workflow_api,
        "client_id": "comfy_deploy_instance" if client_id is None else client_id,
        "prompt_id": prompt_id,
        "extra_data": {"extra_pnginfo": {"workflow": workflow}},
    }

    prompt_metadata[prompt_id] = SimplePrompt(
        status_endpoint=data.get("status_endpoint"),
        file_upload_endpoint=data.get("file_upload_endpoint"),
        workflow_api=workflow_api,
        token=token,
        gpu_event_id=gpu_event_id,
    )

    try:
        res = await post_prompt(prompt)
    except Exception as e:
        error_type = type(e).__name__
        stack_trace_short = traceback.format_exc().strip().split("\n")[-2]
        stack_trace = traceback.format_exc().strip()
        logger.info(f"error: {error_type}, {e}")
        logger.info(f"stack trace: {stack_trace_short}")
        await update_run_with_output(
            prompt_id,
            {"error": {"error_type": error_type, "stack_trace": stack_trace}},
            gpu_event_id=gpu_event_id,
        )
        # When there are critical errors, the prompt is actually not run
        await update_run(prompt_id, Status.FAILED)
        return web.Response(
            status=500, reason=f"{error_type}: {e}, {stack_trace_short}"
        )

    status = 200

    if (
        "node_errors" in res
        and res["node_errors"] is not None
        and len(res["node_errors"]) > 0
    ):
        # Even tho there are node_errors it can still be run
        status = 400
        await update_run_with_output(
            prompt_id, {"error": {**res}}, gpu_event_id=gpu_event_id
        )

        # When there are critical errors, the prompt is actually not run
        if "error" in res:
            await update_run(prompt_id, Status.FAILED)

    return web.json_response(res, status=status)


@server.PromptServer.instance.routes.post("/comfyui-deploy/interrupt")
async def interrupt_prompt(request):
    data = await request.json()
    prompt_id = data.get("prompt_id")
    await update_run(prompt_id, Status.CANCELLED)
    return web.json_response({"message": "Prompt interrupted"}, status=200)


async def stream_prompt(data, token):
    # In older version, we use workflow_api, but this has inputs already swapped in nextjs frontend, which is tricky
    workflow_api = data.get("workflow_api_raw")
    # The prompt id generated from comfy deploy, can be None
    prompt_id = data.get("prompt_id")
    inputs = data.get("inputs")
    workflow = data.get("workflow")
    gpu_event_id = data.get("gpu_event_id", None)

    # Now it handles directly in here
    apply_random_seed_to_workflow(workflow_api, workflow)
    apply_inputs_to_workflow(workflow_api, inputs)

    prompt = {
        "prompt": workflow_api,
        "client_id": "comfy_deploy_instance",  # api.client_id
        "prompt_id": prompt_id,
        "extra_data": {"extra_pnginfo": {"workflow": workflow}},
    }

    prompt_metadata[prompt_id] = SimplePrompt(
        status_endpoint=data.get("status_endpoint"),
        file_upload_endpoint=data.get("file_upload_endpoint"),
        workflow_api=workflow_api,
        token=token,
        gpu_event_id=gpu_event_id,
    )

    # log('info', "Begin prompt", prompt=prompt)

    try:
        res = await post_prompt(prompt)
    except Exception as e:
        error_type = type(e).__name__
        stack_trace_short = traceback.format_exc().strip().split("\n")[-2]
        stack_trace = traceback.format_exc().strip()
        logger.info(f"error: {error_type}, {e}")
        logger.info(f"stack trace: {stack_trace_short}")
        await update_run_with_output(
            prompt_id, {"error": {"error_type": error_type, "stack_trace": stack_trace}}
        )
        # When there are critical errors, the prompt is actually not run
        await update_run(prompt_id, Status.FAILED)
        # return web.Response(status=500, reason=f"{error_type}: {e}, {stack_trace_short}")
        # raise Exception("Prompt failed")

    status = 200

    if (
        "node_errors" in res
        and res["node_errors"] is not None
        and len(res["node_errors"]) > 0
    ):
        # Even tho there are node_errors it can still be run
        status = 400
        await update_run_with_output(prompt_id, {"error": {**res}})

        # When there are critical errors, the prompt is actually not run
        if "error" in res:
            await update_run(prompt_id, Status.FAILED)
            # raise Exception("Prompt failed")

    return res
    # return web.json_response(res, status=status)


comfy_message_queues: Dict[str, asyncio.Queue] = {}


@server.PromptServer.instance.routes.post("/comfyui-deploy/run/streaming")
async def stream_response(request):
    response = web.StreamResponse(
        status=200, reason="OK", headers={"Content-Type": "text/event-stream"}
    )
    await response.prepare(request)

    # Extract the bearer token from the Authorization header
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header:
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    pending = True
    data = await request.json()

    prompt_id = data.get("prompt_id")
    comfy_message_queues[prompt_id] = asyncio.Queue()

    with log_span("Streaming Run"):
        log("info", "Streaming prompt")

        try:
            result = await stream_prompt(data=data, token=token)
            await response.write(
                f"event: event_update\ndata: {json.dumps(result)}\n\n".encode("utf-8")
            )
            # await response.write(.encode('utf-8'))
            await response.drain()  # Ensure the buffer is flushed

            while pending:
                if prompt_id in comfy_message_queues:
                    if not comfy_message_queues[prompt_id].empty():
                        data = await comfy_message_queues[prompt_id].get()

                        # log('info', data["event"], data=json.dumps(data))
                        # logger.info("listener", data)
                        await response.write(
                            f"event: event_update\ndata: {json.dumps(data)}\n\n".encode(
                                "utf-8"
                            )
                        )
                        await response.drain()  # Ensure the buffer is flushed

                        if data["event"] == "status":
                            if data["data"]["status"] in (
                                Status.FAILED.value,
                                Status.SUCCESS.value,
                            ):
                                pending = False

                await asyncio.sleep(0.1)  # Adjust the sleep duration as needed
        except asyncio.CancelledError:
            log("info", "Streaming was cancelled")
            raise
        except Exception as e:
            log("error", "Streaming error", error=e)
        finally:
            # event_emitter.off("send_json", task)
            await response.write_eof()
            comfy_message_queues.pop(prompt_id, None)
            return response


def get_comfyui_path_from_file_path(file_path):
    file_path_parts = file_path.split("\\")

    if file_path_parts[0] == "input":
        logger.info("matching input")
        file_path = os.path.join(
            folder_paths.get_directory_by_type("input"), *file_path_parts[1:]
        )
    elif file_path_parts[0] == "models":
        logger.info("matching models")
        file_path = folder_paths.get_full_path(
            file_path_parts[1], os.path.join(*file_path_parts[2:])
        )

    logger.info(file_path)

    return file_path


# Form ComfyUI Manager
async def compute_sha256_checksum(filepath):
    logger.info("computing sha256 checksum")
    chunk_size = 1024 * 256  # Example: 256KB
    filepath = get_comfyui_path_from_file_path(filepath)
    """Compute the SHA256 checksum of a file, in chunks, asynchronously"""
    sha256 = hashlib.sha256()
    async with aiofiles.open(filepath, "rb") as f:
        while True:
            chunk = await f.read(chunk_size)
            if not chunk:
                break
            sha256.update(chunk)
    return sha256.hexdigest()


@server.PromptServer.instance.routes.get("/comfyui-deploy/models")
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
@server.PromptServer.instance.routes.post("/comfyui-deploy/upload-file")
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

            if file_extension in [".jpg", ".jpeg"]:
                file_type = "image/jpeg"
            elif file_extension == ".png":
                file_type = "image/png"
            elif file_extension == ".webp":
                file_type = "image/webp"
            elif file_extension == ".zip":
                file_type = "application/zip"
            elif file_extension in [".psd", ".psb"]:
                file_type = "image/vnd.adobe.photoshop"
            else:
                file_type = (
                    "application/octet-stream"  # Default to binary file type if unknown
                )
        else:
            return web.json_response(
                {"error": f"File not found: {file_path}"}, status=404
            )

    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

    if get_url:
        try:
            headers = {"Authorization": f"Bearer {token}"}
            params = {"file_size": file_size, "type": file_type}
            response = await async_request_with_retry(
                "GET", get_url, params=params, headers=headers
            )
            if response.status == 200:
                content = await response.json()
                upload_url = content["upload_url"]

                with open(file_path, "rb") as f:
                    headers = {
                        "Content-Type": file_type,
                        # "Content-Length": str(file_size)
                    }
                    if content.get("include_acl") is True:
                        headers["x-amz-acl"] = "public-read"
                    upload_response = await async_request_with_retry(
                        "PUT", upload_url, data=f, headers=headers
                    )
                    if upload_response.status == 200:
                        return web.json_response(
                            {
                                "message": "File uploaded successfully",
                                "download_url": content["download_url"],
                            }
                        )
                    else:
                        return web.json_response(
                            {
                                "error": f"Failed to upload file to {upload_url}. Status code: {upload_response.status}"
                            },
                            status=upload_response.status,
                        )
            else:
                return web.json_response(
                    {
                        "error": f"Failed to fetch data from {get_url}. Status code: {response.status}"
                    },
                    status=response.status,
                )
        except Exception as e:
            return web.json_response(
                {
                    "error": f"An error occurred while fetching data from {get_url}: {str(e)}"
                },
                status=500,
            )

    return web.json_response({"error": f"File not uploaded"}, status=500)


script_dir = os.path.dirname(os.path.abspath(__file__))
# Assuming the cache file is stored in the same directory as this script
CACHE_FILE_PATH = script_dir + "/file-hash-cache.json"

# Global in-memory cache
file_hash_cache = {}


# Load cache from disk at startup
def load_cache():
    global file_hash_cache
    try:
        with open(CACHE_FILE_PATH, "r") as cache_file:
            file_hash_cache = json.load(cache_file)
    except (FileNotFoundError, json.JSONDecodeError):
        file_hash_cache = {}


# Save cache to disk
def save_cache():
    with open(CACHE_FILE_PATH, "w") as cache_file:
        json.dump(file_hash_cache, cache_file)


# Initialize cache on application start
load_cache()


@server.PromptServer.instance.routes.get("/comfyui-deploy/get-file-hash")
async def get_file_hash(request):
    file_path = request.rel_url.query.get("file_path", "")

    if not file_path:
        return web.json_response({"error": "file_path is required"}, status=400)

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

        return web.json_response({"file_hash": file_hash})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def update_realtime_run_status(
    realtime_id: str,
    status_endpoint: str,
    status: Status,
    gpu_event_id: str | None = None,
):
    body = {
        "run_id": realtime_id,
        "status": status.value,
        "gpu_event_id": gpu_event_id,
    }
    if status_endpoint is None:
        return
    # requests.post(status_endpoint, json=body)
    await async_request_with_retry("POST", status_endpoint, json=body)


@server.PromptServer.instance.routes.get("/comfyui-deploy/ws")
async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    sid = request.rel_url.query.get("clientId", "")
    if sid:
        # Reusing existing session, remove old
        sockets.pop(sid, None)
    else:
        sid = uuid.uuid4().hex

    sockets[sid] = ws

    auth_token = request.rel_url.query.get("token", None)
    get_workflow_endpoint_url = request.rel_url.query.get("workflow_endpoint", None)
    realtime_id = request.rel_url.query.get("realtime_id", None)
    status_endpoint = request.rel_url.query.get("status_endpoint", None)

    if auth_token is not None and get_workflow_endpoint_url is not None:
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = await async_request_with_retry(
            "GET", get_workflow_endpoint_url, headers=headers
        )
        if response.status == 200:
            workflow = await response.json()

            logger.info(f"Loaded workflow version ${workflow['version']}")

            streaming_prompt_metadata[sid] = StreamingPrompt(
                workflow_api=workflow["workflow_api"],
                auth_token=auth_token,
                inputs={},
                status_endpoint=status_endpoint,
                file_upload_endpoint=request.rel_url.query.get(
                    "file_upload_endpoint", None
                ),
                workflow=workflow["workflow"],
            )

            await update_realtime_run_status(
                realtime_id, status_endpoint, Status.RUNNING
            )
            # await send("workflow_api", workflow_api, sid)
        else:
            error_message = await response.text()
            logger.info(
                f"Failed to fetch workflow endpoint. Status: {response.status}, Error: {error_message}"
            )
            # await send("error", {"message": error_message}, sid)

    try:
        # Send initial state to the new client
        await send("status", {"sid": sid}, sid)

        # Make sure when its connected via client, the full log is not being sent
        if cd_enable_log and get_workflow_endpoint_url is None:
            await send_first_time_log(sid)

        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                    logger.info(data)
                    event_type = data.get("event")
                    if event_type == "input":
                        logger.info(f"Got input: ${data.get('inputs')}")
                        input = data.get("inputs")
                        streaming_prompt_metadata[sid].inputs.update(input)
                    elif event_type == "queue_prompt":
                        clear_current_prompt(sid)
                        send_prompt(sid, streaming_prompt_metadata[sid])
                    else:
                        # Handle other event types
                        pass
                except json.JSONDecodeError:
                    logger.info("Failed to decode JSON from message")

            if msg.type == aiohttp.WSMsgType.BINARY:
                data = msg.data
                (event_type,) = struct.unpack("<I", data[:4])
                if event_type == 0:  # Image input
                    (image_type_code,) = struct.unpack("<I", data[4:8])
                    input_id_bytes = data[
                        8:32
                    ]  # Extract the next 24 bytes for the input ID
                    input_id = input_id_bytes.decode(
                        "ascii"
                    ).strip()  # Decode the input ID from ASCII
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
                            existing_image = streaming_prompt_metadata[sid].inputs[
                                input_id
                            ]
                            if hasattr(existing_image, "close"):
                                existing_image.close()
                        except Exception as e:
                            logger.info(
                                f"Error closing previous image for input ID {input_id}: {e}"
                            )
                    streaming_prompt_metadata[sid].inputs[input_id] = image
                    # clear_current_prompt(sid)
                    # send_prompt(sid, streaming_prompt_metadata[sid])
                    logger.info(
                        f"Received {image_type} image of size {image.size} with input ID {input_id}"
                    )

            if msg.type == aiohttp.WSMsgType.ERROR:
                logger.info("ws connection closed with exception %s" % ws.exception())
    finally:
        sockets.pop(sid, None)

        if realtime_id is not None:
            await update_realtime_run_status(
                realtime_id, status_endpoint, Status.SUCCESS
            )
    return ws


@server.PromptServer.instance.routes.get("/comfyui-deploy/check-status")
async def comfy_deploy_check_status(request):
    prompt_id = request.rel_url.query.get("prompt_id", None)
    if prompt_id in prompt_metadata:
        return web.json_response({"status": prompt_metadata[prompt_id].status.value})
    else:
        return web.json_response({"message": "prompt_id not found"})


@server.PromptServer.instance.routes.get("/comfyui-deploy/check-ws-status")
async def comfy_deploy_check_ws_status(request):
    client_id = request.rel_url.query.get("client_id", None)
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
            if (
                ws != None and not ws.closed
            ):  # Check if the WebSocket connection is open and not closing
                await ws.send_json({"event": event, "data": data})
        else:
            for ws in sockets.values():
                if (
                    not ws.closed
                ):  # Check if the WebSocket connection is open and not closing
                    await ws.send_json({"event": event, "data": data})
    except Exception as e:
        logger.info(f"Exception: {e}")
        traceback.print_exc()


@server.PromptServer.instance.routes.get("/comfydeploy/{tail:.*}")
@server.PromptServer.instance.routes.post("/comfydeploy/{tail:.*}")
async def proxy_to_comfydeploy(request):
    # Get the base URL
    base_url = f"https://www.comfydeploy.com/{request.match_info['tail']}"

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
                headers={
                    k: v
                    for k, v in request.headers.items()
                    if k.lower() not in ("host", "content-length")
                },
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
                return web.Response(
                    body=content, status=client_req.status, headers=client_req.headers
                )

    except ClientError as e:
        print(f"Client error occurred while proxying request: {str(e)}")
        return web.Response(status=502, text=f"Bad Gateway: {str(e)}")
    except Exception as e:
        print(f"Error occurred while proxying request: {str(e)}")
        return web.Response(status=500, text=f"Internal Server Error: {str(e)}")


prompt_server = server.PromptServer.instance


NODE_EXECUTION_TIMES = {}  # New dictionary to store node execution times
CURRENT_START_EXECUTION_DATA = None


def get_peak_memory():
    device = get_torch_device()
    if device.type == "cuda":
        return torch.cuda.max_memory_allocated(device)
    elif device.type == "mps":
        # Return system memory usage for MPS devices
        return psutil.Process().memory_info().rss
    return 0


def reset_peak_memory_record():
    device = get_torch_device()
    if device.type == "cuda":
        torch.cuda.reset_max_memory_allocated(device)
    # MPS doesn't need reset as we're not tracking its memory


def handle_execute(class_type, last_node_id, prompt_id, server, unique_id):
    if not CURRENT_START_EXECUTION_DATA:
        return
    start_time = CURRENT_START_EXECUTION_DATA["nodes_start_perf_time"].get(unique_id)
    start_vram = CURRENT_START_EXECUTION_DATA["nodes_start_vram"].get(unique_id)
    if start_time:
        end_time = time.perf_counter()
        execution_time = end_time - start_time

        end_vram = get_peak_memory()
        vram_used = end_vram - start_vram
        global NODE_EXECUTION_TIMES
        # print(f"end_vram - start_vram: {end_vram} - {start_vram} = {vram_used}")
        NODE_EXECUTION_TIMES[unique_id] = {
            "time": execution_time,
            "class_type": class_type,
            "vram_used": vram_used,
        }
        # print(f"#{unique_id} [{class_type}]: {execution_time:.2f}s - vram {vram_used}b")


try:
    origin_execute = execution.execute
    is_async = asyncio.iscoroutinefunction(origin_execute)

    if is_async:

        async def swizzle_execute(
            server,
            dynprompt,
            caches,
            current_item,
            extra_data,
            executed,
            prompt_id,
            execution_list,
            pending_subgraph_results,
            pending_async_nodes,
        ):
            unique_id = current_item
            class_type = dynprompt.get_node(unique_id)["class_type"]
            last_node_id = server.last_node_id

            result = await origin_execute(
                server,
                dynprompt,
                caches,
                current_item,
                extra_data,
                executed,
                prompt_id,
                execution_list,
                pending_subgraph_results,
                pending_async_nodes,
            )

            handle_execute(class_type, last_node_id, prompt_id, server, unique_id)
            return result
    else:

        def swizzle_execute(
            server,
            dynprompt,
            caches,
            current_item,
            extra_data,
            executed,
            prompt_id,
            execution_list,
            pending_subgraph_results,
        ):
            unique_id = current_item
            class_type = dynprompt.get_node(unique_id)["class_type"]
            last_node_id = server.last_node_id

            result = origin_execute(
                server,
                dynprompt,
                caches,
                current_item,
                extra_data,
                executed,
                prompt_id,
                execution_list,
                pending_subgraph_results,
            )

            handle_execute(class_type, last_node_id, prompt_id, server, unique_id)
            return result

    execution.execute = swizzle_execute
except Exception:
    pass


def format_table(headers, data):
    # Calculate column widths
    widths = [len(h) for h in headers]
    for row in data:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(str(cell)))

    # Create separator line
    separator = "+" + "+".join("-" * (w + 2) for w in widths) + "+"

    # Format header
    result = [separator]
    header_row = "|" + "|".join(f" {h:<{w}} " for w, h in zip(widths, headers)) + "|"
    result.append(header_row)
    result.append(separator)

    # Format data rows
    for row in data:
        data_row = (
            "|" + "|".join(f" {str(cell):<{w}} " for w, cell in zip(widths, row)) + "|"
        )
        result.append(data_row)

    result.append(separator)
    return "\n".join(result)


origin_func = server.PromptServer.send_sync


def swizzle_send_sync(self, event, data, sid=None):
    # print(f"swizzle_send_sync, event: {event}, data: {data}")
    global CURRENT_START_EXECUTION_DATA
    if event == "execution_start":
        global NODE_EXECUTION_TIMES
        NODE_EXECUTION_TIMES = {}  # Reset execution times at start
        CURRENT_START_EXECUTION_DATA = dict(
            start_perf_time=time.perf_counter(),
            nodes_start_perf_time={},
            nodes_start_vram={},
        )

    origin_func(self, event=event, data=data, sid=sid)

    if event == "executing" and data and CURRENT_START_EXECUTION_DATA:
        if data.get("node") is not None:
            node_id = data.get("node")
            CURRENT_START_EXECUTION_DATA["nodes_start_perf_time"][node_id] = (
                time.perf_counter()
            )
            reset_peak_memory_record()
            CURRENT_START_EXECUTION_DATA["nodes_start_vram"][node_id] = (
                get_peak_memory()
            )


server.PromptServer.send_sync = swizzle_send_sync

send_json = prompt_server.send_json


async def send_json_override(self, event, data, sid=None):
    # logger.info(f"INTERNAL: event={event}, data={data}, sid={sid}")
    prompt_id = data.get("prompt_id")

    target_sid = sid
    if target_sid == "comfy_deploy_instance":
        target_sid = None

    # now we send everything
    await asyncio.wait(
        [
            asyncio.create_task(send(event, data, sid=target_sid)),
            asyncio.create_task(self.send_json_original(event, data, sid)),
        ]
    )

    if prompt_id in comfy_message_queues:
        comfy_message_queues[prompt_id].put_nowait({"event": event, "data": data})

    asyncio.create_task(update_run_ws_event(prompt_id, event, data))

    if event == "execution_start":
        if prompt_id in prompt_metadata:
            prompt_metadata[prompt_id].start_time = time.perf_counter()

        logger.info("Executing prompt: " + prompt_id)

        asyncio.create_task(update_run(prompt_id, Status.RUNNING))

    if event == "executing" and data and CURRENT_START_EXECUTION_DATA:
        if data.get("node") is None:
            start_perf_time = CURRENT_START_EXECUTION_DATA.get("start_perf_time")
            new_data = data.copy()
            if start_perf_time is not None:
                execution_time = time.perf_counter() - start_perf_time
                new_data["execution_time"] = int(execution_time * 1000)

            # Replace the print statements with tabulate
            headers = ["Node ID", "Type", "Time (s)", "VRAM (GB)"]
            table_data = []
            node_execution_array = []  # New array to store execution data

            for node_id, node_data in NODE_EXECUTION_TIMES.items():
                vram_gb = node_data["vram_used"] / (1024**3)  # Convert bytes to GB
                table_data.append(
                    [
                        f"#{node_id}",
                        node_data["class_type"],
                        f"{node_data['time']:.2f}",
                        f"{vram_gb:.2f}",
                    ]
                )

                # Add to our new array format
                node_execution_array.append(
                    {
                        "id": node_id,
                        **node_data,
                    }
                )

            # Add total execution time as the last row
            table_data.append(["TOTAL", "-", f"{execution_time:.2f}", "-"])

            prompt_id = data.get("prompt_id")
            asyncio.create_task(
                update_run_with_output(
                    prompt_id,
                    node_execution_array,  # Send the array instead of the OrderedDict
                )
            )

            # print(node_execution_array)

            # print("\n=== Node Execution Times ===")
            # logger.info("Printing Node Execution Times")
            logger.info(format_table(headers, table_data))
            # print("========================\n")

    # the last executing event is none, then the workflow is finished
    if event == "executing" and data.get("node") is None:
        mark_prompt_done(prompt_id=prompt_id)
        # We will now rely on the UploadQueue worker to set the final SUCCESS status
        # after all uploads are confirmed complete.

        if not have_pending_upload(prompt_id):
            # await update_run(prompt_id, Status.SUCCESS) # <-- REMOVE/COMMENT OUT
            if prompt_id in prompt_metadata:  # <-- REMOVE/COMMENT OUT THIS BLOCK
                current_time = time.perf_counter()
                if prompt_metadata[prompt_id].start_time is not None:
                    elapsed_time = current_time - prompt_metadata[prompt_id].start_time
                    logger.info(f"Elapsed time: {elapsed_time} seconds")
                    asyncio.create_task(
                        send(
                            "elapsed_time",
                            {"prompt_id": prompt_id, "elapsed_time": elapsed_time},
                            sid=sid,
                        )
                    )

    if event == "executing" and data.get("node") is not None:
        raw_node = data.get("node")
        node = str(raw_node)

        if prompt_id in prompt_metadata:
            wf_api = prompt_metadata[prompt_id].workflow_api

            # Normalize dotted display ids like "23.0.0.1" to base "23"
            if node not in wf_api and "." in node:
                base = node.split(".")[0]
                if base in wf_api:
                    node = base

            # If still unknown, skip safely
            if node not in wf_api:
                logger.info(f"Skipping unknown node id in 'executing': {raw_node}")
                return

            prompt_metadata[prompt_id].progress.add(node)
            calculated_progress = len(prompt_metadata[prompt_id].progress) / len(wf_api)
            calculated_progress = round(calculated_progress, 2)

            if (
                prompt_metadata[prompt_id].last_updated_node is not None
                and prompt_metadata[prompt_id].last_updated_node == node
            ):
                return
            prompt_metadata[prompt_id].last_updated_node = node

            class_type = wf_api[node]["class_type"]
            logger.info(f"At: {round(calculated_progress * 100)}% - {class_type}")
            asyncio.create_task(
                send(
                    "live_status",
                    {
                        "prompt_id": prompt_id,
                        "current_node": class_type,
                        "progress": calculated_progress,
                    },
                    sid=sid,
                )
            )
            asyncio.create_task(
                update_run_live_status(
                    prompt_id, "Executing " + class_type, calculated_progress
                )
            )

    if event == "execution_cached" and data.get("nodes") is not None:
        if prompt_id in prompt_metadata:
            # if 'progress' not in prompt_metadata[prompt_id]:
            #     prompt_metadata[prompt_id].progress = set()

            if "nodes" in data:
                for node in data.get("nodes", []):
                    prompt_metadata[prompt_id].progress.add(node)
            # prompt_metadata[prompt_id]["progress"].update(data.get('nodes'))

    if event == "execution_error":
        # Careful this might not be fully awaited.
        await update_run_with_output(prompt_id, data)
        await update_run(prompt_id, Status.FAILED)
        # await update_run_with_output(prompt_id, data)

    if event == "executed" and "node" in data and "output" in data:
        node_meta = None
        if prompt_id in prompt_metadata:
            node = data.get("node")
            class_type = prompt_metadata[prompt_id].workflow_api[node]["class_type"]
            node_meta = {
                "node_id": node,
                "node_class": class_type,
            }
            if class_type == "PreviewImage":
                pass
                # logger.info("Skipping preview image")
            else:
                await update_run_with_output(
                    prompt_id,
                    data.get("output"),
                    node_id=data.get("node"),
                    node_meta=node_meta,
                )
                if prompt_id in comfy_message_queues:
                    comfy_message_queues[prompt_id].put_nowait(
                        {"event": "output_ready", "data": data}
                    )
            # logger.info(f"Executed {class_type} {data}")
        else:
            pass
            # logger.info(f"Executed {data}")


# Global variable to keep track of the last read line number
last_read_line_number = 0


async def update_run_live_status(prompt_id, live_status, calculated_progress: float):
    if prompt_id not in prompt_metadata:
        return

    if prompt_metadata[prompt_id].is_realtime is True:
        return

    status_endpoint = prompt_metadata[prompt_id].status_endpoint
    token = prompt_metadata[prompt_id].token
    gpu_event_id = prompt_metadata[prompt_id].gpu_event_id or None
    if status_endpoint is None:
        return

    body = {
        "run_id": prompt_id,
        "live_status": live_status,
        "progress": calculated_progress,
        "gpu_event_id": gpu_event_id,
    }

    if prompt_id in comfy_message_queues:
        comfy_message_queues[prompt_id].put_nowait(
            {
                "event": "live_status",
                "data": {
                    "prompt_id": prompt_id,
                    "live_status": live_status,
                    "progress": calculated_progress,
                },
            }
        )

    await async_request_with_retry("POST", status_endpoint, token=token, json=body)


async def update_run_ws_event(prompt_id: str, event: str, data: dict):
    if prompt_id not in prompt_metadata:
        return

    status_endpoint = prompt_metadata[prompt_id].status_endpoint

    if status_endpoint is None:
        return

    token = prompt_metadata[prompt_id].token
    gpu_event_id = prompt_metadata[prompt_id].gpu_event_id or None

    body = {
        "run_id": prompt_id,
        "ws_event": {
            "event": event,
            "data": data,
            "gpu_event_id": gpu_event_id,
        },
    }
    await async_request_with_retry("POST", status_endpoint, token=token, json=body)


async def update_run(prompt_id: str, status: Status):
    global last_read_line_number

    if prompt_id not in prompt_metadata:
        return

    # if prompt_metadata[prompt_id].start_time is None and status == Status.RUNNING:
    # if its realtime prompt we need to skip that.
    if prompt_metadata[prompt_id].is_realtime is True:
        prompt_metadata[prompt_id].status = status
        return

    if prompt_metadata[prompt_id].status != status:
        # when the status is already failed, we don't want to update it to success
        if prompt_metadata[prompt_id].status is Status.FAILED:
            return

        status_endpoint = prompt_metadata[prompt_id].status_endpoint
        gpu_event_id = prompt_metadata[prompt_id].gpu_event_id or None

        body = {
            "run_id": prompt_id,
            "status": status.value,
            "gpu_event_id": gpu_event_id,
        }
        logger.info(f"Status: {status.value}")

        try:
            # requests.post(status_endpoint, json=body)
            if status_endpoint is not None:
                token = prompt_metadata[prompt_id].token
                await async_request_with_retry(
                    "POST", status_endpoint, token=token, json=body
                )

            if (
                (status_endpoint is not None)
                and cd_enable_run_log
                and (status == Status.SUCCESS or status == Status.FAILED)
            ):
                try:
                    with open(comfyui_file_path, "r") as log_file:
                        # log_data = log_file.read()
                        # Move to the last read line
                        all_log_data = log_file.read()  # Read all log data
                        # logger.info("All log data before skipping: ")  # Log all data before skipping
                        log_file.seek(0)  # Reset file pointer to the beginning

                        for _ in range(last_read_line_number):
                            next(log_file)
                        log_data = log_file.read()
                        # Update the last read line number
                        last_read_line_number += log_data.count("\n")
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
                            ],
                            "gpu_event_id": gpu_event_id,
                        }

                        await async_request_with_retry(
                            "POST", status_endpoint, token=token, json=body
                        )
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
                comfy_message_queues[prompt_id].put_nowait(
                    {
                        "event": "status",
                        "data": {
                            "prompt_id": prompt_id,
                            "status": status.value,
                        },
                    }
                )


async def file_sender(file_object, chunk_size):
    while True:
        chunk = await file_object.read(chunk_size)
        if not chunk:
            break
        yield chunk


chunk_size = 1024 * 1024  # 1MB chunks, adjust as needed


class ProgressTracker:
    def __init__(self, data, callback):
        self.data = data
        self.callback = callback
        self.total = len(data)
        self.uploaded = 0
        self._cursor = 0

    async def read(self, n=-1):
        if n == -1:
            chunk = self.data[self._cursor :]
            self._cursor = len(self.data)
        else:
            chunk = self.data[self._cursor : self._cursor + n]
            self._cursor += len(chunk)

        if chunk:
            self.uploaded += len(chunk)
            if self.callback:
                await self.callback(self.uploaded, self.total)

        return chunk


async def upload_with_retry(
    session,
    url,
    headers,
    data,
    max_retries=5,
    initial_delay=1,
    timeout=300,
    progress_callback=None,
):
    """Upload data with retry logic and progress tracking"""
    retries = 0
    total_size = len(data)

    while True:
        try:
            async with session.put(
                url,
                headers=headers,
                data=data,
                timeout=aiohttp.ClientTimeout(total=timeout),
            ) as response:
                if progress_callback:
                    await progress_callback(
                        total_size, total_size
                    )  # Mark as complete since we can't track progress

                if response.status >= 200 and response.status < 300:
                    return response
                else:
                    raise aiohttp.ClientError(
                        f"Upload failed with status {response.status}"
                    )

        except Exception as e:
            retries += 1
            if retries > max_retries:
                raise

            # Calculate delay with exponential backoff
            delay = initial_delay * (2 ** (retries - 1))
            logger.warning(
                f"Upload attempt {retries} failed: {str(e)}. Retrying in {delay}s..."
            )
            await asyncio.sleep(delay)


async def upload_file(
    prompt_id,
    filename,
    subfolder=None,
    content_type="image/png",
    type="output",
    item=None,
):
    """
    Uploads file to S3 bucket using S3 client object
    :return: None
    """
    filename, output_dir = folder_paths.annotated_filepath(filename)

    # validation for security: prevent accessing arbitrary path
    if filename[0] == "/" or ".." in filename:
        return

    if output_dir is None:
        output_dir = folder_paths.get_directory_by_type(type)

    if output_dir is None:
        logger.info(f"{filename} Upload failed: output_dir is None")
        return

    if subfolder != None:
        full_output_dir = os.path.join(output_dir, subfolder)
        if (
            os.path.commonpath((os.path.abspath(full_output_dir), output_dir))
            != output_dir
        ):
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

    target_url = f"{file_upload_endpoint}?file_name={filename}&run_id={prompt_id}&type={content_type}&version=v2"

    start_time = time.time()  # Start timing here
    # logger.info(f"Target URL: {target_url}")
    result = await async_request_with_retry(
        "GET", target_url, disable_timeout=True, token=token
    )
    end_time = time.time()  # End timing after the request is complete
    logger.info(
        "Time taken for getting file upload endpoint: {:.2f} seconds".format(
            end_time - start_time
        )
    )
    ok = await result.json()

    # logger.info(f"Result: {ok}")

    async with aiofiles.open(file, "rb") as f:
        data = await f.read()
        size = str(len(data))
        # logger.info(f"Image size: {size}")

        start_time = time.time()  # Start timing here
        headers = {
            "Content-Type": content_type,
            "Content-Length": size,
        }

        # logger.info(headers)

        if ok.get("include_acl") is True:
            headers["x-amz-acl"] = "public-read"

        # response = requests.put(ok.get("url"), headers=headers, data=data)
        # response = await async_request_with_retry('PUT', ok.get("url"), headers=headers, data=data)
        # logger.info(f"Upload file response status: {response.status}, status text: {response.reason}")

        async with aiohttp.ClientSession() as session:
            try:
                response = await upload_with_retry(
                    session, ok.get("url"), headers, data
                )
                # Process successful response...
            except Exception as e:
                # Handle final failure...
                logger.error(f"Upload ultimately failed: {str(e)}")

        end_time = time.time()  # End timing after the request is complete
        logger.info("Upload time: {:.2f} seconds".format(end_time - start_time))

    if item is not None:
        file_download_url = ok.get("download_url")
        if file_download_url is not None:
            item["url"] = file_download_url
        item["upload_duration"] = end_time - start_time
        if ok.get("is_public") is not None:
            item["is_public"] = ok.get("is_public")

    return item


def have_pending_upload(prompt_id):
    # Check if there are pending uploads in the queue
    if (
        prompt_id in upload_queue.pending_uploads
        and upload_queue.pending_uploads[prompt_id]
    ):
        logger.info(
            f"Have pending upload {len(upload_queue.pending_uploads[prompt_id])}"
        )
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
            "error": {"type": error_type, "message": str(e), "stack_trace": stack_trace}
        },
    }
    await update_file_status(prompt_id, data, False, have_error=True)
    logger.info(body)
    logger.info(f"Error occurred while uploading file: {e}")


# Mark the current prompt requires upload, and block it from being marked as success
async def update_file_status(
    prompt_id: str, data, uploading, have_error=False, node_id=None
):
    # We're using upload_queue as the single source of truth for tracking uploads
    # The upload_queue.pending_uploads is managed by the UploadQueue class itself
    # We no longer need to track uploading_nodes in prompt_metadata

    # logger.info(f"Pending uploads in queue: {upload_queue.pending_uploads.get(prompt_id, set())}")
    # Update the remote status

    if have_error:
        await update_run(prompt_id, Status.FAILED)
        await send(
            "failed",
            {
                "prompt_id": prompt_id,
            },
        )
        return

    # if there are still nodes that are uploading, then we set the status to uploading
    # if uploading:
    #     if prompt_metadata[prompt_id].status != Status.UPLOADING:
    #         await update_run(prompt_id, Status.UPLOADING)
    #         await send(
    #             "uploading",
    #             {
    #                 "prompt_id": prompt_id,
    #             },
    #         )

    # if there are no nodes that are uploading, then we set the status to success
    elif (
        not uploading
        and not have_pending_upload(prompt_id)
        and is_prompt_done(prompt_id=prompt_id)
    ):
        await update_run(prompt_id, Status.SUCCESS)
        # logger.info("Status: SUCCUSS")
        await send(
            "success",
            {
                "prompt_id": prompt_id,
            },
        )


async def handle_upload(
    prompt_id: str, data, key: str, content_type_key: str, default_content_type: str
):
    items = data.get(key, [])
    upload_tasks = []

    for item in items:
        # Skipping temp files
        if isinstance(item, dict) and item.get("type") == "temp":
            continue

        file_type = item.get(content_type_key, default_content_type)
        file_extension = os.path.splitext(item.get("filename"))[1]
        if file_extension in [".jpg", ".jpeg"]:
            file_type = "image/jpeg"
        elif file_extension == ".png":
            file_type = "image/png"
        elif file_extension == ".webp":
            file_type = "image/webp"
        elif file_extension == ".zip":
            file_type = "application/zip"
        elif file_extension in [".psd", ".psb"]:
            file_type = "image/vnd.adobe.photoshop"

        upload_tasks.append(
            upload_file(
                prompt_id,
                item.get("filename"),
                subfolder=item.get("subfolder"),
                type=item.get("type"),
                content_type=file_type,
                item=item,
            )
        )
        # await upload_file(
        #     prompt_id,
        #     item.get("filename"),
        #     subfolder=item.get("subfolder"),
        #     type=item.get("type"),
        #     content_type=file_type,
        #     item=item
        # )

    # Execute all upload tasks concurrently
    await asyncio.gather(*upload_tasks)


async def upload_in_background(
    prompt_id: str, data, node_id=None, have_upload=True, node_meta=None
):
    try:
        file_upload_endpoint = prompt_metadata[prompt_id].file_upload_endpoint

        if file_upload_endpoint is not None and file_upload_endpoint != "":
            # Flag to track if we need to update status after uploads
            has_uploads = False

            # Flatten all file types into a single list of uploads
            for file_type, content_type_key, default_content_type in [
                ("images", "content_type", "image/png"),
                ("files", "content_type", "image/png"),
                ("gifs", "format", "image/gif"),
                ("model_file", "format", "application/octet-stream"),
                ("result", "format", "application/octet-stream"),
                ("text_file", "format", "text/plain"),
                ("audio", "format", "audio/mpeg"),
            ]:
                items = data.get(file_type, [])

                for item in items:
                    # if is model_file, just add it to the data
                    if file_type == "model_file" or file_type == "result":
                        if isinstance(item, str):
                            filename = os.path.basename(item)
                            # Extract folder name from the path
                            folder_path = os.path.dirname(item)
                            subfolder = (
                                os.path.basename(folder_path) if folder_path else ""
                            )
                            item = {
                                "filename": filename,
                                "subfolder": subfolder,
                                "type": "output",
                            }

                    # Skip temp files
                    if isinstance(item, dict) and item.get("type") == "temp":
                        continue

                    # Add to the upload queue instead of uploading immediately
                    await upload_queue.add_upload(prompt_id, item, node_id)
                    has_uploads = True

            # Mark the prompt as needing uploads but still report data immediately
            if has_uploads:
                await update_file_status(prompt_id, data, True, node_id=node_id)
        else:
            logger.info("No file upload endpoint, skipping file upload")

        # Still update the API with the output data even if we're not uploading files
        # status_endpoint = prompt_metadata[prompt_id].status_endpoint
        # token = prompt_metadata[prompt_id].token
        # gpu_event_id = prompt_metadata[prompt_id].gpu_event_id or None

        # if have_upload and status_endpoint is not None:
        #     body = {
        #         "run_id": prompt_id,
        #         "output_data": data,
        #         "node_meta": node_meta,
        #         "gpu_event_id": gpu_event_id,
        #     }
        #     await async_request_with_retry(
        #         "POST", status_endpoint, token=token, json=body
        #     )

        # If no uploads are needed, update file status immediately
        if (
            not have_upload
            or file_upload_endpoint is None
            or file_upload_endpoint == ""
        ):
            await update_file_status(prompt_id, data, False, node_id=node_id)
    except Exception as e:
        await handle_error(prompt_id, data, e)


async def update_run_with_output(
    prompt_id, data, node_id=None, node_meta=None, gpu_event_id=None
):
    if prompt_id not in prompt_metadata:
        return

    if prompt_metadata[prompt_id].is_realtime is True:
        return

    status_endpoint = prompt_metadata[prompt_id].status_endpoint

    body = {
        "run_id": prompt_id,
        "output_data": data,
        "node_meta": node_meta,
        "gpu_event_id": gpu_event_id,
    }
    # pprint(body)
    have_upload_media = False
    if data is not None:
        have_upload_media = (
            "images" in data
            or "files" in data
            or "gifs" in data
            or "model_file" in data
            or "result" in data
            or "text_file" in data
            or "audio" in data
        )
    if bypass_upload and have_upload_media:
        print(
            "CD_BYPASS_UPLOAD is enabled, skipping the upload of the output:", node_id
        )
        return

    if have_upload_media:
        try:
            logger.info(f"\nHave_upload {have_upload_media} Node Id: {node_id}")

            if have_upload_media:
                await update_file_status(prompt_id, data, True, node_id=node_id)

            # asyncio.create_task(upload_in_background(prompt_id, data, node_id=node_id, have_upload=have_upload_media, node_meta=node_meta))
            await upload_in_background(
                prompt_id,
                data,
                node_id=node_id,
                have_upload=have_upload_media,
                node_meta=node_meta,
            )
            # await upload_in_background(prompt_id, data, node_id=node_id, have_upload=have_upload)

        except Exception as e:
            await handle_error(prompt_id, data, e)
    # requests.post(status_endpoint, json=body)
    elif status_endpoint is not None:
        token = prompt_metadata[prompt_id].token
        await async_request_with_retry("POST", status_endpoint, token=token, json=body)

    await send("outputs_uploaded", {"prompt_id": prompt_id})


prompt_server.send_json_original = prompt_server.send_json
prompt_server.send_json = send_json_override.__get__(prompt_server, server.PromptServer)

root_path = os.path.dirname(os.path.abspath(__file__))
two_dirs_up = os.path.dirname(os.path.dirname(root_path))
log_file_path = os.path.join(two_dirs_up, "comfy-deploy.log")
comfyui_file_path = os.path.join(two_dirs_up, "comfyui.log")

last_read_line = 0


async def watch_file_changes(file_path, callback):
    global last_read_line
    last_modified_time = os.stat(file_path).st_mtime
    while True:
        await asyncio.sleep(1)  # Use asyncio.sleep instead of time.sleep
        modified_time = os.stat(file_path).st_mtime
        if modified_time != last_modified_time:
            last_modified_time = modified_time
            with open(file_path, "r") as file:
                lines = file.readlines()
            if last_read_line > len(lines):
                last_read_line = 0  # Reset if log file has been rotated
            new_lines = lines[last_read_line:]
            last_read_line = len(lines)
            if new_lines:
                await callback("".join(new_lines))


async def send_first_time_log(sid):
    with open(log_file_path, "r") as file:
        lines = file.readlines()
    await send("LOGS", "".join(lines), sid)


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


# Initialize the upload queue when the module loads
async def initialize_upload_queue(app=None):
    """Initialize the upload queue and start the worker process"""
    logger.info("Initializing upload queue system...")
    await upload_queue.ensure_worker_running()
    logger.info(
        "Upload queue system initialized with max_concurrent=%d",
        upload_queue.max_concurrent,
    )

    # Start the queue monitoring task in the same event loop
    asyncio.create_task(monitor_upload_queue())


# Get the server's event loop and initialize there
server.PromptServer.instance.app.on_startup.append(initialize_upload_queue)


async def monitor_upload_queue():
    """Monitor the upload queue and log statistics periodically"""
    while True:
        try:
            queue_size = upload_queue.queue.qsize()
            pending_uploads_count = sum(
                len(uploads) for uploads in upload_queue.pending_uploads.values()
            )
            pending_prompts = len(upload_queue.pending_uploads)

            if queue_size > 0 or pending_uploads_count > 0:
                logger.info(
                    f"Upload queue status: {queue_size} queued, {pending_uploads_count} pending "
                    f"uploads across {pending_prompts} prompts"
                )

                # If queue is getting big, log a warning
                if queue_size > 20:
                    logger.warning(
                        f"Upload queue is large ({queue_size} items). Check for bottlenecks."
                    )

                # More detailed logging for large queue
                if queue_size > 50:
                    for prompt_id, uploads in upload_queue.pending_uploads.items():
                        logger.warning(
                            f"Prompt {prompt_id[:8]}... has {len(uploads)} pending uploads"
                        )
        except Exception as e:
            logger.error(f"Error in upload queue monitor: {str(e)}")

        # Check every 30 seconds
        await asyncio.sleep(30)


# use after calling GET /object_info (it populates the `filename_list_cache` variable)
@server.PromptServer.instance.routes.get("/comfyui-deploy/filename_list_cache")
async def get_filename_list_cache(_):
    from folder_paths import filename_list_cache

    return web.json_response({"filename_list": filename_list_cache})


@server.PromptServer.instance.routes.get("/comfyui-deploy/upload-queue-status")
async def get_upload_queue_status(request):
    """Get the current status of the upload queue"""
    prompt_id = request.rel_url.query.get("prompt_id", None)

    queue_size = upload_queue.queue.qsize()
    pending_uploads_count = sum(
        len(uploads) for uploads in upload_queue.pending_uploads.values()
    )

    status_data = {
        "queue_size": queue_size,
        "pending_uploads": pending_uploads_count,
        "max_concurrent": upload_queue.max_concurrent,
    }

    # If prompt_id is provided, add specific data for that prompt
    if prompt_id and prompt_id in upload_queue.pending_uploads:
        prompt_pending = len(upload_queue.pending_uploads[prompt_id])
        status_data["prompt_pending"] = prompt_pending
        status_data["prompt_id"] = prompt_id

    return web.json_response(status_data)


@server.PromptServer.instance.routes.post("/comfyui-deploy/cancel-uploads")
async def cancel_prompt_uploads(request):
    """Cancel all pending uploads for a specific prompt"""
    data = await request.json()
    prompt_id = data.get("prompt_id")

    if not prompt_id:
        return web.json_response({"error": "prompt_id is required"}, status=400)

    success = await upload_queue.cancel_uploads_for_prompt(prompt_id)

    if success:
        # Also update the prompt status
        if prompt_id in prompt_metadata:
            # Mark as SUCCESS since we're not waiting for uploads anymore
            await update_run(prompt_id, Status.SUCCESS)
            return web.json_response(
                {
                    "success": True,
                    "message": f"Cancelled pending uploads for prompt {prompt_id}",
                }
            )

    return web.json_response(
        {
            "success": False,
            "message": f"No pending uploads found for prompt {prompt_id}",
        },
        status=404,
    )


class UploadQueue:
    def __init__(self, max_concurrent=3):
        self.queue = asyncio.Queue()
        self.max_concurrent = max_concurrent
        self.active_uploads = 0
        self.worker_task = None
        self.lock = asyncio.Lock()
        self.pending_uploads = {}  # prompt_id -> set of pending upload tasks
        self.node_uploads = {}  # prompt_id -> {node_id -> set of pending upload tasks}
        self.node_output_data = {}  # prompt_id -> {node_id -> output data}
        self.upload_stats = {}  # prompt_id -> {filename: {stats}}
        self.upload_timeline = {}  # prompt_id -> list of upload events with timing
        self.last_status_update = 0
        self.status_update_interval = 5
        self.upload_lock = asyncio.Lock()  # Add lock for upload coordination
        self.last_upload_time = 0  # Track the last upload start time
        self.STAGGER_DELAY = 0.05  # Stagger delay in seconds

    def _log_upload_stats(self, prompt_id):
        """Log upload statistics in a formatted table with waterfall timing"""
        if prompt_id not in self.upload_stats or not self.upload_stats[prompt_id]:
            return

        stats = self.upload_stats[prompt_id]
        timeline = self.upload_timeline[prompt_id]

        # Sort timeline by start time
        timeline.sort(key=lambda x: x["start_time"])
        first_start = min(event["start_time"] for event in timeline)

        headers = [
            "Node",
            "File",
            "Size",
            "Start Time",
            "Duration",
            "Speed",
            "Timeline",
        ]
        data = []

        # Calculate timeline scale (80 chars wide)
        total_duration = max(event["end_time"] for event in timeline) - first_start
        scale = 80.0 / total_duration if total_duration > 0 else 1.0

        for event in timeline:
            filename = event["filename"]
            file_stats = stats[filename]

            # Calculate timeline bar position and width
            start_offset = event["start_time"] - first_start
            duration = event["end_time"] - event["start_time"]
            bar_start = int(start_offset * scale)
            bar_width = max(1, int(duration * scale))

            # Create timeline bar
            timeline_bar = " " * bar_start + "=" * bar_width

            # Format size and speed
            size_mb = file_stats["size"] / (1024 * 1024)
            speed_mb = file_stats["size"] / (file_stats["upload_time"] * 1024 * 1024)

            # Format relative time
            start_time = f"+{start_offset:.2f}s"

            data.append(
                [
                    event["node_name"] or "-",
                    filename,
                    f"{size_mb:.2f}MB",
                    start_time,
                    f"{duration:.2f}s",
                    f"{speed_mb:.2f}MB/s",
                    timeline_bar,
                ]
            )

        logger.info("\nUpload Performance Summary:")
        logger.info(format_table(headers, data))

        # Calculate and show totals
        total_size = sum(s["size"] for s in stats.values())
        total_time = total_duration
        avg_speed = total_size / (total_time * 1024 * 1024) if total_time > 0 else 0

        logger.info(f"\nTotal Stats:")
        logger.info(f"Total Size: {total_size / (1024 * 1024):.2f}MB")
        logger.info(f"Total Time: {total_time:.2f}s")
        logger.info(f"Average Speed: {avg_speed:.2f}MB/s")

    async def _process_upload(self, prompt_id, file_info, node_id):
        """Process a single file upload"""
        if prompt_id not in prompt_metadata:
            logger.warning(f"Cannot upload for unknown prompt ID: {prompt_id}")
            return

        file_upload_endpoint = prompt_metadata[prompt_id].file_upload_endpoint
        token = prompt_metadata[prompt_id].token

        if not file_upload_endpoint:
            logger.warning(f"No upload endpoint for prompt ID: {prompt_id}")
            return

        # Check if file_info is a valid dictionary with a filename
        if not isinstance(file_info, dict) or "filename" not in file_info:
            logger.warning(f"Invalid file_info for prompt ID {prompt_id}: {file_info}")
            return

        filename = file_info.get("filename")
        subfolder = file_info.get("subfolder")
        file_type = file_info.get("type", "output")

        # Initialize tracking for this prompt if needed
        if prompt_id not in self.upload_stats:
            self.upload_stats[prompt_id] = {}
            self.upload_timeline[prompt_id] = []

        # Determine content type based on file extension
        file_extension = os.path.splitext(filename)[1]
        if file_extension in [".jpg", ".jpeg"]:
            content_type = "image/jpeg"
        elif file_extension == ".png":
            content_type = "image/png"
        elif file_extension == ".webp":
            content_type = "image/webp"
        elif file_extension == ".gif":
            content_type = "image/gif"
        elif file_extension == ".zip":
            content_type = "application/zip"
        elif file_extension in [".psd", ".psb"]:
            content_type = "image/vnd.adobe.photoshop"
        else:
            content_type = file_info.get("content_type", "application/octet-stream")

        # Get node name from metadata if available
        node_name = None
        if node_id and prompt_id in prompt_metadata:
            workflow_api = prompt_metadata[prompt_id].workflow_api
            node = workflow_api.get(node_id)
            if node:
                node_name = node.get("class_type", "")

        # Get the full file path and validate
        filename, output_dir = folder_paths.annotated_filepath(filename)
        if filename[0] == "/" or ".." in filename:
            logger.warning(f"Insecure filename path: {filename}")
            return

        if output_dir is None:
            output_dir = folder_paths.get_directory_by_type(file_type)

        if output_dir is None:
            logger.warning(f"{filename} Upload failed: output_dir is None")
            return

        if subfolder is not None:
            full_output_dir = os.path.join(output_dir, subfolder)
            if (
                os.path.commonpath((os.path.abspath(full_output_dir), output_dir))
                != output_dir
            ):
                logger.warning(f"Insecure subfolder path: {subfolder}")
                return
            output_dir = full_output_dir

        filename_base = os.path.basename(filename)
        file_path = os.path.join(output_dir, filename_base)

        # Record start time
        start_time = time.perf_counter()

        try:
            # Get the signed upload URL
            filename_quoted = quote(filename_base)
            prompt_id_quoted = quote(prompt_id)
            content_type_quoted = quote(content_type)
            target_url = f"{file_upload_endpoint}?file_name={filename_quoted}&run_id={prompt_id_quoted}&type={content_type_quoted}&version=v2"

            result = await async_request_with_retry(
                "GET", target_url, disable_timeout=True, token=token
            )
            signed_url_data = await result.json()

            # Read and upload the file
            async with aiofiles.open(file_path, "rb") as f:
                data = await f.read()
                size = len(data)

                headers = {
                    "Content-Type": content_type,
                    "Content-Length": str(size),
                }

                if signed_url_data.get("include_acl") is True:
                    headers["x-amz-acl"] = "public-read"

                async with aiohttp.ClientSession() as session:
                    response = await upload_with_retry(
                        session,
                        signed_url_data.get("url"),
                        headers,
                        data,
                    )

                    # Record upload success and timing
                    end_time = time.perf_counter()
                    upload_time = end_time - start_time

                    # Store upload statistics
                    self.upload_stats[prompt_id][filename_base] = {
                        "size": size,
                        "type": content_type,
                        "upload_time": upload_time,
                    }

                    # Store timeline event
                    self.upload_timeline[prompt_id].append(
                        {
                            "filename": filename_base,
                            "node_id": node_id,
                            "node_name": node_name,
                            "start_time": start_time
                            - prompt_metadata[prompt_id].start_time,
                            "end_time": end_time
                            - prompt_metadata[prompt_id].start_time,
                        }
                    )

                    # Update the file_info with download URL and timing
                    file_info["url"] = signed_url_data.get("download_url")
                    file_info["upload_duration"] = upload_time
                    if signed_url_data.get("is_public") is not None:
                        file_info["is_public"] = signed_url_data.get("is_public")

                    # Update node output data if this upload is associated with a node
                    if (
                        node_id
                        and prompt_id in self.node_output_data
                        and node_id in self.node_output_data[prompt_id]
                    ):
                        node_data = self.node_output_data[prompt_id][node_id]
                        file_type_key = (
                            "images" if content_type.startswith("image/") else "files"
                        )
                        if file_type_key not in node_data["data"]:
                            node_data["data"][file_type_key] = []
                        node_data["data"][file_type_key].append(file_info)

                    # Send success status to clients
                    await send(
                        "upload_success",
                        {
                            "prompt_id": prompt_id,
                            "filename": filename_base,
                            "url": file_info["url"],
                            "node_id": node_id,
                        },
                    )

                    # If this was the last file for this prompt, show the stats summary
                    if (
                        prompt_id in self.pending_uploads
                        # We now rely on the worker's finally block for the final SUCCESS update.
                        # Check if the set becomes empty *after* removal in the worker.
                        and len(self.pending_uploads[prompt_id]) == 1
                    ):
                        # await update_run(prompt_id, Status.SUCCESS) # <-- REMOVE/COMMENT OUT

                        self._log_upload_stats(prompt_id)
                        # Clean up stats
                        del self.upload_stats[prompt_id]
                        del self.upload_timeline[prompt_id]

        except Exception as e:
            logger.error(f"\nUpload failed for {filename_base}: {str(e)}")
            await send(
                "upload_failed",
                {
                    "prompt_id": prompt_id,
                    "filename": filename_base,
                    "error": str(e),
                    "node_id": node_id,
                },
            )
            raise

    async def add_upload(self, prompt_id, file_info, node_id=None):
        """Add a file to the upload queue"""
        # Initialize the pending uploads set for this prompt if needed
        if prompt_id not in self.pending_uploads:
            self.pending_uploads[prompt_id] = set()
            self.node_uploads[prompt_id] = {}
            self.node_output_data[prompt_id] = {}

        # Initialize node tracking if needed
        if node_id and node_id not in self.node_uploads[prompt_id]:
            self.node_uploads[prompt_id][node_id] = set()
            self.node_output_data[prompt_id][node_id] = {"data": {}}

        # Add a unique identifier for this upload
        upload_id = str(uuid.uuid4())
        self.pending_uploads[prompt_id].add(upload_id)

        # Track upload for specific node if provided
        if node_id:
            self.node_uploads[prompt_id][node_id].add(upload_id)

        # Add to the queue
        await self.queue.put(
            {
                "prompt_id": prompt_id,
                "file_info": file_info,
                "node_id": node_id,
                "upload_id": upload_id,
            }
        )

        # Send status update to clients
        await self.update_queue_status(prompt_id)

        # Ensure worker is running
        await self.ensure_worker_running()

        return upload_id

    async def ensure_worker_running(self):
        """Ensure the worker task is running"""
        async with self.lock:
            if self.worker_task is None or self.worker_task.done():
                self.worker_task = asyncio.create_task(self.worker())

    async def update_queue_status(self, prompt_id=None):
        """Send queue status updates to clients"""
        # Throttle updates to avoid flooding clients
        current_time = time.time()
        if current_time - self.last_status_update < self.status_update_interval:
            return

        self.last_status_update = current_time

        queue_size = self.queue.qsize()
        pending_uploads_count = sum(
            len(uploads) for uploads in self.pending_uploads.values()
        )

        status_data = {
            "queue_size": queue_size,
            "pending_uploads": pending_uploads_count,
            "max_concurrent": self.max_concurrent,
        }

        # If prompt_id is provided, add specific data for that prompt
        if prompt_id and prompt_id in self.pending_uploads:
            prompt_pending = len(self.pending_uploads[prompt_id])
            status_data["prompt_pending"] = prompt_pending
            status_data["prompt_id"] = prompt_id

            # Send targeted status update to relevant clients
            await send("upload_queue_status", status_data, prompt_id)
        else:
            # Send global update to all clients
            await send("upload_queue_status", status_data)

    async def worker(self):
        """Worker process that manages the upload queue"""
        # Start multiple worker tasks within concurrency limits
        workers = [
            asyncio.create_task(self.upload_worker())
            for _ in range(self.max_concurrent)
        ]

        # Wait for all workers to complete (should only happen on shutdown)
        await asyncio.gather(*workers)

    async def upload_worker(self):
        """Individual worker that processes uploads from the queue"""
        loop = asyncio.get_event_loop()

        while True:
            try:
                # Get next upload task first
                upload_task = await self.queue.get()

                prompt_id = upload_task["prompt_id"]
                file_info = upload_task["file_info"]
                node_id = upload_task["node_id"]
                upload_id = upload_task["upload_id"]

                print(file_info)

                try:
                    # Coordinate the actual start of the upload
                    async with self.upload_lock:
                        current_time = time.time()
                        time_since_last = current_time - self.last_upload_time
                        if time_since_last < self.STAGGER_DELAY:
                            await asyncio.sleep(self.STAGGER_DELAY - time_since_last)
                        self.last_upload_time = time.time()
                        # Start the actual upload while holding the lock
                    # to ensure true staggering
                    await self._process_upload(prompt_id, file_info, node_id)
                except Exception as e:
                    logger.error(f"Upload failed: {str(e)}")
                    logger.error(traceback.format_exc())
                finally:
                    async with self.lock:  # Acquire lock to protect shared dict access
                        if prompt_id in self.pending_uploads:
                            self.pending_uploads[prompt_id].discard(upload_id)

                            if (
                                node_id
                                and prompt_id in self.node_uploads
                                and node_id in self.node_uploads[prompt_id]
                            ):
                                self.node_uploads[prompt_id][node_id].discard(upload_id)

                                if not self.node_uploads[prompt_id][node_id]:
                                    del self.node_uploads[prompt_id][node_id]

                                    if (
                                        prompt_id in self.node_output_data
                                        and node_id in self.node_output_data[prompt_id]
                                    ):
                                        node_data = self.node_output_data[prompt_id][
                                            node_id
                                        ]
                                        if node_data["data"]:
                                            body = {
                                                "run_id": prompt_id,
                                                "output_data": node_data["data"],
                                                "node_meta": {"node_id": node_id},
                                            }
                                            try:
                                                await async_request_with_retry(
                                                    "POST",
                                                    prompt_metadata[
                                                        prompt_id
                                                    ].status_endpoint,
                                                    token=prompt_metadata[
                                                        prompt_id
                                                    ].token,
                                                    json=body,
                                                )
                                            except Exception as e:
                                                logger.error(
                                                    f"Failed to send final node data: {str(e)}"
                                                )

                                        # Safe to delete now (re-check not strictly needed with lock, but harmless)
                                        del self.node_output_data[prompt_id][node_id]

                        # If no more pending uploads for this prompt and it's done, update status
                        if (
                            prompt_id in self.pending_uploads
                            and not self.pending_uploads[prompt_id]
                            and is_prompt_done(prompt_id)
                        ):
                            # Clean up all data for this prompt
                            if prompt_id in self.node_uploads:
                                del self.node_uploads[prompt_id]
                            if prompt_id in self.node_output_data:
                                del self.node_output_data[prompt_id]
                            del self.pending_uploads[prompt_id]

                            # Use the same event loop for these tasks
                            loop.create_task(update_run(prompt_id, Status.SUCCESS))
                            loop.create_task(send("success", {"prompt_id": prompt_id}))

                    # Mark task as done (outside lock to avoid holding it unnecessarily)
                    self.queue.task_done()

                    # Send status update (also outside lock)
                    await self.update_queue_status(prompt_id)

            except Exception as e:
                logger.error(f"Error in upload worker: {str(e)}")
                logger.error(traceback.format_exc())
                # Brief pause to prevent tight loop in case of persistent errors
                await asyncio.sleep(0.5)

    async def cancel_uploads_for_prompt(self, prompt_id):
        """Cancel all pending uploads for a prompt"""
        if prompt_id in self.pending_uploads:
            # Remove all pending uploads for this prompt
            self.pending_uploads[prompt_id].clear()
            self.node_uploads[prompt_id].clear()
            self.node_output_data[prompt_id].clear()

            # Clean up
            del self.pending_uploads[prompt_id]
            del self.node_uploads[prompt_id]
            del self.node_output_data[prompt_id]

            # Send status update
            await self.update_queue_status(prompt_id)


# Create a global instance of the upload queue
upload_queue = UploadQueue(max_concurrent=3)  # Limit to 3 concurrent uploads


def format_execution_timeline(execution_times):
    """Format node execution times into a table with timeline visualization"""
    if not execution_times:
        return "No execution data available"

    # Calculate total time and start times for each node
    sorted_nodes = sorted(execution_times.items(), key=lambda x: x[1]["time"])
    total_duration = sum(node["time"] for _, node in execution_times.items())

    # Prepare table data
    headers = ["Node", "Type", "Duration", "VRAM", "Timeline"]
    rows = []
    current_time = 0

    # Calculate timeline width (e.g., 80 chars)
    TIMELINE_WIDTH = 80

    for node_id, data in sorted_nodes:
        # Calculate the start position and width for the timeline
        duration = data["time"]
        vram_mb = data["vram_used"] / (1024 * 1024)  # Convert to MB
        start_pos = int((current_time / total_duration) * TIMELINE_WIDTH)
        width = max(1, int((duration / total_duration) * TIMELINE_WIDTH))

        # Create the timeline visualization
        timeline = (
            " " * start_pos + "=" * width + " " * (TIMELINE_WIDTH - start_pos - width)
        )

        # Add the row
        rows.append(
            [
                f"#{node_id}",
                data["class_type"],
                f"{duration:.2f}s",
                f"{vram_mb:.1f}MB",
                timeline,
            ]
        )

        current_time += duration

    return format_table(headers, rows)


@server.PromptServer.instance.routes.get("/comfyui-deploy/auth-response")
async def auth_response_proxy(request):
    request_id = request.rel_url.query.get("request_id")
    api_url = request.rel_url.query.get("api_url", "https://api.comfydeploy.com")

    if not request_id:
        return web.json_response({"error": "request_id is required"}, status=400)

    target_url = f"{api_url}/api/platform/comfyui/auth-response?request_id={request_id}"

    try:
        await ensure_client_session()
        async with client_session.get(target_url) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/comfyui-deploy/workflow")
async def create_workflow_proxy(request):
    data = await request.json()
    name = data.get("name")
    workflow_json = data.get("workflow_json")
    workflow_api = data.get("workflow_api")
    machine_id = data.get("machine_id")
    api_url = data.get("api_url", "https://api.comfydeploy.com")

    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return web.json_response(
            {"error": "Authorization header is required"}, status=401
        )

    if not name or not workflow_json or not workflow_api:
        return web.json_response(
            {"error": "name, workflow_json, workflow_api are required"}, status=400
        )

    target_url = f"{api_url}/api/workflow"

    request_body = {
        "name": name,
        "workflow_json": json.dumps(workflow_json),
        "workflow_api": json.dumps(workflow_api),
        "machine_id": machine_id,
    }

    try:
        await ensure_client_session()
        async with client_session.post(
            target_url,
            json=request_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": auth_header,
            },
        ) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/comfyui-deploy/workflow/version")
async def create_workflow_version_proxy(request):
    data = await request.json()
    workflow_id = data.get("workflow_id")
    workflow = data.get("workflow")
    workflow_api = data.get("workflow_api")
    comment = data.get("comment", "")
    api_url = data.get("api_url", "https://api.comfydeploy.com")

    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return web.json_response(
            {"error": "Authorization header is required"}, status=401
        )

    target_url = f"{api_url}/api/workflow/{workflow_id}/version"

    request_body = {
        "workflow": workflow,
        "workflow_api": workflow_api,
        "comment": comment,
    }

    try:
        await ensure_client_session()
        async with client_session.post(
            target_url,
            json=request_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": auth_header,
            },
        ) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@server.PromptServer.instance.routes.get("/comfyui-deploy/workflows")
async def get_workflows_proxy(request):
    api_url = request.rel_url.query.get("api_url", "https://api.comfydeploy.com")
    search = request.rel_url.query.get("search", "")
    limit = request.rel_url.query.get("limit", 10)
    offset = request.rel_url.query.get("offset", 0)
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return web.json_response(
            {"error": "Authorization header is required"}, status=401
        )

    # Build query parameters properly
    params = {}
    if search:
        params["search"] = search
    if limit:
        params["limit"] = limit
    if offset:
        params["offset"] = offset

    target_url = f"{api_url}/api/workflows"
    if params:
        target_url += f"?{urlencode(params)}"

    try:
        await ensure_client_session()
        async with client_session.get(
            target_url,
            headers={
                "Content-Type": "application/json",
                "Authorization": auth_header,
            },
        ) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# for getting a workflow by id
@server.PromptServer.instance.routes.get("/comfyui-deploy/workflow")
async def get_workflow_proxy(request):
    workflow_id = request.rel_url.query.get("workflow_id")
    api_url = request.rel_url.query.get("api_url", "https://api.comfydeploy.com")
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return web.json_response(
            {"error": "Authorization header is required"}, status=401
        )

    target_url = f"{api_url}/api/workflow/{workflow_id}"

    try:
        await ensure_client_session()
        async with client_session.get(
            target_url, headers={"Authorization": auth_header}
        ) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# fetch workflow versions (infinite scroll support)
@server.PromptServer.instance.routes.get("/comfyui-deploy/workflow/versions")
async def get_workflow_versions_proxy(request):
    workflow_id = request.rel_url.query.get("workflow_id")
    api_url = request.rel_url.query.get("api_url", "https://api.comfydeploy.com")
    search = request.rel_url.query.get("search", "")
    limit = request.rel_url.query.get("limit", "20")
    offset = request.rel_url.query.get("offset", "0")
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return web.json_response(
            {"error": "Authorization header is required"}, status=401
        )

    # Build target URL with query params
    params = {"limit": limit, "offset": offset}
    if search:
        params["search"] = search

    query = urlencode(params)
    target_url = f"{api_url}/api/workflow/{workflow_id}/versions"
    if query:
        target_url += f"?{query}"

    try:
        await ensure_client_session()
        async with client_session.get(
            target_url, headers={"Authorization": auth_header}
        ) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# fetch a specific workflow version json
@server.PromptServer.instance.routes.get("/comfyui-deploy/workflow/version")
async def get_workflow_version_proxy(request):
    workflow_id = request.rel_url.query.get("workflow_id")
    version = request.rel_url.query.get("version")
    api_url = request.rel_url.query.get("api_url", "https://api.comfydeploy.com")
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return web.json_response(
            {"error": "Authorization header is required"}, status=401
        )

    target_url = f"{api_url}/api/workflow/{workflow_id}/version/{version}"

    try:
        await ensure_client_session()
        async with client_session.get(
            target_url, headers={"Authorization": auth_header}
        ) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# for getting a machine by id
@server.PromptServer.instance.routes.get("/comfyui-deploy/machine")
async def get_machine_proxy(request):
    machine_id = request.rel_url.query.get("machine_id")
    api_url = request.rel_url.query.get("api_url", "https://api.comfydeploy.com")
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return web.json_response(
            {"error": "Authorization header is required"}, status=401
        )

    target_url = f"{api_url}/api/machine/{machine_id}"

    try:
        await ensure_client_session()
        async with client_session.get(
            target_url, headers={"Authorization": auth_header}
        ) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# for fetching docker steps from current snapshot
@server.PromptServer.instance.routes.post("/comfyui-deploy/snapshot-to-docker")
async def snapshot_to_docker_proxy(request):
    data = await request.json()
    snapshot = data.get("snapshot")
    api_url = data.get("api_url", "https://api.comfydeploy.com")
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return web.json_response(
            {"error": "Authorization header is required"}, status=401
        )

    target_url = f"{api_url}/api/snapshot-to-docker"

    request_body = snapshot

    try:
        await ensure_client_session()
        async with client_session.post(
            target_url, json=request_body, headers={"Authorization": auth_header}
        ) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# update a serverless machine with machine id
@server.PromptServer.instance.routes.post("/comfyui-deploy/machine/update")
async def update_machine_proxy(request):
    data = await request.json()
    machine_id = data.get("machine_id")
    comfyui_version = data.get("comfyui_version", None)
    docker_steps = data.get("docker_steps")
    api_url = data.get("api_url", "https://api.comfydeploy.com")
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return web.json_response(
            {"error": "Authorization header is required"}, status=401
        )

    target_url = f"{api_url}/api/machine/serverless/{machine_id}"

    request_body = {"docker_command_steps": docker_steps}

    if comfyui_version:
        request_body["comfyui_version"] = comfyui_version

    try:
        await ensure_client_session()
        async with client_session.patch(
            target_url, json=request_body, headers={"Authorization": auth_header}
        ) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/comfyui-deploy/machine/create")
async def create_machine_proxy(request):
    data = await request.json()
    name = data.get("name")
    docker_command_steps = data.get("docker_command_steps")
    comfyui_version = data.get("comfyui_version")
    api_url = data.get("api_url", "https://api.comfydeploy.com")
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return web.json_response(
            {"error": "Authorization header is required"}, status=401
        )

    target_url = f"{api_url}/api/machine/serverless"

    request_body = {
        "name": name,
        "docker_command_steps": docker_command_steps,
        "comfyui_version": comfyui_version,
        "gpu": "A10G",
    }

    try:
        await ensure_client_session()
        async with client_session.post(
            target_url, json=request_body, headers={"Authorization": auth_header}
        ) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# get latest comfyui version
@server.PromptServer.instance.routes.get("/comfyui-deploy/comfyui-version")
async def get_comfyui_version_proxy(request):
    api_url = request.rel_url.query.get("api_url", "https://api.comfydeploy.com")
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return web.json_response(
            {"error": "Authorization header is required"}, status=401
        )

    target_url = f"{api_url}/api/latest-hashes"

    try:
        await ensure_client_session()
        async with client_session.get(
            target_url, headers={"Authorization": auth_header}
        ) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# Proxy: generate single-part upload URL
@server.PromptServer.instance.routes.post(
    "/comfyui-deploy/volume/file/generate-upload-url"
)
async def proxy_generate_upload_url(request):
    data = await request.json()
    api_url = data.get("api_url", "https://api.comfydeploy.com")
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return web.json_response(
            {"error": "Authorization header is required"}, status=401
        )

    target_url = f"{api_url}/api/volume/file/generate-upload-url"

    try:
        await ensure_client_session()
        async with client_session.post(
            target_url,
            json={
                "filename": data.get("filename"),
                "contentType": data.get("contentType"),
                "size": data.get("size"),
            },
            headers={"Authorization": auth_header},
        ) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# Proxy: initiate multipart upload
@server.PromptServer.instance.routes.post(
    "/comfyui-deploy/volume/file/initiate-multipart-upload"
)
async def proxy_initiate_multipart_upload(request):
    data = await request.json()
    api_url = data.get("api_url", "https://api.comfydeploy.com")
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return web.json_response(
            {"error": "Authorization header is required"}, status=401
        )

    target_url = f"{api_url}/api/volume/file/initiate-multipart-upload"

    try:
        await ensure_client_session()
        async with client_session.post(
            target_url,
            json={
                "filename": data.get("filename"),
                "contentType": data.get("contentType"),
                "size": data.get("size"),
            },
            headers={"Authorization": auth_header},
        ) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# Proxy: generate part upload URL
@server.PromptServer.instance.routes.post(
    "/comfyui-deploy/volume/file/generate-part-upload-url"
)
async def proxy_generate_part_upload_url(request):
    data = await request.json()
    api_url = data.get("api_url", "https://api.comfydeploy.com")
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return web.json_response(
            {"error": "Authorization header is required"}, status=401
        )

    target_url = f"{api_url}/api/volume/file/generate-part-upload-url"

    try:
        await ensure_client_session()
        async with client_session.post(
            target_url,
            json={
                "uploadId": data.get("uploadId"),
                "key": data.get("key"),
                "partNumber": data.get("partNumber"),
            },
            headers={"Authorization": auth_header},
        ) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# Proxy: complete multipart upload
@server.PromptServer.instance.routes.post(
    "/comfyui-deploy/volume/file/complete-multipart-upload"
)
async def proxy_complete_multipart_upload(request):
    data = await request.json()
    api_url = data.get("api_url", "https://api.comfydeploy.com")
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return web.json_response(
            {"error": "Authorization header is required"}, status=401
        )

    target_url = f"{api_url}/api/volume/file/complete-multipart-upload"

    try:
        await ensure_client_session()
        async with client_session.post(
            target_url,
            json={
                "uploadId": data.get("uploadId"),
                "key": data.get("key"),
                "parts": data.get("parts"),
            },
            headers={"Authorization": auth_header},
        ) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# Proxy: abort multipart upload
@server.PromptServer.instance.routes.post(
    "/comfyui-deploy/volume/file/abort-multipart-upload"
)
async def proxy_abort_multipart_upload(request):
    data = await request.json()
    api_url = data.get("api_url", "https://api.comfydeploy.com")
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return web.json_response(
            {"error": "Authorization header is required"}, status=401
        )

    target_url = f"{api_url}/api/volume/file/abort-multipart-upload"

    try:
        await ensure_client_session()
        async with client_session.post(
            target_url,
            json={
                "uploadId": data.get("uploadId"),
                "key": data.get("key"),
            },
            headers={"Authorization": auth_header},
        ) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# Proxy: add model (unified endpoint)
@server.PromptServer.instance.routes.post("/comfyui-deploy/volume/model")
async def proxy_add_model(request):
    data = await request.json()
    api_url = data.get("api_url", "https://api.comfydeploy.com")
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return web.json_response(
            {"error": "Authorization header is required"}, status=401
        )

    target_url = f"{api_url}/api/volume/model"

    # pass body through but remove api_url key
    forward_body = dict(data)
    if "api_url" in forward_body:
        forward_body.pop("api_url")

    try:
        await ensure_client_session()
        async with client_session.post(
            target_url, json=forward_body, headers={"Authorization": auth_header}
        ) as response:
            json_data = await response.json()
            return web.json_response(json_data, status=response.status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# FS: stat file (size)
@server.PromptServer.instance.routes.get("/comfyui-deploy/fs/stat")
async def fs_stat(request):
    try:
        import os

        file_path = request.rel_url.query.get("path")
        if not file_path:
            return web.json_response({"error": "path is required"}, status=400)

        # Basic safeguard: ensure it's a ComfyUI models path
        if "/models/" not in file_path:
            return web.json_response({"error": "invalid path"}, status=400)

        st = os.stat(file_path)
        return web.json_response({"size": st.st_size})
    except FileNotFoundError:
        return web.json_response({"error": "not found"}, status=404)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# Upload a multipart part directly from machine filesystem to S3 upload URL
@server.PromptServer.instance.routes.post(
    "/comfyui-deploy/volume/file/upload-part-from-path"
)
async def upload_part_from_path(request):
    try:
        import os
        import io

        data = await request.json()
        file_path = data.get("filePath")
        upload_url = data.get("uploadUrl")
        start = int(data.get("start", 0))
        end = int(data.get("end", 0))
        if not file_path or not upload_url:
            return web.json_response(
                {"error": "filePath and uploadUrl are required"}, status=400
            )
        if "/models/" not in file_path:
            return web.json_response({"error": "invalid filePath"}, status=400)
        if end <= start:
            return web.json_response({"error": "invalid byte range"}, status=400)

        size = end - start

        await ensure_client_session()

        # Important: S3 pre-signed part uploads do not support chunked transfer
        # Buffer the exact part into memory to provide a Content-Length header
        buffer = bytearray()
        chunk_size = 4 * 1024 * 1024
        with open(file_path, "rb") as f:
            f.seek(start)
            remaining = size
            while remaining > 0:
                to_read = chunk_size if remaining >= chunk_size else remaining
                chunk = f.read(to_read)
                if not chunk:
                    break
                buffer.extend(chunk)
                remaining -= len(chunk)

        if len(buffer) != size:
            return web.json_response(
                {
                    "error": "read size mismatch",
                    "expected": size,
                    "actual": len(buffer),
                },
                status=500,
            )

        headers = {
            "Content-Length": str(size),
            "Content-Type": "application/octet-stream",
        }

        async with client_session.put(
            upload_url, data=bytes(buffer), headers=headers
        ) as resp:
            text = await resp.text()
            if resp.status < 200 or resp.status >= 300:
                return web.json_response(
                    {"error": f"upload failed: {resp.status}", "body": text},
                    status=resp.status,
                )
            etag = resp.headers.get("ETag") or resp.headers.get("etag") or ""
            etag = etag.replace('"', "")
            return web.json_response({"eTag": etag, "bytesSent": size})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)
