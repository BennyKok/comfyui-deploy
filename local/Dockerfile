FROM node:21-bullseye AS comfy_deploy



RUN npm install -g bun

COPY ./web /web


WORKDIR /web

RUN cp .env.local.example .env.local

RUN bun i

ENTRYPOINT [ "bun", "dev" ]