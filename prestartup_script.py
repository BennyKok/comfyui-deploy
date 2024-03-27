import datetime
import os
import subprocess
import sys
import atexit
import threading
import logging
from logging.handlers import RotatingFileHandler

# Running with export CD_ENABLE_LOG=true; python main.py

# Check for 'cd-enable-log' flag in input arguments
# cd_enable_log = '--cd-enable-log' in sys.argv
cd_enable_log = os.environ.get('CD_ENABLE_LOG', 'false').lower() == 'true'

def setup():
    handler = RotatingFileHandler('comfy-deploy.log', maxBytes=500000, backupCount=5)

    original_stdout = sys.stdout
    original_stderr = sys.stderr

    class StreamToLogger():
        def __init__(self, log_level):
            self.log_level = log_level

        def write(self, buf):
            if (self.log_level == logging.INFO):
                original_stdout.write(buf)
                original_stdout.flush()
            elif (self.log_level == logging.ERROR):
                original_stderr.write(buf)
                original_stderr.flush()

            for line in buf.rstrip().splitlines():
                handler.handle(
                    logging.LogRecord(
                        name="comfy-deploy",
                        level=self.log_level,
                        pathname="prestartup_script.py",
                        lineno=1,
                        msg=line.rstrip(),
                        args=None,
                        exc_info=None
                    )
                )

        def flush(self):
            if (self.log_level == logging.INFO):
                original_stdout.flush()
            elif (self.log_level == logging.ERROR):
                original_stderr.flush()

    # Redirect stdout and stderr to the logger
    sys.stdout = StreamToLogger(logging.INFO)
    sys.stderr = StreamToLogger(logging.ERROR)

if cd_enable_log:
   print("** Comfy Deploy logging enabled")
   setup() 


# Store the original working directory
original_cwd = os.getcwd()
try:
    # Get the absolute path of the script's directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Change the current working directory to the script's directory
    os.chdir(script_dir)
    current_git_commit = subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode('utf-8').strip()
    print(f"** Comfy Deploy Revision: {current_git_commit}")
except Exception as e:
    print(f"** Comfy Deploy failed to get current git commit: {str(e)}")
finally:
    # Change back to the original directory
    os.chdir(original_cwd)