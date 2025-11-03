# Architecture

## System Architecture

> [!NOTE]
> This setup has limits, provisionally, of 300-500 concurrent end users with OCI commercial subscription. 
> **Always Free Tier** is suitable for testing and experimenting, it realistically has limit of 10-20 concurrent end users 

```
Internet (Browser Users)
    ↓
    ↓ HTTPS
    ↓
┌─────────────────────────────────────┐
│  Oracle Cloud Infrastructure        │
│  ┌─────────────────────────────────┐│
│  │ Compute (Linux VM + Networking) ││
│  │   Nginx Web Server              ││
│  │   • odbvue.com (landing page)   ││
│  │   • wiki.odbvue.com (docs)      ││
│  │   • apps.odbvue.com (web app)   ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ Oracle Database + ORDS API      ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
    ↑
    ↑ Deployment
    ↑
    GitHub Actions (CI/CD)
    GitHub Repository
    ↑
    ↑ Local Development Team 
    ↑
```

## Core Components

### Oracle Cloud Infrastructure

**Oracle Cloud Infrastructure (OCI)** is Oracle's cloud platform providing virtualized computing resources hosted in their data centers. Physical servers don't need to be owned - virtual resources are configured and managed instead. OCI provides:
- **Virtual Machines (Compute)** - Linux servers that can be configured and managed
- **Networking** - Internet connectivity, firewalls, and security settings
- **Database Services** - Managed Oracle Autonomous Database with automatic backups
- **Storage** - Secure cloud storage for files and backups

### Compute and Networking

A **Linux virtual machine** is provisioned with:
- Nginx (web server)
- Necessary networking and security settings

### NGINX

**Nginx** is a lightweight web server that runs on the Linux VM. It:
- Handles HTTP/HTTPS connections from browsers
- Routes requests to the appropriate subdomain (landing page, docs, or web app)
- Serves static files efficiently

### Oracle Autonomous AI Database & ORDS

Together, **Oracle Database and ORDS** turn the database into a full-featured, REST-enabled data platform for modern application development, combining powerful data management, procedural logic with PL/SQL, and RESTful integration capabilities.

### GitHub & CI/CD Pipeline

**GitHub Actions** automatically builds and deploys code when changes are pushed:
1. Code is pushed to GitHub
2. GitHub Actions runs tests and builds the application
3. The deployment script pushes new files to the cloud server
4. Nginx serves the updated version

## Scaling up

*With load balancing and infrastructure scaling - limitless*
