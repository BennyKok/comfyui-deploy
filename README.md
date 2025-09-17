# ComfyUI Deploy

Open source comfyui deployment platform, a `vercel` for generative workflow infra. (serverless hosted gpu with vertical intergation with comfyui)

Check out our latest lcoal demo -> https://github.com/comfy-deploy/comfyui-api-comfydeploy

Full backend and frontend is here -> https://github.com/comfy-deploy/comfydeploy

> [!NOTE]  
> Im looking for creative hacker to join ComfyDeploy's core team! DM me on [twitter](https://x.com/BennyKokMusic)

Join [Discord](https://discord.gg/EEYcQmdYZw) to chat more or visit [Comfy Deploy](https://comfydeploy.com/) to get started!

Check out our latest [nextjs starter kit](https://github.com/BennyKok/comfyui-deploy-next-example) with Comfy Deploy

![63shots_so 1](https://github.com/BennyKok/comfyui-deploy/assets/18395202/c0b88377-0135-4d9a-8a20-8b38b975bb48)\# How it works

1. Comfy Deploy Dashboard (https://comfydeploy.com) or self-hosted version
2. Machines (Long running, on-premise ComfyUI machines and serverless)
3. Supports runpods, modal, and hosted ComfyDeploy machines (powered by modal)

https://github.com/BennyKok/comfyui-deploy/assets/18395202/85f85325-a4bb-446d-aa67-ed225ee03479

# Setting up a basic sd txt2img API

https://github.com/BennyKok/comfyui-deploy/assets/18395202/0fb1829b-401a-41f2-b21a-5b77483c6ee2

# Comfy Deploy Plugin Installation

> Plugin lets you set up the machine as a target machine, and also upload workflow directly from there

1. `cd custom_nodes`
2. `git clone https://github.com/BennyKok/comfyui-deploy.git`
3. Go to (https://comfydeploy.com) or a self-hosted version
   - Machines -&gt; Add Machines
     - Enter a name and the URL of your machines (set up Ngrok for a public URL for your machines)
     - Create a new ComfyDeploy machines (pick any custom nodes).

# Usecase

1. Deploy a complicated comfy workflow with a versioning system
2. Manage versioning and easily preview different generated versions' output
3. Persistent API generated for Production and Staging environment
4. Run the same comfyui workflow across different remote machines

![467shots_so 1](https://github.com/BennyKok/comfyui-deploy/assets/18395202/e49a0360-de94-4e3b-802b-0eadabe3c166)\# Status & Timeline

WIP, welcomes contributors!! Please join Discord -&gt; https://discord.gg/EEYcQmdYZw

Primary goal -&gt; release v0.1.0 of stable Comfy Deploy

Major areas

- Security enforcement
- Error handling
- QOL workflow improvement
- API usage examples
- Load balancing
- Workflow dependencies checking (custom nodes)
- Remote machines
- Serverless machines? Possible to set up a clean environment via Salad, Modal, etc
- LCM realtime web socket image gen

# Tech Stack

- Shadcn UI

- NextJS

- Clerk (Auth)

- Neon / Vercel Postgres (Database)

- Drizzle (ORM)

- R2 / S3 (Object Storage)

# Development

1. `git clone https://github.com/BennyKok/comfyui-deploy`
2. `cd web`
3. `bun i`
4. Start docker
5. `cp .env.example .env.local`
6. Replace `JWT_SECRET` with `openssl rand -hex 32`
7. Get a local clerk dev key for `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
8. Keep a terminal live for `bun run db-dev`
9. Execute the local migration to create the initial data `bun run migrate-local`
10. Finally start the next server with `bun dev`

**Schema Changes**

1. `bun run generate`
2. `bun run migrate-local`

# Special Thanks

- comfyui
- oss/acc

# Self Hosting with Vercel

Build command

```
next build && bun run migrate-production
```

Install command

```
npx bun@1.0.16 install
```

Env key setup

```
POSTGRES_URL=

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

SPACES_ENDPOINT="http://localhost:4566"
SPACES_ENDPOINT_CDN="http://localhost:4566"
SPACES_BUCKET="comfyui-deploy"
SPACES_KEY="xyz"
SPACES_SECRET="aaa"

# generate using -> openssl rand -hex 32
JWT_SECRET=

# r2 settings
SPACES_REGION="auto"
SPACES_CDN_FORCE_PATH_STYLE="true"
SPACES_CDN_DONT_INCLUDE_BUCKET="true"

# digital ocean settings
SPACES_REGION="nyc3"
SPACES_CDN_FORCE_PATH_STYLE="false"

# s3 settings
SPACES_REGION="nyc3"
SPACES_CDN_DONT_INCLUDE_BUCKET="false"
SPACES_CDN_FORCE_PATH_STYLE="true"
```
