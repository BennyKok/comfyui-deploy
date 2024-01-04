#!/usr/bin/env bash

# Your custom startup commands here.

echo "Starting modal"
exec "$@" # Runs the command passed to the entrypoint script.