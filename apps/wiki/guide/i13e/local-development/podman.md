# Podman

## What is Podman?

Podman (Pod Manager) is a container engine that allows you to build, run, and manage containers and pods. It's a drop-in replacement for Docker that doesn't require a daemon and runs rootless by default, making it more secure and lightweight. Podman is part of the OCI (Open Container Initiative) ecosystem and is compatible with Docker images and commands.

**Key Benefits:**
- No daemon required (runs directly)
- Rootless containers by default (better security)
- Pod support (group multiple containers)
- Docker-compatible CLI
- Lightweight resource footprint

## Linux Setup

### Prerequisites
- Linux kernel 5.11 or later
- sudo or root access

### Step-by-Step Installation

**1. Update your package manager**
```bash
sudo apt update && sudo apt upgrade -y
# or for RHEL/CentOS:
# sudo dnf update -y
```

**2. Install Podman**
```bash
sudo apt install -y podman
# or for RHEL/CentOS:
# sudo dnf install -y podman
```

**3. Verify installation**
```bash
podman --version
```

**4. Test Podman**
```bash
podman run hello-world
```

**5. (Optional) Enable rootless mode**
```bash
podman system migrate
```

That's it! You're ready to use Podman on Linux.

## Windows Setup

### Prerequisites
- Windows 10/11 (Pro, Enterprise, or Home Edition)
- Administrator access
- At least 4GB RAM available
- Virtualization enabled in BIOS

### Step 1: Install WSL 2 (Windows Subsystem for Linux)

WSL 2 provides a lightweight Linux environment on Windows where Podman can run efficiently.

**1. Open PowerShell as Administrator**

**2. Install WSL 2 with Ubuntu**
```powershell
wsl --install -d Ubuntu
```

**3. Wait for installation to complete, then restart your computer**

**4. After restart, set up your WSL username and password**
- Open PowerShell or Windows Terminal
- Run: `wsl`
- Create a username and password for your Linux environment

**5. Verify WSL installation**
```powershell
wsl --list --verbose
```

### Step 2: Install Podman in WSL 2

**1. Open WSL terminal**
```powershell
wsl
```

**2. Update Ubuntu packages**
```bash
sudo apt update && sudo apt upgrade -y
```

**3. Install Podman**
```bash
sudo apt install -y podman
```

**4. Verify installation**
```bash
podman --version
```

**5. Test Podman**
```bash
podman run hello-world
```

### Step 3: Access Podman from Windows (Optional)

To use Podman commands directly from Windows PowerShell:

**1. Add WSL to your PATH**
- Open PowerShell as Administrator
- Create an alias:
```powershell
New-Item -Path $PROFILE -Type File -Force
notepad $PROFILE
```

**2. Add these lines to your PowerShell profile:**
```powershell
function podman {
    wsl podman $args
}
```

**3. Save and reload PowerShell**
```powershell
& $PROFILE
```

**4. Now you can use Podman directly from Windows:**
```powershell
podman run hello-world
```

## Quick Reference Commands

```bash
# List containers
podman ps -a

# Run a container
podman run -d --name myapp image:tag

# View logs
podman logs container_name

# Stop container
podman stop container_name

# Remove container
podman rm container_name

# Build image
podman build -t myimage:tag .

# List images
podman images
```

## Troubleshooting

**WSL not found?**
- Ensure you're on Windows 10 v19041 or later
- Enable virtualization in BIOS settings

**Permission denied errors?**
- Use `sudo` or configure rootless mode:
```bash
podman system migrate
```

**Slow performance?**
- Increase WSL memory in `.wslconfig`
- Close unnecessary applications

