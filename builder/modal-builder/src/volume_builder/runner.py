import modal
import requests
from app import stub
from config import config

modal.runner.deploy_stub(stub)
print("deployed stub")
# web_url = stub["simple_download"].web_url
f = modal.Function.lookup(config['app_name'], "simple_download")
f.spawn()
# print(f"web_url: {web_url}")
# requests.post(web_url)
