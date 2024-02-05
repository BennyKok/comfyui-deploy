from aiohttp import web
import os
import requests
import folder_paths
import json
import numpy as np
import server
import re
import base64
from PIL import Image
import io
import time
import execution
import random
import traceback
import uuid
import asyncio
import atexit
import logging
import sys
from logging.handlers import RotatingFileHandler
from enum import Enum
from urllib.parse import quote
import threading
import hashlib
import aiohttp

api = None
api_task = None
prompt_metadata = {}
cd_enable_log = os.environ.get('CD_ENABLE_LOG', 'false').lower() == 'true'
cd_enable_run_log = os.environ.get('CD_ENABLE_RUN_LOG', 'false').lower() == 'true'

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
            print("invalid prompt:", valid[1])
            return {"error": valid[1], "node_errors": valid[3]}
    else:
        return {"error": "no prompt", "node_errors": []}

def randomSeed(num_digits=15):
    range_start = 10 ** (num_digits - 1)
    range_end = (10**num_digits) - 1
    return random.randint(range_start, range_end)

@server.PromptServer.instance.routes.post("/comfyui-deploy/run")
async def comfy_deploy_run(request):
    prompt_server = server.PromptServer.instance
    data = await request.json()

    workflow_api = data.get("workflow_api")

    # The prompt id generated from comfy deploy, can be None
    prompt_id = data.get("prompt_id")

    for key in workflow_api:
        if 'inputs' in workflow_api[key] and 'seed' in workflow_api[key]['inputs']:
            workflow_api[key]['inputs']['seed'] = randomSeed()

    prompt = {
        "prompt": workflow_api,
        "client_id": "comfy_deploy_instance", #api.client_id
        "prompt_id": prompt_id
    }

    prompt_metadata[prompt_id] = {
        'status_endpoint': data.get('status_endpoint'),
        'file_upload_endpoint': data.get('file_upload_endpoint'),
    }

    try:
        res = post_prompt(prompt)
    except Exception as e:
        error_type = type(e).__name__
        stack_trace_short = traceback.format_exc().strip().split('\n')[-2]
        stack_trace = traceback.format_exc().strip()
        print(f"error: {error_type}, {e}")
        print(f"stack trace: {stack_trace_short}")
        await update_run_with_output(prompt_id, {
            "error": {
                "error_type": error_type,
                "stack_trace": stack_trace
            }
        })
        return web.Response(status=500, reason=f"{error_type}: {e}, {stack_trace_short}")

    status = 200
    # if "error" in res:
    #     status = 400
    #     await update_run_with_output(prompt_id, {
    #         "error": {
    #             **res
    #         }
    #     })
    
    if "node_errors" in res and res["node_errors"]:
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

sockets = dict()

def get_comfyui_path_from_file_path(file_path):
    file_path_parts = file_path.split("\\")

    if file_path_parts[0] == "input":
        print("matching input")
        file_path = os.path.join(folder_paths.get_directory_by_type("input"), *file_path_parts[1:])
    elif file_path_parts[0] == "models":
        print("matching models")
        file_path = folder_paths.get_full_path(file_path_parts[1], os.path.join(*file_path_parts[2:]))

    print(file_path)

    return file_path

# Form ComfyUI Manager
def compute_sha256_checksum(filepath):
    filepath = get_comfyui_path_from_file_path(filepath)
    """Compute the SHA256 checksum of a file, in chunks"""
    sha256 = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(4096), b''):
            sha256.update(chunk)
    return sha256.hexdigest()

# This is start uploading the files to Comfy Deploy
@server.PromptServer.instance.routes.post('/comfyui-deploy/upload-file')
async def upload_file(request):
    data = await request.json()

    file_path = data.get("file_path")

    print("Original file path", file_path)

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
            async with aiohttp.ClientSession() as session:
                headers = {'Authorization': f'Bearer {token}'}
                params = {'file_size': file_size, 'type': file_type}
                async with session.get(get_url, params=params, headers=headers) as response:
                    if response.status == 200:
                        content = await response.json()
                        upload_url = content["upload_url"]

                        with open(file_path, 'rb') as f:
                            headers = {
                                "Content-Type": file_type,
                                "x-amz-acl": "public-read",
                                "Content-Length": str(file_size)
                            }
                            async with session.put(upload_url, data=f, headers=headers) as upload_response:
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
        

@server.PromptServer.instance.routes.get('/comfyui-deploy/get-file-hash')
async def get_file_hash(request):
    file_path = request.rel_url.query.get('file_path', '')

    if file_path is None:
        return web.json_response({
            "error": "file_path is required"
        }, status=400)
    
    try:
        base = folder_paths.base_path
        file_path = os.path.join(base, file_path)
        # print("file_path", file_path)
        file_hash = compute_sha256_checksum(
            file_path
        )
        return web.json_response({
            "file_hash": file_hash
        })
    except Exception as e:
        return web.json_response({
            "error": str(e)
        }, status=500)

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

    try:
        # Send initial state to the new client
        await send("status", { 'sid': sid }, sid)

        if cd_enable_log:
            await send_first_time_log(sid)
            
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.ERROR:
                print('ws connection closed with exception %s' % ws.exception())
    finally:
        sockets.pop(sid, None)
    return ws

@server.PromptServer.instance.routes.get('/comfyui-deploy/check-status')
async def comfy_deploy_check_status(request):
    prompt_server = server.PromptServer.instance
    prompt_id = request.rel_url.query.get('prompt_id', None)
    if prompt_id in prompt_metadata and 'status' in prompt_metadata[prompt_id]:
        return web.json_response({
            "status": prompt_metadata[prompt_id]['status'].value
        })
    else:
        return web.json_response({
            "message": "prompt_id not found"
        })

async def send(event, data, sid=None):
    try:
        if sid:
            ws = sockets.get(sid)
            if ws != None and not ws.closed:  # Check if the WebSocket connection is open and not closing
                await ws.send_json({ 'event': event, 'data': data })
        else:
            for ws in sockets.values():
                if not ws.closed:  # Check if the WebSocket connection is open and not closing
                    await ws.send_json({ 'event': event, 'data': data })
    except Exception as e:
        print(f"Exception: {e}")
        traceback.print_exc()

logging.basicConfig(level=logging.INFO)

prompt_server = server.PromptServer.instance

send_json = prompt_server.send_json
async def send_json_override(self, event, data, sid=None):
    # print("INTERNAL:", event, data, sid)
    prompt_id = data.get('prompt_id')

    # now we send everything
    await asyncio.wait([
        asyncio.create_task(send(event, data)),
        asyncio.create_task(self.send_json_original(event, data, sid))
    ])

    if event == 'execution_start':
        update_run(prompt_id, Status.RUNNING)

    # the last executing event is none, then the workflow is finished
    if event == 'executing' and data.get('node') is None:
        mark_prompt_done(prompt_id=prompt_id)
        if not have_pending_upload(prompt_id):
            update_run(prompt_id, Status.SUCCESS)

    if event == 'execution_error':
        # Careful this might not be fully awaited.
        await update_run_with_output(prompt_id, data)
        update_run(prompt_id, Status.FAILED)
        # await update_run_with_output(prompt_id, data)

    if event == 'executed' and 'node' in data and 'output' in data:
        await update_run_with_output(prompt_id, data.get('output'), node_id=data.get('node'))
        # await update_run_with_output(prompt_id, data.get('output'), node_id=data.get('node'))
        # update_run_with_output(prompt_id, data.get('output'))


class Status(Enum):
    NOT_STARTED = "not-started"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    UPLOADING = "uploading"

# Global variable to keep track of the last read line number
last_read_line_number = 0

def update_run(prompt_id, status: Status):
    global last_read_line_number

    if prompt_id not in prompt_metadata:
        return

    if ('status' not in prompt_metadata[prompt_id] or prompt_metadata[prompt_id]['status'] != status):

        # when the status is already failed, we don't want to update it to success
        if ('status' in prompt_metadata[prompt_id] and prompt_metadata[prompt_id]['status'] == Status.FAILED):
            return

        status_endpoint = prompt_metadata[prompt_id]['status_endpoint']
        body = {
            "run_id": prompt_id,
            "status": status.value,
        }
        print(f"Status: {status.value}")

        try:
            requests.post(status_endpoint, json=body)

            if cd_enable_run_log and (status == Status.SUCCESS or status == Status.FAILED):
                try:
                    with open(comfyui_file_path, 'r') as log_file:
                        # log_data = log_file.read()
                        # Move to the last read line
                        all_log_data = log_file.read()  # Read all log data
                        print("All log data before skipping:", all_log_data)  # Log all data before skipping
                        log_file.seek(0)  # Reset file pointer to the beginning
                        
                        for _ in range(last_read_line_number):
                            next(log_file)
                        log_data = log_file.read()
                        # Update the last read line number
                        last_read_line_number += log_data.count('\n')
                        print("last_read_line_number", last_read_line_number)
                        print("log_data", log_data)
                        print("log_data.count(n)", log_data.count('\n'))

                        body = {
                            "run_id": prompt_id,
                            "log_data": [
                                {
                                    "logs": log_data,
                                    # "timestamp": time.time(),
                                }
                            ]
                        }
                        requests.post(status_endpoint, json=body)
                except Exception as log_error:
                    print(f"Error reading log file: {log_error}")
                

        except Exception as e:
            error_type = type(e).__name__
            stack_trace = traceback.format_exc().strip()
            print(f"Error occurred while updating run: {e} {stack_trace}")
        finally:
            prompt_metadata[prompt_id]['status'] = status
            

async def upload_file(prompt_id, filename, subfolder=None, content_type="image/png", type="output"):
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
        print(filename, "Upload failed: output_dir is None")
        return 

    if subfolder != None:
        full_output_dir = os.path.join(output_dir, subfolder)
        if os.path.commonpath((os.path.abspath(full_output_dir), output_dir)) != output_dir:
            return
        output_dir = full_output_dir

    filename = os.path.basename(filename)
    file = os.path.join(output_dir, filename)

    print("uploading file", file)

    file_upload_endpoint = prompt_metadata[prompt_id]['file_upload_endpoint']

    filename = quote(filename)
    prompt_id = quote(prompt_id)
    content_type = quote(content_type)

    target_url = f"{file_upload_endpoint}?file_name={filename}&run_id={prompt_id}&type={content_type}"

    result = requests.get(target_url)
    ok = result.json()
    
    with open(file, 'rb') as f:
        data = f.read()
        headers = {
            "x-amz-acl": "public-read",
            "Content-Type": content_type,
            "Content-Length": str(len(data)),
        }
        response = requests.put(ok.get("url"), headers=headers, data=data)
        print("upload file response", response.status_code)

def have_pending_upload(prompt_id):
    if 'prompt_id' in prompt_metadata and 'uploading_nodes' in prompt_metadata[prompt_id] and len(prompt_metadata[prompt_id]['uploading_nodes']) > 0:
        print("have pending upload ", len(prompt_metadata[prompt_id]['uploading_nodes']))
        return True

    print("no pending upload")
    return False

def mark_prompt_done(prompt_id):
    if prompt_id in prompt_metadata:
        prompt_metadata[prompt_id]["done"] = True
        print("Prompt done")

def is_prompt_done(prompt_id):
    if prompt_id in prompt_metadata and "done" in prompt_metadata[prompt_id]:
        if prompt_metadata[prompt_id]["done"] == True:
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
    print(body)
    print(f"Error occurred while uploading file: {e}")

# Mark the current prompt requires upload, and block it from being marked as success
async def update_file_status(prompt_id, data, uploading, have_error=False, node_id=None):
    if 'uploading_nodes' not in prompt_metadata[prompt_id]:
        prompt_metadata[prompt_id]['uploading_nodes'] = set()

    if node_id is not None:
        if uploading:
            prompt_metadata[prompt_id]['uploading_nodes'].add(node_id)
        else:
            prompt_metadata[prompt_id]['uploading_nodes'].discard(node_id)

    print(prompt_metadata[prompt_id]['uploading_nodes'])
    # Update the remote status

    if have_error:
        update_run(prompt_id, Status.FAILED)
        await send("failed", {
            "prompt_id": prompt_id,
        })
        return

    # if there are still nodes that are uploading, then we set the status to uploading
    if uploading:
        if prompt_metadata[prompt_id]['status'] != Status.UPLOADING:
            update_run(prompt_id, Status.UPLOADING)
            await send("uploading", {
                "prompt_id": prompt_id,
            })
    
    # if there are no nodes that are uploading, then we set the status to success
    elif not uploading and not have_pending_upload(prompt_id) and is_prompt_done(prompt_id=prompt_id):
        update_run(prompt_id, Status.SUCCESS)
        print("Status: SUCCUSS")
        await send("success", {
            "prompt_id": prompt_id,
        })

async def handle_upload(prompt_id, data, key, content_type_key, default_content_type):
    items = data.get(key, [])
    for item in items:
        await upload_file(
            prompt_id, 
            item.get("filename"), 
            subfolder=item.get("subfolder"), 
            type=item.get("type"), 
            content_type=item.get(content_type_key, default_content_type)
        )


# Upload files in the background
async def upload_in_background(prompt_id, data, node_id=None, have_upload=True):
    try:
        await handle_upload(prompt_id, data, 'images', "content_type", "image/png")
        await handle_upload(prompt_id, data, 'files', "content_type", "image/png")
        # This will also be mp4
        await handle_upload(prompt_id, data, 'gifs', "format", "image/gif")
            
        if have_upload:
            await update_file_status(prompt_id, data, False, node_id=node_id)
    except Exception as e:
        await handle_error(prompt_id, data, e)

async def update_run_with_output(prompt_id, data, node_id=None):
    if prompt_id in prompt_metadata:
        status_endpoint = prompt_metadata[prompt_id]['status_endpoint']

        body = {
            "run_id": prompt_id,
            "output_data": data
        }

        try:
            have_upload = 'images' in data or 'files' in data or 'gifs' in data
            print("\nhave_upload", have_upload, node_id)

            if have_upload:
                await update_file_status(prompt_id, data, True, node_id=node_id)

            asyncio.create_task(upload_in_background(prompt_id, data, node_id=node_id, have_upload=have_upload))

        except Exception as e:
            await handle_error(prompt_id, data, e)
            

        requests.post(status_endpoint, json=body)

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
