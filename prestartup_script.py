import datetime
import os
import subprocess
import sys
import atexit
import threading
import logging
from logging.handlers import RotatingFileHandler

class StreamToLogger(object):
    def __init__(self, original, logger, log_level):
        self.original_stdout = original
        self.logger = logger
        self.log_level = log_level

    def write(self, buf):
        self.original_stdout.write(buf)
        self.original_stdout.flush()
        for line in buf.rstrip().splitlines():
            self.logger.log(self.log_level, line.rstrip())

    def flush(self):
        self.original_stdout.flush()


logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Create a handler that rotates log files every 500KB
handler = RotatingFileHandler('comfy-deploy.log', maxBytes=500000, backupCount=5)
logger.addHandler(handler)

# Store original streams
original_stdout = sys.stdout
original_stderr = sys.stderr

# Redirect stdout and stderr to the logger
sys.stdout = StreamToLogger(original_stdout, logger, logging.INFO)
sys.stderr = StreamToLogger(original_stderr, logger, logging.ERROR)