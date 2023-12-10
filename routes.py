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
import websockets
import asyncio
import atexit
import logging

api = None
api_task = None

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
    prompt_server = server.PromptServer.instance
    data = await request.json()

    for key in data:
        if 'inputs' in data[key] and 'seed' in data[key]['inputs']:
            data[key]['inputs']['seed'] = randomSeed()

    if api is None:
        connect_to_websocket()
        while api.client_id is None:
            await asyncio.sleep(0.1)

    workflow_api = data.get("workflow_api")
    # print(workflow_api)

    prompt = {
        "prompt": workflow_api,
        "client_id": "fake_client" #api.client_id
    }

    res = post_prompt(prompt)

    # print(prompt)

    status = 200
    if "error" in res:
        status = 400

    return web.json_response(res, status=status)

logging.basicConfig(level=logging.INFO)

class ComfyApi:
    def __init__(self):
        self.websocket = None
        self.client_id = None

    async def connect(self, uri):
        self.websocket = await websockets.connect(uri)

        # Event listeners
        await self.on_open()
        await self.on_message()
        await self.on_close()

    async def close(self):
        await self.websocket.close()

    async def on_open(self):
        print("Connection opened")

    async def on_message(self):
        async for message in self.websocket:
            if isinstance(message, bytes):
                print("Received binary message, skipping...")
                continue  # skip to the next message
            logging.info(f"Received message: {message}")
            
            try:
                message_data = json.loads(message)

                msg_type = message_data["type"]

                if msg_type == "status" and message_data["data"]["sid"] is not None:
                    self.client_id = message_data["data"]["sid"]
                    logging.info(f"Received client_id: {self.client_id}")

            except json.JSONDecodeError:
                logging.info(f"Failed to parse message as JSON: {message}")

    async def on_close(self):
        print("Connection closed")

    async def run(self, uri):
        await self.connect(uri)

def connect_to_websocket():
    global api, api_task
    api = ComfyApi()
    api_task = asyncio.create_task(api.run('ws://localhost:8188/ws'))

prompt_server = server.PromptServer.instance

send_json = prompt_server.send_json
async def send_json_override(self, event, data, sid=None):
    await self.send_json_original(event, data, sid)
    print("Sending event:", sid, event, data)

prompt_server.send_json_original = prompt_server.send_json
prompt_server.send_json = send_json_override.__get__(prompt_server, server.PromptServer)

@atexit.register
def close_websocket():
    print("Got close_websocket")

    global api, api_task
    if api_task:
        api_task.cancel()