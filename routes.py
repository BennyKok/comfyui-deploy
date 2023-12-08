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

load_dotenv()

@server.PromptServer.instance.routes.get("/comfy-deploy/run")
async def get_web_styles(request):
    filename = os.path.join(os.path.dirname(__file__), "js/tw-styles.css")
    return web.FileResponse(filename)