# ⚡ Rubber Panel — Modern Game Server Orchestrator

[![Release](https://img.shields.io/github/v/release/Flaxa-Technologies/rubber-panel?include_prereleases&color=a3e635&label=version)](https://github.com/Flaxa-Technologies/rubber-panel/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20%20LTS-brightgreen.svg)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/Docker-CE-blue.svg)](https://docker.com)

**Rubber Panel** is a multi-tenant game server management panel and distributed compute node fleet orchestrator designed for modern cloud hosting. Built with Next.js 16 (Turbopack), TypeScript, Docker, PM2, and an automated zero-downtime auto-updater.

---

## 🚀 Quick Installation (1-Command Installers)

### 1. Panel Installation (Admin Portal + User Client Portal)
Run this single command on your Ubuntu/Debian/RHEL/CentOS VPS to set up both the Admin Management Plane (`:3000`) and the User Client Portal (`:3002`):

```bash
curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/install-panel.sh | sudo bash
```

**What this automatically handles:**
- Installs Node.js 20 LTS, npm, PM2, Git, and build tools
- Generates cryptographically secure secrets (`NEXTAUTH_SECRET`, `INTERNAL_API_SECRET`)
- Initializes the SQLite/Prisma database and seeds default admin credentials
- Builds both frontend applications with Turbopack optimization
- Configures PM2 daemon management with automatic restart on server reboot

---

### 2. Node Daemon Installation (Compute Nodes / Dedicated Servers)
Run this single command on each compute VPS/server to install Docker CE and the daemon agent (`:3001`):

```bash
curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/install-node.sh | sudo bash
```

**What this automatically handles:**
- Installs and enables Docker CE & Docker Compose daemon
- Installs Node.js 20 & PM2
- Prompts for your Admin Panel URL and Node Auth Token
- Starts the heartbeat and container management agent on port `3001`

---

## 🔄 Automated Update System

Rubber Panel features a **Built-in Fleet Update Manager**:
- Whenever a new release or Beta is tagged on GitHub, the Admin Panel automatically displays an **Update Available** banner and sidebar notification.
- From the **Admin Dashboard → Update Manager**, you can review the changelog and click **Update** to trigger zero-downtime background updates for:
  - **Admin Panel** (with automatic database schema migrations & restart)
  - **User Panel** (with automatic rebuild & PM2 reload)
  - **Node Daemons** (remotely triggers updates across all connected compute nodes)
- All `.env` secrets, database tables, and game server directories are 100% preserved.

---

## 📦 Ports & Architecture Overview

| Service | Default Port | Description |
| :--- | :--- | :--- |
| **Admin Portal** | `3000` | Fleet orchestrator, user management, server scaling & settings |
| **User Portal** | `3002` | Client dashboard, live console, SFTP & file manager, backups |
| **Node Daemon** | `3001` | Docker agent managing game container processes & file I/O |

---

## 🛠️ Tech Stack
- **Framework:** Next.js 16 (App Router + Turbopack)
- **Language:** TypeScript 5.x
- **Database & ORM:** SQLite / Prisma ORM
- **Authentication:** NextAuth.js (Role-Based Access Control)
- **Containerization:** Docker Engine API
- **Process Management:** PM2 / Systemd
- **Design System:** Custom Lime `#a3e635` Dark Theme

---

## 📄 License
Released under the [MIT License](LICENSE).
