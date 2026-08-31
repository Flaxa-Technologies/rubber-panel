# ⚡ About Rubber Panel

> **Rubber Panel** is a modern, high-performance game server orchestrator and multi-tenant cloud hosting management platform. Engineered with Next.js 16, TypeScript, Docker Engine, and distributed node daemon clustering, Rubber Panel delivers a seamless experience for hosting providers, server administrators, and gaming communities.

---

## 🌟 Key Highlights & Vision

Rubber Panel was built from the ground up to solve the complexity, latency, and fragmentation of legacy game hosting panels. It provides:
- **Zero-Latency Distributed Architecture**: Decoupled Admin management plane, client user dashboard, and lightweight compute node daemons.
- **Enterprise-Grade Isolation**: Every game server runs inside isolated, resource-constrained Docker containers with dedicated networking, CPU throttling, and memory caps.
- **Modern Developer & User Experience**: Powered by Next.js 16 (App Router + Turbopack), TailwindCSS, custom Lime (`#a3e635`) theme aesthetics, and low-latency WebSocket communication.
- **1-Click Fleet Upgrades**: Built-in fleet auto-updater that updates the Admin panel, User portal, and all remote compute node daemons with zero downtime.

---

## 🏗️ Architectural Topology

Rubber Panel operates across three interconnected micro-services:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          RUBBER PANEL ECOSYSTEM                         │
└────────────────────────────────────────────────────────────────────────┘
                                    │
       ┌────────────────────────────┴────────────────────────────┐
       ▼                                                         ▼
┌──────────────────────────────┐                         ┌──────────────────────────────┐
│     ADMIN CONTROL PLANE      │                         │      USER CLIENT PORTAL      │
│         (Port 3000)          │                         │         (Port 3002)          │
│ • Fleet & Node Management    │                         │ • Real-time Terminal Console │
│ • Server Provisioning        │                         │ • Advanced Code File Editor  │
│ • Quota & Resource Billing   │                         │ • Minecraft RGB Generator    │
│ • Security & Threat Shield   │                         │ • Backups & Cloud Sync       │
│ • Zero-Downtime Fleet Update │                         │ • Subusers & Permissions     │
└──────────────────────────────┘                         └──────────────────────────────┘
               │                                                         │
               └────────────────────────────┬────────────────────────────┘
                                            ▼
                             ┌──────────────────────────────┐
                             │    DISTRIBUTED NODE DAEMON   │
                             │         (Port 3001)          │
                             │ • Docker Container Engine    │
                             │ • WebSocket Log Streamer     │
                             │ • Native Pumpkin MC Engine   │
                             │ • File System Security Wall  │
                             └──────────────────────────────┘
```

---

## 🚀 Complete Feature Breakdown

### 1. 🎮 Game Server & Software Engine
- **Minecraft Ecosystem**:
  - Full support for **Paper**, **Purpur**, **Spigot**, **Vanilla**, **Fabric**, **Forge**, **Mohist**, **BungeeCord**, **Velocity**, and **Folia**.
  - Interactive Java version selector (Java 8, 11, 17, 21, 22).
- **🎃 Native Pumpkin Engine (Rust Minecraft Server)**:
  - Native multithreaded Rust Minecraft server supporting dual **Java Edition** + **Bedrock Edition NetherNet** protocols simultaneously.
  - Automatic commit-SHA binary download and node caching (`.data/software/pumpkin/`).
  - Automatic `config/configuration.toml` generation and real-time port synchronization.
- **Custom Docker Runtimes**:
  - Support for custom Docker images, Python applications, Node.js applications, Go/Rust binaries, and generic Linux containers.
- **Database Container Provisioning**:
  - 1-click creation of dedicated Redis, PostgreSQL, MySQL/MariaDB, and MongoDB instances with auto-generated secure credentials.

---

### 2. 📝 Advanced File Manager & Built-In Code Editor
- **Modern File Browser**:
  - Instant directory navigation, drag-and-drop file uploads, folder creation, multi-file deletion, and `.zip` / `.tar.gz` archive extraction.
  - **Dynamic Config Auto-Sanitizer**: Automatically strips root `server.properties` and `config.toml` from uploaded archives so panel-assigned ports and IP allocations remain uncorrupted.
- **Pro Code Editor**:
  - **Synchronized Line Numbers Gutter**: Live line numbers with active cursor row highlight and line count.
  - **Find & Replace (`Ctrl+F` / `Ctrl+H`)**: Match counter (`1 of X matches`), Next/Previous navigation, Case-sensitive (`Aa`), and Whole-word (`\b`) filters with single Replace and Replace All actions.
  - **Power Shortcuts**: `Ctrl+S` (instant save), `Tab` (2-space code indent), `Escape` (dismiss find/modals).
  - **Customization Controls**: Word Wrap toggle, Font Size Zoom (`11px` – `18px`), Fullscreen mode, and Unsaved changes indicator (`● Unsaved`).
  - **Real-Time Status Bar**: Cursor row & column tracking (`Ln X, Col Y`), character/word count, language mode detection (`YAML`, `TOML`, `JSON`, `Properties`, `Shell`, etc.), encoding (`UTF-8`), and Line Feed (`LF`).

---

### 3. ✨ Built-In Minecraft RGB Gradient Generator
- **Direct Editor Integration**: Accessible via the toolbar button **"RGB Gradient"** with 1-click "Insert Into Editor" or "Copy Output".
- **7 Output Formats**:
  1. **Nickname**: `&#rrggbb` (Essentials / CMI)
  2. **Chat**: `<#rrggbb>`
  3. **Legacy**: `&x&r&r&g&g&b&b`
  4. **Console**: `§x§r§r§g§g§b§b`
  5. **BBCode**: `[COLOR=#rrggbb]text[/COLOR]`
  6. **MiniMessage**: `<gradient:#color1:#color2>Text</gradient>`
  7. **Custom**: User-defined pattern builder with `$c` (hex), `$f` (formatting), and `$m` (character).
- **Multi-Stop Linear Interpolator**: Supports 2 to 6 color stops with interactive HTML5 color pickers and hex inputs.
- **12 Curated Presets**: `MinecraftMenu`, `Rainbow`, `Skyline`, `Mango`, `Vice City`, `Dawn`, `Rose`, `Firewatch`, `Cyberpunk`, `Neon Green`, `Sunset Gold`, and `Ocean Wave`.
- **Text Style Modifiers**: Bold (`&l`), Italic (`&o`), Underline (`&n`), and Strikethrough (`&m`).
- **Live Visual Gradient Preview**: Renders text with smooth CSS multi-stop linear gradients and Minecraft font styling.

---

### 4. 🛡️ Security Shield & Threat Quarantine
- **Threat Detection Engine**: Scans container execution for harmful child process spawns, crypto-mining routines, and unauthorized remote download scripts.
- **Auto-Quarantine Isolation**: Automatically suspends infected instances temporarily with detailed admin notifications and quarantine logs.
- **Path Restriction Firewall**: Enforces `allowedPaths`, `protectedPaths`, and `blockedUploadPaths` to prevent clients from deleting core server jars or escaping root boundaries.
- **Admin Elevated Access Toggle**: Allows administrators to temporarily bypass restrictions for debugging with 1 click.

---

### 5. 🌙 Cryo-Sleep (Idle Power Saver)
- **Automatic Resource Preservation**: Puts inactive servers with 0 players into an ultra-low footprint sleeping state after a configurable idle duration.
- **Smart Knock-to-Wake Proxy**: Automatically wakes and boots the container within seconds when a player attempts to connect or ping the server.
- **Custom Sleeping MOTD**: Customizable status badge and MOTD displayed to players in the Minecraft server list while sleeping.

---

### 6. 💾 Backups & Google Drive Cloud Sync
- **Local & Cloud Storage**:
  - Creates compressed `.zip` / `.tar.gz` snapshots of server data.
  - **Direct Google Drive Integration**: Back up world data directly to Google Drive via OAuth without intermediate storage overhead.
- **1-Click Rollback**: Restore any backup snapshot with optional clean wipe to remove corrupt world chunks.
- **Scheduled Automations**: Configure recurring automated backups using cron expressions.

---

### 7. 👥 Subusers & Granular RBAC Permissions
- **Team Collaboration**: Invite co-owners, developers, and moderators with custom invitation links.
- **Granular Permission Flags**:
  - Terminal & Console Log viewing
  - Power Control (Start, Stop, Restart, Force Kill)
  - File Manager (Read, Write, Upload, Delete)
  - Backup Management (Create, Restore, Delete)
  - Database Management (View credentials, Create, Drop)
  - Schedules & Startup Parameters
  - Server Settings & Network Allocation viewing

---

### 8. 📊 Resource Quotas & Server Expiry Management
- **Per-User Quotas**: Control maximum RAM (MB), CPU (%), Disk (MB), Server Slots, Port Allocations, Backup Slots, and Database Slots.
- **Lifecycle Management**:
  - Configurable server expiration dates (`expiresAt`).
  - Grace periods with automated suspension and grace-expiry deletion policies.
- **Live Scaling**: Scale RAM, CPU limit, and storage on active instances on-the-fly without destroying server files.

---

### 9. 🔄 Zero-Downtime Fleet Auto-Updater
- **Centralized Update Manager**: Admin Dashboard monitors GitHub Releases and displays update notifications.
- **1-Click Update Orchestration**:
  - Updates Admin Panel (`admin-side`) with automatic database schema migrations.
  - Updates User Client Portal (`user-side`) with Turbopack optimization.
  - Remotely updates Node Daemons (`node-side`) across your entire compute fleet.
- **Preserved State**: All `.env` secrets, database tables, user accounts, and game data remain 100% untouched.

### 10. 🌐 Dynamic Minecraft Custom Subdomain Management (Individual SRV Engine)
- **Zero-Wildcard Pure SRV Architecture**:
  - Leverages individual DNS SRV records (`_minecraft._tcp.<subdomain>.<rootdomain>`) routed directly to the server's specific allocated port and compute node target A record.
  - Players connect using clean addresses (e.g. `play.example.com`, `survival.example.com`) without appending awkward port numbers.
- **Cloudflare DNS v4 Integration**:
  - Secure token-based API authentication with automatic Cloudflare Zone discovery and health checking.
  - Automatic node target A record provisioning (`node-<nodeSlug>.<domain>` with `proxied: false`).
- **Quota & Permission Governance**:
  - Global default limits (`Default Domains Allowed Per Server`, default 1; 0 disables self-service) with per-server and per-user admin overrides.
  - Strict global duplicate prevention, reserved prefix blacklisting (`admin`, `api`, `panel`, `node`, `mail`, etc.), and format sanitization.
- **Transactional Lifecycle & DNS Cascade**:
  - Deleting or releasing a subdomain immediately deletes the SRV record from Cloudflare.
  - Deleting a server automatically purges all attached custom SRV records across all connected root domains.

### 11. 📡 Traffic Radar & Application-Layer Abuse Mitigation Engine
- **In-Process Network Telemetry & Anomaly Detection**:
  - Continuous lightweight connection tracking via `ss -H -o state established` and `/proc/net/dev`.
  - In-memory sliding-window connection frequency counter (`connWindows = new Map<string, IpWindow>()`) identifying rate spikes, reconnect floods, and slowloris connection holds.
- **Local Linux Firewall Orchestration (`iptables`)**:
  - Dedicated `RUBBER_RADAR` chain auto-bootstrapped on daemon start.
  - Dynamic `DROP` rule injection with automatic TTL unban scheduling (default 15 minutes).
- **Geo-Intelligence & Offline Country Lookup**:
  - MaxMind GeoLite2 offline dataset via `geoip-lite` for zero-latency, zero-cost country identification and top-offender attribution.
- **Fleet Defense & Emergency Controls**:
  - **Fleet-Wide Shield Mode**: 1-click administrative trigger that temporarily doubles rate-limiting sensitivity fleet-wide during an active incident.
  - **Scoped "Under Attack Mode"**: Self-service toggle in the User Panel applying aggressive connection throttling to an individual server's port for 1 hour with auto-revert.
  - **Trusted IPs Whitelist**: Permanent exclusion for administrative subnets, trusted reverse proxies, and RFC1918 private IP ranges.

---

## 📋 Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | Next.js 16 (App Router + Turbopack) | High-speed, responsive server-rendered & client UI |
| **Styling & Design** | TailwindCSS + Custom Dark Theme | Sleek dark aesthetic with Lime `#a3e635` accents |
| **Type Safety** | TypeScript 5.x | End-to-end type safety across client, admin, and agent |
| **Container Engine** | Docker Engine API / Docker Compose | Sandboxed process isolation, networking & limits |
| **Database & ORM** | SQLite / Prisma ORM | Fast, zero-config embedded database layer |
| **Process Daemon** | PM2 / Systemd | Background service resilience and auto-restart on reboot |
| **Realtime Logs** | WebSockets / Server-Sent Events | Sub-millisecond console streaming and live stats |

---

## ⚡ 1-Command Installation Scripts

### Install Admin & User Panel
```bash
curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/install-panel.sh | sudo bash
```

### Install Compute Node Daemon
```bash
curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/install-node.sh | sudo bash
```

### Update Existing Installation
```bash
# On Panel VPS:
curl -fsSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/update-panel.sh | bash

# On Compute Node VPS:
curl -fsSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/update-node.sh | bash
```

---

## 📄 License & Credits
- **License**: Released under the [MIT License](LICENSE).
- **Developed by**: [Flaxa Technologies](https://github.com/Flaxa-Technologies).
