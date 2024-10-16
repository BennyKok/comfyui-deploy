#!/bin/bash

echo "comfy deploy container starting.."

echo "Running migrations.."
bun migrate-local

echo "Starting comfy deploy.."
bun dev