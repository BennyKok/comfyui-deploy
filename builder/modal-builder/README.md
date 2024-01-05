# Modal Builder

This is a standalone docker fast api app that will takes in require snapshot of the machine and build it as a new modal apps and returns back the deployment url.

Environment variable, get it from you [modal accounts](https://modal.com/bennykok/settings/tokens)

```shellscript
MODAL_TOKEN_ID=
MODAL_TOKEN_SECRET=
```

To run locally

```
docker build -t bennykok/comfydeploy-builder:dev . && docker run --env-file .env -p 8080:8080 bennykok/comfydeploy-builder:dev
```

To deploy

```
fly deploy
```