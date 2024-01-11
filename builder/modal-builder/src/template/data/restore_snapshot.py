import json
import requests
import time
import subprocess

print("Starting ComfyUI")

command = ["python", "main.py", "--disable-auto-launch", "--disable-metadata", "--cpu"]
# Start the server
server_process = subprocess.Popen(command, cwd="/comfyui")

def check_server(url, retries=50, delay=500):
    for i in range(retries):
        # Check if the subprocess has ended
        if server_process.poll() is not None:
            print("Subprocess has ended")
            break

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

root_url = "http://127.0.0.1:8188"

check_server(root_url, retries=1800, delay=1000)

# Close the server
server_process.terminate()
print("Finished installing dependencies.")