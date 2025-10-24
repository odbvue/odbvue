# Usage

## Build & Run

Start container with web server:

```bash
./build.sh
```

This builds the Nginx container and starts it in the background. Web server runs on `http://localhost:8080`

## Deploy new content

Deploy website content to the running container:

```bash
./deploy.sh [container-name] [source-directory]
```

**Examples:**
```bash
./deploy.sh odbvue-web ./html
./deploy.sh odbvue-web ../../../apps/dist
```

**What Deploy Does**

1. Creates timestamped release directory: `releases/YYYY-MM-DD-HHMMSS/`
2. Copies files
3. Atomically switches `/releases/current` symlink to new release
4. Health checks the deployment
5. Keeps last 3 releases; cleans up old ones

## Stop and Remove

Remove container with web server:

```bash
./remove.sh [container-name]
```
