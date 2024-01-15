# Modal Builder

This is a standalone docker fast api app that will takes in require snapshot of the machine and build it as a new modal apps and returns back the deployment url.

## Environment variable, get it from you [modal accounts](https://modal.com/bennykok/settings/tokens)

```shellscript
MODAL_TOKEN_ID=
MODAL_TOKEN_SECRET=
```

## To run locally

```
docker build -t bennykok/comfydeploy-builder:dev . && docker run --env-file .env -p 8080:8080 bennykok/comfydeploy-builder:dev
```

## Before Deploy to Fly.io
## Fly.io installation

### Mac/Liunx
If you have the Homebrew package manager installed
```
brew install flyctl // mac only
```
If not, you can run the install script
```
curl -L https://fly.io/install.sh | sh
```

### Window
Run the PowerShell install script
```
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

## Set Env Key into Fly.io
```
fly secrets set MODAL_TOKEN_ID=
fly secrets set MODAL_TOKEN_SECRET=
```

## To deploy

```
// model-builder/fly.toml
app = <APP_NAME>
```

if you're first time deploy, run this
```
fly launch
```
if not, run this instead
```
fly deploy
```