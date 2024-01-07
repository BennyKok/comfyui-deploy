# Use Nvidia CUDA base image
FROM nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04 as base

# Prevents prompts from packages asking for user input during installation
ENV DEBIAN_FRONTEND=noninteractive
# Prefer binary wheels over source distributions for faster pip installations
ENV PIP_PREFER_BINARY=1
# Ensures output from python is printed immediately to the terminal without buffering
ENV PYTHONUNBUFFERED=1 

# Install Python, git and other necessary tools
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3-pip \
    git \
    wget

RUN ln -s /usr/bin/python3 /usr/bin/python
# # Impact pack deps
# RUN apt-get install -y libgl1-mesa-glx libglib2.0-0

# Clean up to reduce image size
RUN apt-get autoremove -y && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Clone ComfyUI repository
RUN git clone https://github.com/comfyanonymous/ComfyUI.git /comfyui
# Force comfyui on a specific version
RUN cd /comfyui && git reset --hard b12b48e170ccff156dc6ec11242bb6af7d8437fd

# Change working directory to ComfyUI
WORKDIR /comfyui

# RUN python3 -m venv venv
# RUN /bin/bash -c "source venv/bin/activate"

# Install ComfyUI dependencies
RUN pip3 install --no-cache-dir torch==2.1.1 torchvision==0.16.1 torchaudio==2.1.1 --index-url https://download.pytorch.org/whl/cu121
RUN pip3 install --no-cache-dir xformers==0.0.23 --index-url https://download.pytorch.org/whl/cu121
RUN pip3 install -r requirements.txt

WORKDIR /comfyui/custom_nodes

RUN git clone --depth 1 https://github.com/ltdrdata/ComfyUI-Manager.git
RUN cd ComfyUI-Manager && pip3 install -r requirements.txt

# Copy the snapshot json in place
RUN mkdir ComfyUI-Manager/startup-scripts
COPY /data/snapshot.json ComfyUI-Manager/startup-scripts/restore-snapshot.json

WORKDIR /comfyui

COPY /data/extra_model_paths.yaml .
# ADD src/extra_model_paths.yaml ./

# Go back to the root
WORKDIR /

COPY /data/install_deps.py .
COPY /data/deps.json .
COPY /data/models.json .
RUN python3 install_deps.py

WORKDIR /comfyui/custom_nodes

RUN git clone https://github.com/BennyKok/comfyui-deploy.git && cd comfyui-deploy && git reset --hard 744a222e2652014e4d09af6b54fc11263b15e2f7

WORKDIR /

COPY /data/start.sh /start.sh
RUN chmod +x /start.sh

ENTRYPOINT ["/start.sh"]