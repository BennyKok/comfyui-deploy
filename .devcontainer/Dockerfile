ARG VARIANT=18-bullseye
FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:${VARIANT}
# [Optional] Uncomment this section to install additional OS packages.
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#     && apt-get -y install --no-install-recommends <your-package-list-here>

WORKDIR "/"

# Install fly
RUN curl -L https://fly.io/install.sh | sh

ENV FLYCTL_INSTALL="/root/.fly"
ENV PATH="$FLYCTL_INSTALL/bin:$PATH"

RUN sudo apt-get update
RUN sudo apt-get install python3-pip python3 -y

RUN pip3 install modal

# RUN echo 'export FLYCTL_INSTALL="/home/node/.fly"' >> ~/.bashrc
# RUN echo 'export PATH="$FLYCTL_INSTALL/bin:$PATH"' >> ~/.bashrc

RUN npm install -g bun