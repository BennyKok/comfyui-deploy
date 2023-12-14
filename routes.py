from aiohttp import web
from dotenv import load_dotenv
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

import uuid
import asyncio
import atexit
import logging
from enum import Enum

import aiohttp
from aiohttp import web
import boto3

api = None
api_task = None
prompt_metadata = {}

load_dotenv()

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
            prompt_id = str(uuid.uuid4())
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

@server.PromptServer.instance.routes.post("/comfy-deploy/run")
async def comfy_deploy_run(request):
    print("hi")
    prompt_server = server.PromptServer.instance
    data = await request.json()

    workflow_api = data.get("workflow_api")

    for key in workflow_api:
        if 'inputs' in workflow_api[key] and 'seed' in workflow_api[key]['inputs']:
            workflow_api[key]['inputs']['seed'] = randomSeed()

    prompt = {
        "prompt": workflow_api,
        "client_id": "fake_client" #api.client_id
    }

    res = post_prompt(prompt)

    prompt_metadata[res['prompt_id']] = {
        'status_endpoint': data.get('status_endpoint'),
        'file_upload_endpoint': data.get('file_upload_endpoint'),
    }

    status = 200
    if "error" in res:
        status = 400

    return web.json_response(res, status=status)

sockets = dict()

@server.PromptServer.instance.routes.get('/comfy-deploy/ws')
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
            
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.ERROR:
                print('ws connection closed with exception %s' % ws.exception())
    finally:
        sockets.pop(sid, None)
    return ws

async def send(event, data, sid=None):
    if sid:
        ws = sockets.get(sid)
        if ws:
            await ws.send_json({ 'event': event, 'data': data })
    else:
        for ws in sockets.values():
            await ws.send_json({ 'event': event, 'data': data })

logging.basicConfig(level=logging.INFO)

prompt_server = server.PromptServer.instance

send_json = prompt_server.send_json
async def send_json_override(self, event, data, sid=None):
    print("INTERNAL:", event, data, sid)

    prompt_id = data.get('prompt_id')

    # now we send everything
    await send(event, data)
    await self.send_json_original(event, data, sid)

    if event == 'execution_start':
        update_run(prompt_id, Status.RUNNING)

    # the last executing event is none, then the workflow is finished
    if event == 'executing' and data.get('node') is None:
        update_run(prompt_id, Status.SUCCESS)

    if event == 'executed' and 'node' in data and 'output' in data:
        asyncio.create_task(update_run_with_output(prompt_id, data.get('output')))
        # update_run_with_output(prompt_id, data.get('output'))


class Status(Enum):
    NOT_STARTED = "not-started"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"

def update_run(prompt_id, status: Status):
    if prompt_id not in prompt_metadata:
        return

    if ('status' not in prompt_metadata[prompt_id] or prompt_metadata[prompt_id]['status'] != status):
        status_endpoint = prompt_metadata[prompt_id]['status_endpoint']
        body = {
            "run_id": prompt_id,
            "status": status.value,
        }
        prompt_metadata[prompt_id]['status'] = status
        requests.post(status_endpoint, json=body)


async def upload_file(prompt_id, filename, subfolder=None):
    """
    Uploads file to S3 bucket using S3 client object
    :return: None
    """
    filename,output_dir = folder_paths.annotated_filepath(filename)

    # validation for security: prevent accessing arbitrary path
    if filename[0] == '/' or '..' in filename:
        return

    if output_dir is None:
        output_dir = folder_paths.get_directory_by_type("output")

    if output_dir is None:
        return 

    if subfolder != None:
        full_output_dir = os.path.join(output_dir, subfolder)
        if os.path.commonpath((os.path.abspath(full_output_dir), output_dir)) != output_dir:
            return
        output_dir = full_output_dir

    filename = os.path.basename(filename)
    file = os.path.join(output_dir, filename)

    # print("uploading file", file)

    file_upload_endpoint = prompt_metadata[prompt_id]['file_upload_endpoint']

    content_type = "image/png"

    result = requests.get(f"{file_upload_endpoint}?file_name={filename}&run_id={prompt_id}&type={content_type}")
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

async def update_run_with_output(prompt_id, data):
    if prompt_id in prompt_metadata:
        status_endpoint = prompt_metadata[prompt_id]['status_endpoint']

        images = data.get('images', [])
        for image in images:
            await upload_file(prompt_id, image.get("filename"), subfolder=image.get("subfolder"))

        body = {
            "run_id": prompt_id,
            "output_data": data
        }
        requests.post(status_endpoint, json=body)

prompt_server.send_json_original = prompt_server.send_json
prompt_server.send_json = send_json_override.__get__(prompt_server, server.PromptServer)