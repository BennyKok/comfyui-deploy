import json
import requests
import time
import subprocess
import asyncio
import logging

# Set up the logger
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("restore_snapshot")

# Start the server
# server_process = subprocess.Popen(command, cwd="/comfyui", stdout=subprocess.PIPE)

def check_server(url, retries=50, delay=500):
    for i in range(retries):
        try:
            response = requests.head(url)

            # If the response status code is 200, the server is up and running
            if response.status_code == 200:
                print(f"builder - API is reachable")
                return True
        except requests.RequestException as e:
            # If an exception occurs, the server may not be ready
            pass

        # Wait for the specified delay before retrying
        time.sleep(delay / 1000)

    print(
        f"builder- Failed to connect to server at {url} after {retries} attempts."
    )
    return False

# Define the messages to look for
# success_message = "[ComfyUI-Manager] Restore snapshot done."
success_message = "To see the GUI go to: http://127.0.0.1:8188"
failure_message = "[ComfyUI-Manager] Restore snapshot failed."

async def read_stream(stream, isStderr):
    while True:
        line = await stream.readline()
        if line:
            l = line.decode('utf-8').strip()

            if l == "":
                continue

            if not isStderr:
                logger.info(l)

                # If the output matches one of the messages, print it and break the loop
                if success_message in l:
                    logger.info("Snapshot restore succeeded.")
                    break
                elif failure_message in l:
                    logger.info("Snapshot restore failed.")
                    break
            else:
                # is error
                # logger.error(l)
                logger.error(l)
                break
                
        else:
            break

async def main():
    command = "python main.py --disable-auto-launch --disable-metadata --cpu"

    server_process = await asyncio.subprocess.create_subprocess_shell(command,
                                                                        stdout=asyncio.subprocess.PIPE,
                                                                        stderr=asyncio.subprocess.PIPE,
                                                                        cwd="/comfyui")

    stdout_task = asyncio.create_task(
        read_stream(server_process.stdout, False))
    stderr_task = asyncio.create_task(
        read_stream(server_process.stderr, True))

    await asyncio.wait([stdout_task, stderr_task])

    print("Finished restoring snapshots.")

asyncio.run(main())