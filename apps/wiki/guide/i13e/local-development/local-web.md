# Web Server for Local Development

Local web server environment using Podman and Nginx. Serves static site content with atomic deployments.

## Prerequisites

- **Podman** installed (Windows: WSL2 + Podman, Linux/Mac: Podman)

## Configuration

### Adjust Port

Edit `compose.yaml`:
```yaml
ports:
  - "8080:80"    # Change first number to desired host port (e.g., "3000:80")
```

### Adjust Container Name

Edit `compose.yaml`:
```yaml
container_name: odbvue-web    # Change to desired name
```

## Usage

### Build & Run

```bash
./build.sh
```

This builds the Nginx container and starts it in the background. Web server runs on `http://localhost:8080`

### Deploy new content

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

### Stop and Remove

```bash
./remove.sh [container-name]
```

## Files

| File | Purpose |
|------|---------|
| `compose.yaml` | Podman Compose configuration |
| `Dockerfile` | Multi-stage Nginx Alpine build |
| `nginx.conf` | Nginx server config (SPA routing, security headers) |
| `build.sh` | Start container |
| `remove.sh` | Stop and remove container |
| `deploy.sh` | Deploy new release |

## Troubleshooting

**Check container status:**
```bash
podman ps
```

**View logs:**
```bash
podman logs [container-name]
```

**Test endpoint:**
```bash
curl http://localhost:8080
```
