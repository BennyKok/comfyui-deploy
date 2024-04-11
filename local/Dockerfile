FROM node:21-bullseye AS comfy_deploy

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

RUN npm install -g bun

COPY ./web /web


WORKDIR /web

RUN cp .env.example .env.local

RUN npm install glob

RUN bun i

ENTRYPOINT [ "bun", "dev" ]