import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";
import { exec, spawn } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

export type ServerStatus = "RUNNING" | "STOPPED" | "STARTING" | "STOPPING" | "INSTALLING" | "CRASHED" | "OFFLINE" | "SLEEPING" | "WAKING";

export interface ServerInfo {
  id: string;
  name: string;
  status: ServerStatus;
  pid?: number;
  dockerId?: string;
  port?: number;
  internalPort?: number;
  ram: number;
  cpu: number;
  disk?: number;
  cpuUsage?: number;
  ramUsageMb?: number;
  ramPercent?: number;
  diskUsedBytes?: number;
  diskUsedMb?: number;
  netRx?: string;
  netTx?: string;
  uptime?: number;
  environment?: Record<string, string>;
  startupCommand?: string;
  javaVersion?: string;
  cryoSleepEnabled?: boolean;
  cryoSleepIdleMinutes?: number;
  cryoSleepMotd?: string;
  isCryoSleeping?: boolean;
}

export interface CreateServerParams {
  id: string;
  name: string;
  ram: number;
  cpu: number;
  disk: number;
  port?: number;
  internalPort?: number;
  softwareVersion?: string;
  startupCommand?: string;
  environment?: Record<string, string>;
}

// In-memory state — populated from disk on startup
const serverStates: Map<string, ServerInfo> =
  (globalThis as any).__rp_server_states || ((globalThis as any).__rp_server_states = new Map());

// ─── CONSOLE LOG RING BUFFER ───────────────────────────────────────────────
const MAX_LOG_LINES = 1000;
const consoleLogs: Map<string, string[]> =
  (globalThis as any).__rp_console_logs || ((globalThis as any).__rp_console_logs = new Map());

export function appendLog(serverId: string, line: string) {
  const logs = consoleLogs.get(serverId) ?? [];
  logs.push(line);
  if (logs.length > MAX_LOG_LINES) logs.shift();
  consoleLogs.set(serverId, logs);
}

export function getConsoleLogs(serverId: string): string[] {
  return consoleLogs.get(serverId) ?? [];
}

// ─── FILE SYSTEM HELPERS ───────────────────────────────────────────────────

export function getServerDir(serverId: string): string {
  return path.join(process.cwd(), ".data", "servers", serverId);
}

function resolveSecurePath(serverId: string, reqPath: string): string {
  const baseDir = getServerDir(serverId);
  const normalizedPath = path.normalize(path.join(/*turbopackIgnore: true*/ baseDir, reqPath || "/"));
  if (!normalizedPath.startsWith(baseDir)) {
    throw new Error("Directory traversal detected");
  }
  return normalizedPath;
}

function isSystemProtectedPath(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase();
  return (
    base.startsWith(".rp-") ||
    base === ".rp-state.json" ||
    base === ".rp-lock" ||
    base.startsWith(".cryo") ||
    base === ".git" ||
    base === "dev.db" ||
    base === ".env"
  );
}

export function getServerStateFile(serverId: string): string {
  const dir = path.join(process.cwd(), ".data", "server-states");
  return path.join(dir, `${serverId}.json`);
}

/** Automatically copy downloaded jar (e.g. paper-1.21.6-48.jar) to server.jar */
async function syncServerJar(serverId: string) {
  try {
    const dir = getServerDir(serverId);
    const entries = await fs.readdir(dir);
    const targetJar = entries.find(f => 
      (
        f.startsWith("paper-") ||
        f.startsWith("purpur-") ||
        f.startsWith("spigot-") ||
        f.startsWith("vanilla-") ||
        f.startsWith("fabric-") ||
        f.startsWith("forge-") ||
        f.startsWith("neoforge-") ||
        f.startsWith("quilt-") ||
        f.startsWith("mohist-") ||
        f.startsWith("arclight-") ||
        f.startsWith("magma-") ||
        f.startsWith("velocity-") ||
        f.startsWith("waterfall-") ||
        f.startsWith("folia-")
      ) && 
      f.endsWith(".jar") && 
      f !== "server.jar"
    );
    if (targetJar) {
      const src = path.join(dir, targetJar);
      const dst = path.join(dir, "server.jar");
      try {
        await fs.copyFile(src, dst);
        console.log(`[ServerManager] Synced ${targetJar} -> server.jar for ${serverId}`);
      } catch {}
    }
  } catch {}
}

/** Automatically download software jar if server.jar is missing */
async function downloadMinecraftJarIfMissing(serverId: string, type = "PAPER", version = "1.21.1") {
  const dir = getServerDir(serverId);
  await fs.mkdir(dir, { recursive: true });
  await syncServerJar(serverId);
  const jarPath = path.join(dir, "server.jar");
  if (fsSync.existsSync(jarPath)) return true;

  const t = (type || "PAPER").toUpperCase();
  const v = (!version || version === "LATEST") ? "1.21.1" : version;

  appendLog(serverId, `[Rubber] server.jar not found. Auto-downloading ${t} ${v}...`);

  try {
    if (t === "PAPER" || t === "VELOCITY" || t === "FOLIA" || t === "WATERFALL") {
      const project = t.toLowerCase();
      const buildsRes = await fetch(`https://api.papermc.io/v2/projects/${project}/versions/${v}/builds`);
      if (buildsRes.ok) {
        const buildsData = await buildsRes.json() as any;
        const builds = buildsData.builds;
        if (builds && builds.length > 0) {
          const latestBuild = builds[builds.length - 1];
          const downloadName = latestBuild.downloads?.application?.name || `${project}-${v}-${latestBuild.build}.jar`;
          const downloadUrl = `https://api.papermc.io/v2/projects/${project}/versions/${v}/builds/${latestBuild.build}/downloads/${downloadName}`;
          
          appendLog(serverId, `[Rubber] Downloading from PaperMC API: ${downloadName}...`);
          const res = await fetch(downloadUrl);
          if (res.ok && res.body) {
            const buf = Buffer.from(await res.arrayBuffer());
            await fs.writeFile(jarPath, buf);
            appendLog(serverId, `[Rubber] ✓ Downloaded ${downloadName} (${(buf.length / 1024 / 1024).toFixed(1)} MB)!`);
            return true;
          }
        }
      }
    } else if (t === "PURPUR") {
      const purpurUrl = `https://api.purpurmc.org/v2/purpur/${v}/latest/download`;
      appendLog(serverId, `[Rubber] Downloading from Purpur API: purpur-${v}.jar...`);
      const res = await fetch(purpurUrl);
      if (res.ok && res.body) {
        const buf = Buffer.from(await res.arrayBuffer());
        await fs.writeFile(jarPath, buf);
        appendLog(serverId, `[Rubber] ✓ Downloaded purpur-${v}.jar (${(buf.length / 1024 / 1024).toFixed(1)} MB)!`);
        return true;
      }
    }
  } catch (err: any) {
    appendLog(serverId, `[Rubber] Auto-download note: ${err.message}. You can upload server.jar manually via Files.`);
  }
  return false;
}

export async function listFiles(serverId: string, dirPath: string) {
  // Sync server.jar if a version jar was downloaded
  await syncServerJar(serverId);

  const target = resolveSecurePath(serverId, dirPath);
  try {
    const entries = await fs.readdir(target, { withFileTypes: true });
    const result = [];
    for (const entry of entries) {
      if (isSystemProtectedPath(entry.name)) continue;
      const stats = await fs.stat(path.join(target, entry.name));
      result.push({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
      });
    }
    return result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (err: any) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

export async function readFileContent(serverId: string, filePath: string) {
  if (isSystemProtectedPath(filePath)) throw new Error("Access to protected system file is forbidden");
  const target = resolveSecurePath(serverId, filePath);
  return fs.readFile(target, "utf-8");
}

export async function writeFileContent(serverId: string, filePath: string, content: string) {
  if (isSystemProtectedPath(filePath)) throw new Error("Editing protected system file is forbidden");
  const target = resolveSecurePath(serverId, filePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf-8");
}

export async function uploadFile(serverId: string, filePath: string, base64Content: string) {
  if (isSystemProtectedPath(filePath)) throw new Error("Uploading protected system file is forbidden");
  const target = resolveSecurePath(serverId, filePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const buffer = Buffer.from(base64Content, "base64");
  await fs.writeFile(target, buffer);
}

export async function unzipFile(serverId: string, filePath: string, destDir?: string) {
  if (isSystemProtectedPath(filePath)) throw new Error("Extracting protected system archive is forbidden");
  const zipPath = resolveSecurePath(serverId, filePath);
  const targetDir = destDir ? resolveSecurePath(serverId, destDir) : path.dirname(zipPath);
  await fs.mkdir(targetDir, { recursive: true });

  const isWindows = process.platform === "win32";
  if (isWindows) {
    const psCmd = `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force"`;
    await execAsync(psCmd);
  } else {
    await execAsync(`unzip -o "${zipPath}" -d "${targetDir}" || tar -xf "${zipPath}" -C "${targetDir}"`);
  }
}

export async function deleteFileOrDir(serverId: string, filePath: string) {
  if (isSystemProtectedPath(filePath)) throw new Error("Deleting protected system file is forbidden");
  const target = resolveSecurePath(serverId, filePath);
  const stats = await fs.stat(target);
  if (stats.isDirectory()) {
    await fs.rm(target, { recursive: true, force: true });
  } else {
    await fs.unlink(target);
  }
}

// ─── DOCKER HELPERS ────────────────────────────────────────────────────────

function getContainerName(serverId: string) {
  return `rp-server-${serverId}`;
}

function buildEnvArgs(env: Record<string, string>): string[] {
  const args: string[] = [];
  for (const [k, v] of Object.entries(env)) {
    args.push("-e", `${k}=${v}`);
  }
  return args;
}

async function containerExists(name: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`docker ps -a --format "{{.Names}}" --filter "name=^${name}$"`);
    return stdout.trim() === name;
  } catch {
    return false;
  }
}

async function containerRunning(name: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`docker inspect --format "{{.State.Running}}" ${name}`);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

const activeLogStreams: Map<string, any> =
  (globalThis as any).__rp_active_log_streams || ((globalThis as any).__rp_active_log_streams = new Map());

function attachLogs(serverId: string) {
  const containerName = getContainerName(serverId);

  // Kill previous log stream process for this server if still running
  const oldChild = activeLogStreams.get(serverId);
  if (oldChild) {
    try { oldChild.kill(); } catch {}
    activeLogStreams.delete(serverId);
  }

  const child = spawn("docker", ["logs", "-f", "--tail", "100", containerName], { stdio: ["ignore", "pipe", "pipe"] });
  activeLogStreams.set(serverId, child);

  function onLine(data: Buffer) {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Filter internal RCON connect/disconnect noise & socket flood disconnect warnings
      if (
        trimmed.includes("Thread RCON Client") ||
        trimmed.includes("RCON Listener") ||
        trimmed.includes("handleDisconnection() called twice")
      ) {
        continue;
      }

      appendLog(serverId, line);

      // If paper jar finished downloading, trigger sync
      if (line.includes("Downloading") || line.includes("Done") || line.includes("Starting minecraft server")) {
        syncServerJar(serverId).catch(() => {});
      }
      // Player join / leave tracking for Cryo-Sleep
      if (line.includes("joined the game") || line.includes("logged in with entity id")) {
        import("./cryo-sleep-engine").then(({ updateServerPlayerCount }) => {
          updateServerPlayerCount(serverId, 1);
        }).catch(() => {});
      }
    }
  }

  child.stdout.on("data", onLine);
  child.stderr.on("data", onLine);

  child.on("close", () => {
    if (activeLogStreams.get(serverId) === child) {
      activeLogStreams.delete(serverId);
      appendLog(serverId, "[Console] Log stream ended.");
    }
    syncServerJar(serverId).catch(() => {});
  });

  return child;
}

// ─── PERSIST STATE TO DISK ────────────────────────────────────────────────

async function saveState(serverId: string, info: ServerInfo) {
  const stateFile = getServerStateFile(serverId);
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(info, null, 2), "utf-8");

  // Cleanup legacy .rp-state.json inside user server directory if exists
  try {
    const legacyFile = path.join(getServerDir(serverId), ".rp-state.json");
    await fs.unlink(legacyFile);
  } catch {}
}

export async function getOrLoadServerState(serverId: string): Promise<ServerInfo | undefined> {
  let info = serverStates.get(serverId);
  if (info) return info;

  // 1. Check isolated state file (.data/server-states/${serverId}.json)
  const stateFile = getServerStateFile(serverId);
  try {
    const raw = await fs.readFile(stateFile, "utf-8");
    info = JSON.parse(raw) as ServerInfo;
    serverStates.set(serverId, info);
    return info;
  } catch {}

  // 2. Check legacy state file inside server dir (.data/servers/${serverId}/.rp-state.json) and migrate
  const legacyFile = path.join(getServerDir(serverId), ".rp-state.json");
  try {
    const raw = await fs.readFile(legacyFile, "utf-8");
    info = JSON.parse(raw) as ServerInfo;
    serverStates.set(serverId, info);
    await saveState(serverId, info);
    return info;
  } catch {}

  // 3. Fallback: If server dir exists or Docker container exists, reconstruct state
  const dir = getServerDir(serverId);
  const dirExists = await fs.stat(dir).then(() => true).catch(() => false);
  const containerName = getContainerName(serverId);
  const isRunning = await containerRunning(containerName);

  if (dirExists || isRunning) {
    info = {
      id: serverId,
      name: "Server Instance",
      status: isRunning ? "RUNNING" : "STOPPED",
      ram: 1024,
      cpu: 100,
    };
    serverStates.set(serverId, info);
    await saveState(serverId, info).catch(() => {});
    return info;
  }

  return undefined;
}


export async function reloadStatesFromDisk() {
  const stateDir = path.join(process.cwd(), ".data", "server-states");
  await fs.mkdir(stateDir, { recursive: true });

  // 1. Load from isolated state directory
  try {
    const files = await fs.readdir(stateDir);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(stateDir, f), "utf-8");
        const info: ServerInfo = JSON.parse(raw);
        const running = await containerRunning(getContainerName(info.id));
        const { isWakeProxyRunning } = await import("./cryo-sleep-proxy");
        const isSleeping = isWakeProxyRunning(info.id);
        const env = info.environment || {};
        const isCryoEnabled = env.CRYO_SLEEP_ENABLED === "true" || info.cryoSleepEnabled === true;

        info.status = running ? "RUNNING" : isSleeping ? "SLEEPING" : "STOPPED";
        info.isCryoSleeping = isSleeping;
        serverStates.set(info.id, info);
        if (running) attachLogs(info.id);
        syncServerJar(info.id).catch(() => {});

        // Auto-register server to Cryo-Sleep Engine
        const { registerCryoServer, hibernateServer } = await import("./cryo-sleep-engine");
        registerCryoServer({
          serverId: info.id,
          serverName: info.name,
          port: info.port ?? 25565,
          serverType: env.SERVER_TYPE === "NODEJS" ? "NODEJS" : "MINECRAFT",
          enabled: isCryoEnabled,
          idleMinutes: parseInt(env.CRYO_SLEEP_IDLE_MINUTES || String(info.cryoSleepIdleMinutes || 10)),
          motd: env.CRYO_SLEEP_MOTD || info.cryoSleepMotd,
        });

        if (isCryoEnabled && !running && !isSleeping) {
          hibernateServer(info.id).catch(() => {});
        }
      } catch {}
    }
  } catch {}

  // 2. Migration: scan legacy server directories and migrate any legacy .rp-state.json
  const serversDir = path.join(process.cwd(), ".data", "servers");
  try {
    const dirs = await fs.readdir(serversDir, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const legacyStateFile = path.join(serversDir, d.name, ".rp-state.json");
      try {
        const raw = await fs.readFile(legacyStateFile, "utf-8");
        const info: ServerInfo = JSON.parse(raw);
        // Skip if already loaded from new state dir
        if (serverStates.has(info.id)) {
          await fs.unlink(legacyStateFile).catch(() => {});
          continue;
        }
        // Migrate: save to new location and remove legacy file
        await saveState(info.id, info);
        // Also load the migrated server into memory immediately
        const running = await containerRunning(getContainerName(info.id));
        const { isWakeProxyRunning } = await import("./cryo-sleep-proxy");
        const isSleeping = isWakeProxyRunning(info.id);
        const env = info.environment || {};
        const isCryoEnabled = env.CRYO_SLEEP_ENABLED === "true" || info.cryoSleepEnabled === true;

        info.status = running ? "RUNNING" : isSleeping ? "SLEEPING" : "STOPPED";
        info.isCryoSleeping = isSleeping;
        serverStates.set(info.id, info);
        if (running) attachLogs(info.id);
        syncServerJar(info.id).catch(() => {});

        const { registerCryoServer, hibernateServer } = await import("./cryo-sleep-engine");
        registerCryoServer({
          serverId: info.id,
          serverName: info.name,
          port: info.port ?? 25565,
          serverType: env.SERVER_TYPE === "NODEJS" ? "NODEJS" : "MINECRAFT",
          enabled: isCryoEnabled,
          idleMinutes: parseInt(env.CRYO_SLEEP_IDLE_MINUTES || String(info.cryoSleepIdleMinutes || 10)),
          motd: env.CRYO_SLEEP_MOTD || info.cryoSleepMotd,
        });

        if (isCryoEnabled && !running && !isSleeping) {
          hibernateServer(info.id).catch(() => {});
        }

        console.log(`[ServerManager] Migrated legacy state for server ${info.id} (${info.name})`);
      } catch {}
    }
  } catch {}
  console.log(`[ServerManager] Reloaded ${serverStates.size} server states from disk`);
}

// ─── DOCKER LIFECYCLE ────────────────────────────────────────────────────

/**
 * Universal Container Port Auto-Compliance:
 * Discovers the container's internal port and protocol from:
 * 1. env.INTERNAL_PORT or env.PORT (explicit user/template preference)
 * 2. `docker inspect --format '{{json .Config.ExposedPorts}}' <image>` (reads image metadata from Dockerfile)
 * 3. Extensive Built-in Service Registry (databases, web servers, message brokers, tools, game servers)
 * 4. Fallback to assigned host port or 8080
 */
export async function resolveContainerPortMapping(
  dockerImage: string,
  assignedPort: number,
  userInternalPort?: string | number
): Promise<{ internalPort: number; protocol: "tcp" | "udp" | "both" }> {
  // 1. User-specified explicit internal port
  if (userInternalPort) {
    const p = parseInt(String(userInternalPort), 10);
    if (!isNaN(p) && p > 0) return { internalPort: p, protocol: "both" };
  }

  // 2. Query Docker inspect for the image's EXPOSE directives
  try {
    const { stdout } = await execAsync(`docker inspect --format "{{json .Config.ExposedPorts}}" ${dockerImage}`).catch(() => ({ stdout: "" }));
    if (stdout && stdout.trim() && stdout.trim() !== "null" && stdout.trim() !== "{}") {
      const exposed = JSON.parse(stdout.trim());
      const keys = Object.keys(exposed);
      if (keys.length > 0) {
        // e.g. "3306/tcp", "25565/tcp", "27015/udp"
        const [portStr, protoStr] = keys[0].split("/");
        const portNum = parseInt(portStr, 10);
        if (!isNaN(portNum) && portNum > 0) {
          const proto = (protoStr?.toLowerCase() === "udp") ? "udp" : (protoStr?.toLowerCase() === "tcp") ? "tcp" : "both";
          return { internalPort: portNum, protocol: proto };
        }
      }
    }
  } catch {}

  // 3. Built-in Smart Registry of Known Images & Stacks
  const img = (dockerImage || "").toLowerCase();
  if (img.includes("mysql") || img.includes("mariadb")) return { internalPort: 3306, protocol: "tcp" };
  if (img.includes("postgres")) return { internalPort: 5432, protocol: "tcp" };
  if (img.includes("redis") || img.includes("keydb") || img.includes("dragonfly")) return { internalPort: 6379, protocol: "tcp" };
  if (img.includes("mongo")) return { internalPort: 27017, protocol: "tcp" };
  if (img.includes("rabbitmq")) return { internalPort: 5672, protocol: "tcp" };
  if (img.includes("nginx") || img.includes("httpd") || img.includes("apache") || img.includes("caddy") || img.includes("lighttpd")) return { internalPort: 80, protocol: "tcp" };
  if (img.includes("code-server")) return { internalPort: 8080, protocol: "tcp" };
  if (img.includes("grafana")) return { internalPort: 3000, protocol: "tcp" };
  if (img.includes("elastic") || img.includes("opensearch")) return { internalPort: 9200, protocol: "tcp" };
  if (img.includes("minio")) return { internalPort: 9000, protocol: "tcp" };
  if (img.includes("influxdb")) return { internalPort: 8086, protocol: "tcp" };
  if (img.includes("prometheus")) return { internalPort: 9090, protocol: "tcp" };
  if (img.includes("clickhouse")) return { internalPort: 8123, protocol: "tcp" };
  if (img.includes("pocketbase") || img.includes("strapi")) return { internalPort: 8090, protocol: "tcp" };
  if (img.includes("ghost")) return { internalPort: 2368, protocol: "tcp" };
  if (img.includes("terraria") || img.includes("tshock")) return { internalPort: 7777, protocol: "both" };
  if (img.includes("valheim")) return { internalPort: 2456, protocol: "udp" };
  if (img.includes("palworld")) return { internalPort: 8211, protocol: "udp" };
  if (img.includes("steam") || img.includes("cs2") || img.includes("tf2") || img.includes("source")) return { internalPort: 27015, protocol: "both" };
  if (img.includes("minecraft") || img.includes("itzg")) return { internalPort: 25565, protocol: "tcp" };
  if (img.includes("node") || img.includes("bun") || img.includes("deno")) return { internalPort: 3000, protocol: "tcp" };
  if (img.includes("python") || img.includes("flask") || img.includes("django")) return { internalPort: 8000, protocol: "tcp" };
  if (img.includes("php")) return { internalPort: 8080, protocol: "tcp" };

  // 4. Default: comply with assigned host port or standard 8080
  return { internalPort: assignedPort || 8080, protocol: "both" };
}

function detectRuntime(sType: string, dImage: string, env?: Record<string, any>) {
  const t = (sType || "").toUpperCase();
  const img = (dImage || "").toLowerCase();
  const ver = (env?.VERSION || env?.version || "").toLowerCase();
  const envType = (env?.TYPE || env?.type || "").toUpperCase();
  const envServerType = (env?.SERVER_TYPE || env?.serverType || "").toUpperCase();

  const isCodeSandbox =
    t === "CODESANDBOX" ||
    t === "CODESPACE" ||
    t === "SANDBOX" ||
    envType === "CODESANDBOX" ||
    envServerType === "CODESANDBOX" ||
    img.includes("code-server") ||
    img.includes("codercom") ||
    Boolean(env?.IS_SANDBOX === "true" || env?.isSandbox === "true");

  const isPumpkin = 
    !isCodeSandbox && (
    t === "PUMPKIN" || 
    envType === "PUMPKIN" || 
    envServerType === "PUMPKIN" || 
    ver.startsWith("pumpkin-") || 
    img.includes("pumpkin"));

  const isNodeJs = !isCodeSandbox && !isPumpkin && (t === "NODEJS" || img.startsWith("node:") || img.includes("bun") || img.includes("deno"));
  const isPython = !isCodeSandbox && !isPumpkin && (t === "PYTHON" || img.startsWith("python:") || img.includes("pytorch"));
  const isRust = !isCodeSandbox && !isPumpkin && (t === "RUST" || img.startsWith("rust:") || img.includes("rustlang"));
  const isPhp = !isCodeSandbox && !isPumpkin && (t === "PHP" || img.startsWith("php:") || img.includes("php"));
  const isGo = !isCodeSandbox && !isPumpkin && (t === "GO" || t === "GOLANG" || img.startsWith("golang:"));
  const isRuby = !isCodeSandbox && !isPumpkin && (t === "RUBY" || img.startsWith("ruby:"));
  const isWeb = !isCodeSandbox && !isPumpkin && (t === "WEB" || img.includes("nginx") || img.includes("caddy") || img.includes("httpd") || img.includes("traefik"));
  const isDatabase = !isCodeSandbox && !isPumpkin && (t === "DATABASE" || t === "MYSQL" || t === "POSTGRES" || t === "REDIS" || t === "MONGO" ||
    img.includes("mysql") || img.includes("postgres") || img.includes("redis") || img.includes("mongo") ||
    img.includes("mariadb") || img.includes("rabbitmq") || img.includes("elastic") || img.includes("meili"));
  const isGame = !isCodeSandbox && !isPumpkin && (t === "GAME" || t.includes("PALWORLD") || t.includes("RUST") || t.includes("VALHEIM") || t.includes("CS2") || t.includes("TERRARIA") || t.includes("ZOMBOID") || t.includes("ARK") || t.includes("7DTD") || t.includes("TF2") || t.includes("ENSHROUDED") ||
    img.includes("steam") || img.includes("palworld") || img.includes("terraria") || img.includes("valheim") || img.includes("tshock") || img.includes("didstopia") || img.includes("hermsi") || img.includes("vinanr") || img.includes("skarlso") || img.includes("cm2network"));
  const isMinecraft = !isCodeSandbox && !isPumpkin && !isNodeJs && !isPython && !isRust && !isPhp && !isGo && !isRuby && !isWeb && !isDatabase && !isGame &&
    (t === "MINECRAFT" || t === "PAPER" || t === "PURPUR" || t === "FABRIC" || t === "FORGE" || t === "VANILLA" || t === "SPIGOT" || t === "VELOCITY" || t === "BUNGEECORD" || img.includes("minecraft"));

  let label = "Custom Container";
  if (isCodeSandbox) label = "Code Sandbox (VS Code)";
  else if (isPumpkin) label = "Pumpkin MC";
  else if (isPhp) label = "PHP";
  else if (isPython) label = "Python";
  else if (isRust) label = "Rust";
  else if (isGo) label = "Golang";
  else if (isRuby) label = "Ruby";
  else if (isNodeJs) label = "Node.js";
  else if (isWeb) label = "Web Server";
  else if (isDatabase) label = "Database";
  else if (isGame) label = "Game Server";
  else if (isMinecraft) label = "Minecraft";

  return { isNodeJs, isPython, isRust, isPhp, isGo, isRuby, isWeb, isDatabase, isGame, isPumpkin, isMinecraft, isCodeSandbox, label };
}

export async function createServer(params: CreateServerParams): Promise<{ success: boolean; error?: string }> {
  console.log(`[ServerManager] CREATE server ${params.id} (${params.name})`);

  const dir = getServerDir(params.id);
  await fs.mkdir(dir, { recursive: true });

  const assignedPort = params.port ?? 25566;
  const env = { ...(params.environment || {}) };
  const sType = env.SERVER_TYPE || env.TYPE || "MINECRAFT";
  const dImage = env.DOCKER_IMAGE || "";

  const runtime = detectRuntime(sType, dImage, env);

  // Determine standard default startup commands if not provided
  let effectiveStartup = params.startupCommand || env.CUSTOM_SERVER || env.STARTUP_CMD || "";
  if (!effectiveStartup) {
    if (runtime.isPhp) effectiveStartup = `php -S 0.0.0.0:${env.INTERNAL_PORT || "8080"} index.php`;
    else if (runtime.isPython) effectiveStartup = "python -u main.py";
    else if (runtime.isRust) effectiveStartup = "cargo run --release";
    else if (runtime.isGo) effectiveStartup = "go run main.go";
    else if (runtime.isRuby) effectiveStartup = "ruby app.rb";
    else if (runtime.isNodeJs) effectiveStartup = "node server.js";
  }

  if (runtime.isNodeJs) {
    // Generate default Node.js starter files if not already present
    const pkgPath = path.join(dir, "package.json");
    const serverJsPath = path.join(dir, "server.js");
    const gitignorePath = path.join(dir, ".gitignore");

    const safePkgName = params.name.toLowerCase().replace(/[^a-z0-9-_]/g, "-") || "nodejs-app";
    const packageJsonContent = JSON.stringify({
      name: safePkgName,
      version: "1.0.0",
      description: "Node.js service managed by Rubber Panel",
      main: "server.js",
      scripts: {
        start: "node server.js",
        dev: "node server.js",
      },
      dependencies: {},
    }, null, 2);

    const serverJsContent = [
      "// Rubber Panel — Node.js Server Starter",
      "const http = require('http');",
      `const port = process.env.PORT || ${assignedPort};`,
      "",
      "const server = http.createServer((req, res) => {",
      "  res.writeHead(200, { 'Content-Type': 'application/json' });",
      "  res.end(JSON.stringify({",
      "    status: 'online',",
      "    message: 'Hello from Rubber Panel Node.js Server!',",
      "    server: " + JSON.stringify(params.name) + ",",
      "    nodeVersion: process.version,",
      "    timestamp: new Date().toISOString(),",
      "    port: port",
      "  }, null, 2));",
      "});",
      "",
      "server.listen(port, '0.0.0.0', () => {",
      "  console.log(`[Node.js] Server listening and active on port ${port}`);",
      "});",
      "",
    ].join("\n");

    try { await fs.writeFile(pkgPath, packageJsonContent, { flag: "wx" }); } catch {}
    try { await fs.writeFile(serverJsPath, serverJsContent, { flag: "wx" }); } catch {}
    try { await fs.writeFile(gitignorePath, "node_modules\n.env\n.rp-*\n", { flag: "wx" }); } catch {}
  } else if (runtime.isPhp) {
    // Generate default PHP starter files
    const indexPath = path.join(dir, "index.php");
    const gitignorePath = path.join(dir, ".gitignore");

    const indexPhpContent = [
      "<?php",
      "// Rubber Panel — PHP Service Starter",
      "$port = getenv('PORT') ?: '" + (env.INTERNAL_PORT || "8080") + "';",
      "header('Content-Type: application/json');",
      "echo json_encode([",
      "    'status' => 'online',",
      "    'service' => 'PHP ' . phpversion() . ' on Rubber Panel',",
      `    'server' => ${JSON.stringify(params.name)},`,
      "    'port' => (int)$port,",
      "    'timestamp' => date('c')",
      "], JSON_PRETTY_PRINT);",
      "",
    ].join("\n");

    try { await fs.writeFile(indexPath, indexPhpContent, { flag: "wx" }); } catch {}
    try { await fs.writeFile(gitignorePath, ".env\nvendor/\n", { flag: "wx" }); } catch {}
  } else if (runtime.isPython) {
    // Generate default Python starter files
    const mainPyPath = path.join(dir, "main.py");
    const reqsPath = path.join(dir, "requirements.txt");
    const gitignorePath = path.join(dir, ".gitignore");

    const mainPyContent = [
      "# Rubber Panel — Python Service Starter",
      "import os",
      "import json",
      "from http.server import HTTPServer, BaseHTTPRequestHandler",
      "",
      `PORT = int(os.environ.get('PORT', ${env.INTERNAL_PORT || "8000"}))`,
      "",
      "class SimpleHandler(BaseHTTPRequestHandler):",
      "    def do_GET(self):",
      "        self.send_response(200)",
      "        self.send_header('Content-Type', 'application/json')",
      "        self.end_headers()",
      "        payload = {",
      "            'status': 'online',",
      "            'service': 'Python on Rubber Panel',",
      `            'server_name': ${JSON.stringify(params.name)},`,
      "            'port': PORT",
      "        }",
      "        self.wfile.write(json.dumps(payload, indent=2).encode('utf-8'))",
      "",
      "def run():",
      "    server_address = ('0.0.0.0', PORT)",
      "    httpd = HTTPServer(server_address, SimpleHandler)",
      "    print(f'[Python] HTTP Server listening on port {PORT}...')",
      "    httpd.serve_forever()",
      "",
      "if __name__ == '__main__':",
      "    run()",
      "",
    ].join("\n");

    try { await fs.writeFile(mainPyPath, mainPyContent, { flag: "wx" }); } catch {}
    try { await fs.writeFile(reqsPath, "# Add your pip requirements here\n", { flag: "wx" }); } catch {}
    try { await fs.writeFile(gitignorePath, "__pycache__/\n*.pyc\n.env\nvenv/\n", { flag: "wx" }); } catch {}
  } else if (runtime.isRust) {
    // Generate default Rust starter files
    const srcDir = path.join(dir, "src");
    await fs.mkdir(srcDir, { recursive: true });
    const cargoTomlPath = path.join(dir, "Cargo.toml");
    const mainRsPath = path.join(srcDir, "main.rs");

    const cargoTomlContent = [
      `[package]`,
      `name = "${params.name.toLowerCase().replace(/[^a-z0-9-_]/g, "_") || "rust_app"}"`,
      `version = "0.1.0"`,
      `edition = "2021"`,
      "",
      `[dependencies]`,
      "",
    ].join("\n");

    const mainRsContent = [
      "// Rubber Panel — Rust Service Starter",
      "use std::net::TcpListener;",
      "use std::io::Write;",
      "",
      "fn main() {",
      `    let port = std::env::var("PORT").unwrap_or_else(|_| "${env.INTERNAL_PORT || "8080"}".to_string());`,
      `    let addr = format!("0.0.0.0:{}", port);`,
      `    println!("[Rust] Server listening on {}", addr);`,
      `    let listener = TcpListener::bind(&addr).expect("Failed to bind socket");`,
      `    for stream in listener.incoming() {`,
      `        if let Ok(mut stream) = stream {`,
      `            let response = "HTTP/1.1 200 OK\\r\\nContent-Type: application/json\\r\\n\\r\\n{\\"status\\":\\"online\\",\\"engine\\":\\"Rust\\"}\\n";`,
      `            let _ = stream.write_all(response.as_bytes());`,
      `        }`,
      `    }`,
      "}",
    ].join("\n");

    try { await fs.writeFile(cargoTomlPath, cargoTomlContent, { flag: "wx" }); } catch {}
    try { await fs.writeFile(mainRsPath, mainRsContent, { flag: "wx" }); } catch {}
  } else if (runtime.isGo) {
    // Generate default Golang starter files
    const mainGoPath = path.join(dir, "main.go");
    const mainGoContent = [
      "package main",
      "",
      "import (",
      '	"fmt"',
      '	"net/http"',
      '	"os"',
      ")",
      "",
      "func main() {",
      '	port := os.Getenv("PORT")',
      '	if port == "" {',
      `		port = "${env.INTERNAL_PORT || "8080"}"`,
      "	}",
      '	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {',
      '		w.Header().Set("Content-Type", "application/json")',
      `		fmt.Fprintf(w, "{\\"status\\":\\"online\\",\\"service\\":\\"Golang on Rubber Panel\\",\\"port\\":%s}\\n", port)`,
      "	})",
      '	fmt.Printf("[Golang] Server listening on port %s...\\n", port)',
      '	http.ListenAndServe(":"+port, nil)',
      "}",
      "",
    ].join("\n");

    try { await fs.writeFile(mainGoPath, mainGoContent, { flag: "wx" }); } catch {}
  } else if (runtime.isWeb) {
    // Generate default static Web HTML
    const indexPath = path.join(dir, "index.html");
    const indexHtmlContent = [
      "<!DOCTYPE html>",
      "<html lang=\"en\">",
      "<head>",
      "  <meta charset=\"UTF-8\">",
      `  <title>${params.name} — Rubber Panel</title>`,
      "  <style>",
      "    body { font-family: system-ui, sans-serif; background: #0b0f17; color: #f3f4f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }",
      "    .card { background: #111827; border: 1px solid #1f2937; padding: 2.5rem; border-radius: 1.5rem; text-align: center; max-width: 480px; }",
      "    h1 { color: #a3e635; margin-top: 0; font-size: 1.5rem; }",
      "    p { color: #9ca3af; font-size: 0.9rem; line-height: 1.5; }",
      "  </style>",
      "</head>",
      "<body>",
      "  <div class=\"card\">",
      `    <h1>${params.name} is Online</h1>`,
      "    <p>Powered by Rubber Panel Web Container Engine.</p>",
      "  </div>",
      "</body>",
      "</html>",
    ].join("\n");
    try { await fs.writeFile(indexPath, indexHtmlContent, { flag: "wx" }); } catch {}
  } else if (runtime.isCodeSandbox) {
    // Generate initial Code Sandbox Workspace README and package template
    const welcomeFile = path.join(dir, "README.md");
    const welcomeContent = `# 🚀 ${params.name} — Cloud Code Sandbox

Welcome to your cloud-hosted **VS Code development environment** powered by Rubber Panel!

## 🛠️ Features:
- **Full VS Code in Browser**: Terminal, extensions, git integration, syntax highlighting, and live previews.
- **Persistent Workspace**: All files in this folder are safely persisted on your compute node.
- **Port Forwarding**: Test web apps and APIs directly on your allocated panel ports.

---
*Powered by Rubber Panel Cloud IDE Engine*
`;
    try { await fs.writeFile(welcomeFile, welcomeContent, { flag: "wx" }); } catch {}
  } else if (runtime.isPumpkin) {
    // Pumpkin (Rust Minecraft Server) Initialization
    const javaPort = parseInt(env.JAVA_PORT || `${assignedPort}`) || assignedPort;
    const bedrockPort = parseInt(env.BEDROCK_PORT || `${assignedPort + 1}`) || (assignedPort + 1);
    try {
      const { ensurePumpkinConfiguration } = await import("./pumpkin-agent");
      await ensurePumpkinConfiguration(dir, javaPort, bedrockPort);
    } catch (pErr: any) {
      console.warn("[ServerManager] Failed to pre-configure Pumpkin:", pErr?.message);
    }
  } else if (runtime.isMinecraft) {
    // Accept EULA automatically
    await fs.writeFile(path.join(dir, "eula.txt"), "eula=true\n", "utf-8");

    // Create initial server.properties
    const serverPropertiesContent = [
      "# Minecraft server properties",
      "# Auto-generated by Rubber Panel",
      `server-port=25565`,
      `query.port=25565`,
      "enable-rcon=false",
      "online-mode=false",
      "motd=A Minecraft Server powered by Rubber Panel",
      "enable-query=true",
      "eula=true",
      "",
    ].join("\n");

    await fs.writeFile(path.join(dir, "server.properties"), serverPropertiesContent, "utf-8");
    const readmePath = path.join(dir, "README.md");
    const readmeContent = [
      `# ${params.name}`,
      `Managed container instance on Rubber Panel.`,
      `- Container Image: \`${env.DOCKER_IMAGE || "Custom"}\``,
      `- Assigned Host Port: \`${assignedPort}\``,
      `- Created: \`${new Date().toISOString()}\``,
    ].join("\n");
    try { await fs.writeFile(readmePath, readmeContent, { flag: "wx" }); } catch {}
  }

  const info: ServerInfo = {
    id: params.id,
    name: params.name,
    status: "STOPPED",
    ram: params.ram,
    cpu: params.cpu,
    port: assignedPort,
    internalPort: params.internalPort,
    startupCommand: effectiveStartup || undefined,
    environment: env,
  };

  serverStates.set(params.id, info);
  await saveState(params.id, info);

  appendLog(params.id, `[Rubber] Server "${params.name}" (${runtime.label}) provisioned on port ${assignedPort}. Press Start to initialize.`);
  return { success: true };
}

export async function updateServerInfo(serverId: string, patch: Partial<ServerInfo>): Promise<{ success: boolean; error?: string }> {
  let info = await getOrLoadServerState(serverId);
  if (!info) {
    return { success: false, error: "Server not found on this node" };
  }

  if (patch.name !== undefined) info.name = patch.name;
  if (patch.port !== undefined) info.port = patch.port;
  if (patch.internalPort !== undefined) info.internalPort = patch.internalPort;
  if (patch.ram !== undefined) info.ram = patch.ram;
  if (patch.cpu !== undefined) info.cpu = patch.cpu;
  if (patch.disk !== undefined) info.disk = patch.disk;
  if (patch.startupCommand !== undefined) info.startupCommand = patch.startupCommand;
  if (patch.environment) {
    info.environment = { ...info.environment, ...patch.environment };
  }

  serverStates.set(serverId, info);
  await saveState(serverId, info);
  appendLog(serverId, `[Rubber] Instance configuration updated.`);
  return { success: true };
}

export async function startServer(serverId: string): Promise<{ success: boolean; error?: string }> {
  console.log(`[ServerManager] START server ${serverId}`);
  let info = await getOrLoadServerState(serverId);

  if (!info) {
    return { success: false, error: "Server not found on this node" };
  }

  // ─── 1. CHECK SECURITY QUARANTINE STATUS ──────────────────────────────────
  const { isServerQuarantined, applyQuarantine, scanServerSecurity } = await import("./security-scanner");
  const quarantineCheck = isServerQuarantined(serverId);
  if (quarantineCheck.quarantined) {
    const remaining = quarantineCheck.remainingSec ?? 300;
    appendLog(serverId, `[SECURITY SHIELD] Cannot start: Server is currently QUARANTINED for 5 minutes. Remaining: ${remaining}s.`);
    info.status = "STOPPED";
    serverStates.set(serverId, info);
    return {
      success: false,
      error: `[SECURITY SHIELD] Server is quarantined due to detected harmful patterns. Suspension lifts in ${remaining} seconds.`,
    };
  }

  // ─── 2. RUN SECURITY SCAN (IF PROTECTION LAYER ENABLED) ─────────────────
  const env = { ...(info.environment || {}) };
  const customInternalPort = env.INTERNAL_PORT || env.PORT || (info.internalPort ? String(info.internalPort) : undefined);
  const sType = env.SERVER_TYPE || env.TYPE || "MINECRAFT";
  const dImageRaw = env.DOCKER_IMAGE || "";
  const runtime = detectRuntime(sType, dImageRaw, env);

  const securityEnabled = env.SECURITY_PROTECTION !== "false";

  if (securityEnabled && runtime.isNodeJs) {
    const scan = await scanServerSecurity(serverId);
    if (!scan.safe && scan.threats.length > 0) {
      const threat = scan.threats[0];
      applyQuarantine(serverId, threat);

      // Notify admin panel to update DB quarantine / suspension state
      const adminUrl = process.env.ADMIN_API_URL || "http://localhost:3000";
      try {
        fetch(`${adminUrl}/api/admin/servers/${serverId}/quarantine`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NODE_TOKEN || ""}`,
            "X-Internal-Secret": process.env.INTERNAL_API_SECRET || "rubber-panel-internal-secret",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RubberPanel/2.0 (Flaxa Studios)",
            "Bypass-Tunnel-Reminder": "true",
          },
          body: JSON.stringify({
            threat,
            quarantinedUntil: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          }),
        }).catch((err) => console.error("[Quarantine Notification Error]:", err));
      } catch {}

      info.status = "STOPPED";
      serverStates.set(serverId, info);
      return {
        success: false,
        error: `[SECURITY SHIELD] Blocked & Quarantined: Harmful pattern "${threat.description}" detected in ${threat.file} (Line ${threat.line}). Server suspended for 5 minutes.`,
      };
    }
  }

  // ─── 2.5 RELEASE WAKE PROXY PORT IF ACTIVE ──────────────────────────────
  const { stopWakeProxy, stopWakeProxyByPort } = await import("./cryo-sleep-proxy");
  const assignedPort = info.port ?? 25566;
  await stopWakeProxy(serverId, assignedPort).catch(() => {});
  await stopWakeProxyByPort(assignedPort).catch(() => {});

  const containerName = getContainerName(serverId);
  info.status = "STARTING";
  info.isCryoSleeping = false;
  serverStates.set(serverId, info);
  appendLog(serverId, `[Rubber] Starting ${runtime.label} server container...`);

  try {
    const dir = getServerDir(serverId);

    if (runtime.isMinecraft) {
      // Ensure eula.txt is in place
      await fs.writeFile(path.join(dir, "eula.txt"), "eula=true\n", "utf-8");
    }

    // Clean up any stale or exited container before starting fresh
    const isRunning = await containerRunning(containerName);
    if (isRunning) {
      appendLog(serverId, "[Rubber] Container already active, attaching to output...");
      attachLogs(serverId);
      info.status = "RUNNING";
      info.isCryoSleeping = false;
      serverStates.set(serverId, info);
      await saveState(serverId, info);
      return { success: true };
    }

    const exists = await containerExists(containerName);
    if (exists) {
      appendLog(serverId, "[Rubber] Removing previous container state for clean start...");
      try {
        await execAsync(`docker rm -f ${containerName}`);
      } catch {}
    }

    // Ensure the host port is completely free and no orphan container holds it
    try {
      await stopWakeProxy(serverId, assignedPort).catch(() => {});
      await stopWakeProxyByPort(assignedPort).catch(() => {});
      await execAsync(`docker ps -a -q --filter "publish=${assignedPort}" | xargs -r docker rm -f 2>/dev/null || true`);
      await new Promise(r => setTimeout(r, 200));
    } catch {}

    const hostCores = os.cpus()?.length || 1;
    const requestedCores = (info.cpu || 100) / 100;
    const effectiveCores = Math.max(0.1, Math.min(requestedCores, hostCores));
    const cpuLimit = effectiveCores.toFixed(2);

    let dockerArgs: string[] = [];

    if (runtime.isNodeJs) {
      const nodeVer = env.NODE_VERSION || "20";
      const dockerImage = env.DOCKER_IMAGE || `node:${nodeVer}-alpine`;
      delete env.DOCKER_IMAGE;

      const envArgs = buildEnvArgs(env);
      const startCmd = info.startupCommand?.trim() || "node server.js";

      appendLog(serverId, `[Rubber] Launching Node.js ${dockerImage} on host port ${assignedPort}...`);
      appendLog(serverId, `[Rubber] Security Shield: ${securityEnabled ? "ACTIVE (Threat Scanner & 5-Min Quarantine)" : "DISABLED"}`);
      appendLog(serverId, `[Rubber] Startup Script:  ${startCmd}`);

      dockerArgs = [
        "run", "-d",
        "--name", containerName,
        "-p", `${assignedPort}:3000`,
        "-w", "/app",
        "-v", `${getServerDir(serverId)}:/app`,
        "-m", `${info.ram}m`,
        `--cpus=${cpuLimit}`,
        "--restart=no",
        "-e", "PORT=3000",
        "-e", "NODE_ENV=production",
        ...envArgs,
        dockerImage,
        "sh", "-c",
        `if [ -f package.json ] && [ ! -d node_modules ]; then echo '[Rubber] Running npm install...'; npm install --production --no-audit; fi; echo '[Rubber] Executing: ${startCmd}'; exec ${startCmd}`
      ];
    } else if (runtime.isPhp) {
      const dockerImage = env.DOCKER_IMAGE || "php:8.3-cli-alpine";
      const internalPort = env.INTERNAL_PORT || "8080";
      delete env.DOCKER_IMAGE;
      delete env.INTERNAL_PORT;

      const envArgs = buildEnvArgs(env);
      const startCmd = info.startupCommand?.trim() || `php -S 0.0.0.0:${internalPort} index.php`;

      appendLog(serverId, `[Rubber] Launching PHP ${dockerImage} on host port ${assignedPort} (internal :${internalPort})...`);
      appendLog(serverId, `[Rubber] Startup Script: ${startCmd}`);

      dockerArgs = [
        "run", "-d",
        "--name", containerName,
        "-p", `${assignedPort}:${internalPort}`,
        "-w", "/app",
        "-v", `${getServerDir(serverId)}:/app`,
        "-m", `${info.ram}m`,
        `--cpus=${cpuLimit}`,
        "--restart=no",
        "-e", `PORT=${internalPort}`,
        ...envArgs,
        dockerImage,
        "sh", "-c",
        `echo '[Rubber] Executing: ${startCmd}'; exec ${startCmd}`
      ];
    } else if (runtime.isPython) {
      const pyVer = env.PYTHON_VERSION || "3.11";
      const dockerImage = env.DOCKER_IMAGE || `python:${pyVer}-alpine`;
      const internalPort = env.INTERNAL_PORT || "8000";
      delete env.DOCKER_IMAGE;
      delete env.INTERNAL_PORT;

      const envArgs = buildEnvArgs(env);
      const startCmd = info.startupCommand?.trim() || `python main.py`;

      appendLog(serverId, `[Rubber] Launching Python ${dockerImage} on host port ${assignedPort} (internal :${internalPort})...`);
      appendLog(serverId, `[Rubber] Startup Script: ${startCmd}`);

      dockerArgs = [
        "run", "-d",
        "--name", containerName,
        "-p", `${assignedPort}:${internalPort}`,
        "-w", "/app",
        "-v", `${getServerDir(serverId)}:/app`,
        "-m", `${info.ram}m`,
        `--cpus=${cpuLimit}`,
        "--restart=no",
        "-e", `PORT=${internalPort}`,
        ...envArgs,
        dockerImage,
        "sh", "-c",
        `if [ -f requirements.txt ] && [ -s requirements.txt ]; then echo '[Rubber] Installing pip packages...'; pip install --no-cache-dir -r requirements.txt; fi; echo '[Rubber] Executing: ${startCmd}'; exec ${startCmd}`
      ];
    } else if (runtime.isRust) {
      const dockerImage = env.DOCKER_IMAGE || "rust:alpine";
      const internalPort = env.INTERNAL_PORT || "8080";
      delete env.DOCKER_IMAGE;
      delete env.INTERNAL_PORT;

      const envArgs = buildEnvArgs(env);
      const startCmd = info.startupCommand?.trim() || "cargo run --release";

      appendLog(serverId, `[Rubber] Launching Rust ${dockerImage} on host port ${assignedPort} (internal :${internalPort})...`);
      appendLog(serverId, `[Rubber] Startup Script: ${startCmd}`);

      dockerArgs = [
        "run", "-d",
        "--name", containerName,
        "-p", `${assignedPort}:${internalPort}`,
        "-w", "/app",
        "-v", `${getServerDir(serverId)}:/app`,
        "-m", `${info.ram}m`,
        `--cpus=${cpuLimit}`,
        "--restart=no",
        "-e", `PORT=${internalPort}`,
        ...envArgs,
        dockerImage,
        "sh", "-c",
        `echo '[Rubber] Executing: ${startCmd}'; exec ${startCmd}`
      ];
    } else if (runtime.isGo) {
      const dockerImage = env.DOCKER_IMAGE || "golang:alpine";
      const internalPort = env.INTERNAL_PORT || "8080";
      delete env.DOCKER_IMAGE;
      delete env.INTERNAL_PORT;

      const envArgs = buildEnvArgs(env);
      const startCmd = info.startupCommand?.trim() || "go run main.go";

      appendLog(serverId, `[Rubber] Launching Golang ${dockerImage} on host port ${assignedPort} (internal :${internalPort})...`);
      appendLog(serverId, `[Rubber] Startup Script: ${startCmd}`);

      dockerArgs = [
        "run", "-d",
        "--name", containerName,
        "-p", `${assignedPort}:${internalPort}`,
        "-w", "/app",
        "-v", `${getServerDir(serverId)}:/app`,
        "-m", `${info.ram}m`,
        `--cpus=${cpuLimit}`,
        "--restart=no",
        "-e", `PORT=${internalPort}`,
        ...envArgs,
        dockerImage,
        "sh", "-c",
        `echo '[Rubber] Executing: ${startCmd}'; exec ${startCmd}`
      ];
    } else if (runtime.isDatabase) {
      // Database Container Engine (MySQL, PostgreSQL, Redis, MongoDB, MariaDB)
      const dockerImage = env.DOCKER_IMAGE || "mariadb:latest";
      const { internalPort, protocol } = await resolveContainerPortMapping(
        dockerImage,
        assignedPort,
        customInternalPort
      );
      const volumePath = env.VOLUME_PATH || (dockerImage.includes("redis") ? "/data" : dockerImage.includes("mongo") ? "/data/db" : "/var/lib/mysql");
      delete env.DOCKER_IMAGE;
      delete env.INTERNAL_PORT;
      delete env.VOLUME_PATH;

      const envArgs = buildEnvArgs(env);
      const startCmd = info.startupCommand?.trim();

      appendLog(serverId, `[Rubber] Launching Database ${dockerImage} on host port ${assignedPort} (internal :${internalPort} ${protocol.toUpperCase()})...`);
      if (startCmd) appendLog(serverId, `[Rubber] Startup Script: ${startCmd}`);

      dockerArgs = [
        "run", "-d",
        "--name", containerName,
        "-p", `${assignedPort}:${internalPort}/${protocol === "both" ? "tcp" : protocol}`,
        "-v", `${getServerDir(serverId)}:${volumePath}`,
        "-m", `${info.ram}m`,
        `--cpus=${cpuLimit}`,
        "--restart=no",
        ...envArgs,
        dockerImage,
      ];

      if (startCmd) {
        dockerArgs.push("sh", "-c", `echo '[Rubber] Executing: ${startCmd}'; exec ${startCmd}`);
      }
    } else if (runtime.isCodeSandbox) {
      // VS Code Server Container Execution
      const dockerImage = env.DOCKER_IMAGE || "codercom/code-server:latest";
      const authPassword = env.PASSWORD || env.CODE_SERVER_PASSWORD || `rp-${serverId.slice(0, 8)}`;
      const authArg = authPassword ? "password" : "none";

      delete env.DOCKER_IMAGE;
      delete env.PASSWORD;
      delete env.CODE_SERVER_PASSWORD;

      const envArgs = buildEnvArgs(env);

      appendLog(serverId, `[Rubber] Launching Cloud Code Sandbox (VS Code IDE) on host port :${assignedPort}...`);
      appendLog(serverId, `[Rubber] Image: ${dockerImage} | Auth: ${authArg}`);

      dockerArgs = [
        "run", "-d",
        "--name", containerName,
        "-p", `${assignedPort}:8080/tcp`,
        "-v", `${getServerDir(serverId)}:/home/coder/project`,
        "-w", "/home/coder/project",
        "-m", `${info.ram}m`,
        `--cpus=${cpuLimit}`,
        "--restart=no",
        "-e", `PASSWORD=${authPassword}`,
        ...envArgs,
        dockerImage,
        "code-server",
        "--bind-addr", "0.0.0.0:8080",
        "--auth", authArg,
        "/home/coder/project",
      ];
    } else if (runtime.isPumpkin) {
      // Native High-Performance Pumpkin Rust Minecraft Server
      const javaPort = assignedPort;
      const bedrockPort = env.BEDROCK_PORT ? parseInt(env.BEDROCK_PORT, 10) : (assignedPort + 1000);
      const serverDir = getServerDir(serverId);

      const { ensurePumpkinConfiguration, installPumpkinBinaryOnNode } = await import("./pumpkin-agent");
      await ensurePumpkinConfiguration(serverDir, javaPort, bedrockPort);
      const dlRes = await installPumpkinBinaryOnNode({
        versionId: env.VERSION || "pumpkin-nightly-latest",
        commitSha: "nightly",
      });
      if (!dlRes.success || !dlRes.path || !fsSync.existsSync(dlRes.path) || fsSync.statSync(dlRes.path).isDirectory()) {
        appendLog(serverId, `[Rubber] ❌ Failed to prepare Pumpkin server: ${dlRes.error || "Pumpkin binary not available"}`);
        throw new Error(dlRes.error || "Pumpkin binary not available");
      }
      const binaryPath = dlRes.path;

      // Ensure file descriptor quiescence before launching container
      await new Promise((r) => setTimeout(r, 200));

      // Clean Pumpkin environment variables
      delete env.SERVER_TYPE;
      delete env.TYPE;
      delete env.BEDROCK_PORT;
      delete env.VERSION;

      const envArgs = buildEnvArgs(env);
      let dockerImage = env.DOCKER_IMAGE;
      if (!dockerImage || dockerImage === "debian:bookworm-slim") {
        dockerImage = "ubuntu:24.04";
      }
      delete env.DOCKER_IMAGE;

      appendLog(serverId, `[Rubber] Launching Pumpkin (Rust MC) on Java port :${javaPort} and Bedrock port :${bedrockPort}...`);
      appendLog(serverId, `[Rubber] Version: ${env.VERSION || "Nightly"}`);

      dockerArgs = [
        "run", "-d",
        "--name", containerName,
        "-i",
        "-p", `${javaPort}:${javaPort}/tcp`,
        "-p", `${bedrockPort}:${bedrockPort}/udp`,
        "-v", `${serverDir}:/app`,
        "-v", `${binaryPath}:/usr/local/bin/pumpkin:ro`,
        "-w", "/app",
        "-m", `${info.ram}m`,
        `--cpus=${cpuLimit}`,
        "--restart=no",
        "-e", `RUST_LOG=${env.RUST_LOG || "info"}`,
        "-e", `PUMPKIN_PORT=${javaPort}`,
        "-e", `PORT=${javaPort}`,
        ...envArgs,
        dockerImage,
        "sh", "-c",
        "mkfifo /tmp/console.in 2>/dev/null; (tail -f /tmp/console.in 2>/dev/null &) | exec /usr/local/bin/pumpkin",
      ];
    } else if (runtime.isMinecraft) {
      // Native High-Performance Minecraft Server (Adoptium / Eclipse Temurin OpenJDK)
      const initRam = Math.max(256, Math.floor(info.ram * 0.25));
      const maxRam = info.ram;
      const serverDir = getServerDir(serverId);
      await fs.mkdir(serverDir, { recursive: true });

      // 1. Auto-create eula.txt
      const eulaPath = path.join(serverDir, "eula.txt");
      if (!fsSync.existsSync(eulaPath)) {
        await fs.writeFile(eulaPath, "eula=true\n");
      }

      // 2. Synchronize server.properties to bind internally to 25565
      const propPath = path.join(serverDir, "server.properties");
      if (fsSync.existsSync(propPath)) {
        let propContent = await fs.readFile(propPath, "utf-8");
        if (/^server-port=/m.test(propContent)) {
          propContent = propContent.replace(/^server-port=.*$/m, "server-port=25565");
        } else {
          propContent += "\nserver-port=25565";
        }
        if (/^query\.port=/m.test(propContent)) {
          propContent = propContent.replace(/^query\.port=.*$/m, "query.port=25565");
        } else {
          propContent += "\nquery.port=25565";
        }
        if (/^server-ip=/m.test(propContent)) {
          propContent = propContent.replace(/^server-ip=.*$/m, "server-ip=");
        }
        await fs.writeFile(propPath, propContent, "utf-8");
      } else {
        await fs.writeFile(propPath, "server-port=25565\nquery.port=25565\nenable-query=true\nenable-rcon=false\nserver-ip=\n", "utf-8");
      }

      // 3. Ensure server.jar is present
      const rawJava = String(env.JAVA_VERSION || info.javaVersion || "21").trim();
      const javaVer = ["21", "17", "11", "8"].includes(rawJava) ? rawJava : "21";
      const swType = env.TYPE || "PAPER";
      const swVer = env.VERSION || "1.21.1";
      await downloadMinecraftJarIfMissing(serverId, swType, swVer);

      // 4. Resolve Docker Image (Default: Adoptium OpenJDK)
      let dockerImage = env.DOCKER_IMAGE;
      if (!dockerImage || dockerImage.startsWith("itzg/minecraft-server") || dockerImage.includes("minecraft")) {
        dockerImage = `eclipse-temurin:${javaVer}-jre-alpine`;
      }
      delete env.DOCKER_IMAGE;
      delete env.TYPE;
      delete env.VERSION;

      const envArgs = buildEnvArgs(env);
      const customCmd = info.startupCommand?.trim();
      const defaultCmd = `java -Xms${initRam}M -Xmx${maxRam}M -jar server.jar nogui`;
      const javaExecCmd = customCmd || defaultCmd;

      appendLog(serverId, `[Rubber] Launching ${dockerImage} on host port ${assignedPort}...`);
      appendLog(serverId, `[Rubber] Software: ${swType} ${swVer}`);
      appendLog(serverId, `[Rubber] Java Runtime: Adoptium OpenJDK ${javaVer}`);
      appendLog(serverId, `[Rubber] Startup Command: ${javaExecCmd}`);

      dockerArgs = [
        "run", "-d", "-i",
        "--name", containerName,
        "-p", `${assignedPort}:25565/tcp`,
        "-p", `${assignedPort}:25565/udp`,
        "--dns", "8.8.8.8",
        "--dns", "1.1.1.1",
        "-v", `${serverDir}:/app`,
        "-w", "/app",
        "-m", `${info.ram}m`,
        `--cpus=${cpuLimit}`,
        "--restart=no",
        ...envArgs,
        dockerImage,
        "sh", "-c",
        `mkfifo /tmp/console.in 2>/dev/null; (tail -f /tmp/console.in 2>/dev/null &) | exec ${javaExecCmd}`,
      ];
    } else if (runtime.isGame) {
      // SteamCMD & Multi-Game Dedicated Server Execution (Palworld, Rust, Valheim, CS2, Terraria, ARK, etc.)
      const dockerImage = env.DOCKER_IMAGE || "cm2network/steamcmd:latest";
      const { internalPort, protocol } = await resolveContainerPortMapping(
        dockerImage,
        assignedPort,
        customInternalPort || "27015"
      );
      const volumePath = env.VOLUME_PATH || (dockerImage.includes("palworld") ? "/palworld" : dockerImage.includes("valheim") ? "/config" : dockerImage.includes("rust") ? "/steamcmd/rust" : dockerImage.includes("terraria") ? "/root/.local/share/Terraria/Worlds" : "/data");
      delete env.DOCKER_IMAGE;
      delete env.INTERNAL_PORT;
      delete env.VOLUME_PATH;

      const envArgs = buildEnvArgs(env);
      const startCmd = info.startupCommand?.trim();

      appendLog(serverId, `[Rubber] Launching Game Server ${dockerImage} on host port ${assignedPort} (internal :${internalPort} ${protocol.toUpperCase()})...`);
      if (startCmd) appendLog(serverId, `[Rubber] Startup Script: ${startCmd}`);

      const portMappingArgs = (protocol === "both")
        ? ["-p", `${assignedPort}:${internalPort}/tcp`, "-p", `${assignedPort}:${internalPort}/udp`]
        : (protocol === "udp")
        ? ["-p", `${assignedPort}:${internalPort}/udp`]
        : ["-p", `${assignedPort}:${internalPort}/tcp`];

      dockerArgs = [
        "run", "-d",
        "--name", containerName,
        ...portMappingArgs,
        "-v", `${getServerDir(serverId)}:${volumePath}`,
        "-m", `${info.ram}m`,
        `--cpus=${cpuLimit}`,
        "--restart=no",
        "-e", `PORT=${internalPort}`,
        "-e", `SERVER_PORT=${internalPort}`,
        ...envArgs,
        dockerImage,
      ];

      if (startCmd) {
        dockerArgs.push("sh", "-c", `echo '[Rubber] Executing: ${startCmd}'; exec ${startCmd}`);
      }
    } else {
      // Generic / Any Docker Container Image (Universal Auto-Port Compliance)
      const dockerImage = env.DOCKER_IMAGE || "alpine:latest";
      const { internalPort, protocol } = await resolveContainerPortMapping(
        dockerImage,
        assignedPort,
        customInternalPort
      );
      delete env.DOCKER_IMAGE;
      delete env.INTERNAL_PORT;

      const envArgs = buildEnvArgs(env);
      const startCmd = info.startupCommand?.trim();

      appendLog(serverId, `[Rubber] Auto-detected container port: ${internalPort} (${protocol.toUpperCase()})`);
      appendLog(serverId, `[Rubber] Launching Container ${dockerImage} on host port ${assignedPort} -> internal :${internalPort}...`);
      if (startCmd) appendLog(serverId, `[Rubber] Startup Script: ${startCmd}`);

      const portMappingArgs = (protocol === "both")
        ? ["-p", `${assignedPort}:${internalPort}/tcp`, "-p", `${assignedPort}:${internalPort}/udp`]
        : (protocol === "udp")
        ? ["-p", `${assignedPort}:${internalPort}/udp`]
        : ["-p", `${assignedPort}:${internalPort}/tcp`];

      dockerArgs = [
        "run", "-d",
        "--name", containerName,
        ...portMappingArgs,
        "-w", "/app",
        "-v", `${getServerDir(serverId)}:/app`,
        "-m", `${info.ram}m`,
        `--cpus=${cpuLimit}`,
        "--restart=no",
        "-e", `PORT=${internalPort}`,
        "-e", `SERVER_PORT=${internalPort}`,
        "-e", `INTERNAL_PORT=${internalPort}`,
        "-e", `APP_PORT=${internalPort}`,
        "-e", `HTTP_PORT=${internalPort}`,
        "-e", `HOST=0.0.0.0`,
        "-e", `BIND_ADDRESS=0.0.0.0`,
        ...envArgs,
        dockerImage,
      ];

      if (startCmd) {
        dockerArgs.push("sh", "-c", `echo '[Rubber] Executing: ${startCmd}'; exec ${startCmd}`);
      } else if (dockerImage.includes("alpine") || dockerImage.includes("ubuntu") || dockerImage.includes("debian") || dockerImage.includes("busybox")) {
        dockerArgs.push("sh", "-c", "echo '[Rubber] Interactive container active and running in background.'; tail -f /dev/null");
      }
    }

    console.log(`[ServerManager] docker ${dockerArgs.join(" ")}`);
    const { stdout } = await execAsync(`docker ${dockerArgs.map(a => JSON.stringify(a)).join(" ")}`);
    appendLog(serverId, `[Rubber] Container initialized: ${stdout.trim().slice(0, 12)}`);

    // Attach log stream
    attachLogs(serverId);

    if (runtime.isMinecraft) {
      // Sync jar in background for Minecraft
      setTimeout(() => syncServerJar(serverId), 5000);
    }

    info.status = "RUNNING";
    serverStates.set(serverId, info);
    await saveState(serverId, info);

    // Reset Cryo-Sleep active timer on fresh boot
    try {
      const { resetServerActiveTimer } = await import("./cryo-sleep-engine");
      resetServerActiveTimer(serverId);
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error(`[ServerManager] Failed to start server ${serverId}:`, err);
    appendLog(serverId, `[ERROR] Failed to start: ${err.message}`);
    info.status = "CRASHED";
    serverStates.set(serverId, info);
    await saveState(serverId, info);
    return { success: false, error: err.message };
  }
}

export async function stopServer(serverId: string, force = false): Promise<{ success: boolean; error?: string }> {
  console.log(`[ServerManager] STOP server ${serverId} (force=${force})`);
  const info = await getOrLoadServerState(serverId);
  if (!info) return { success: false, error: "Server not found" };

  const running = await containerRunning(getContainerName(serverId));
  if (!running) {
    info.status = "STOPPED";
    serverStates.set(serverId, info);
    await saveState(serverId, info);
    return { success: true };
  }

  info.status = "STOPPING";
  serverStates.set(serverId, info);
  appendLog(serverId, `[Rubber] ${force ? "Force-killing" : "Stopping"} server...`);

  try {
    const containerName = getContainerName(serverId);
    const cmd = force ? `docker kill ${containerName}` : `docker stop -t 15 ${containerName}`;
    await execAsync(cmd);
    info.status = "STOPPED";
    serverStates.set(serverId, info);
    await saveState(serverId, info);
    appendLog(serverId, "[Rubber] Server stopped.");
    syncServerJar(serverId).catch(() => {});
    return { success: true };
  } catch (err: any) {
    console.error(`[ServerManager] Failed to stop server ${serverId}:`, err);
    info.status = "CRASHED";
    serverStates.set(serverId, info);
    await saveState(serverId, info);
    return { success: false, error: err.message };
  }
}

export async function restartServer(serverId: string): Promise<{ success: boolean; error?: string }> {
  appendLog(serverId, "[Rubber] Restarting...");
  const stop = await stopServer(serverId);
  if (!stop.success) return stop;
  await new Promise(r => setTimeout(r, 1500));
  return startServer(serverId);
}

export async function deleteServer(serverId: string): Promise<{ success: boolean; error?: string }> {
  console.log(`[ServerManager] DELETE server ${serverId}`);
  await stopServer(serverId, true).catch(() => {});
  const containerName = getContainerName(serverId);
  try {
    await execAsync(`docker rm -f ${containerName}`);
  } catch {}
  
  const dir = getServerDir(serverId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {}

  serverStates.delete(serverId);
  consoleLogs.delete(serverId);
  try {
    await fs.unlink(getServerStateFile(serverId));
  } catch {}
  return { success: true };
}

export async function sendCommand(serverId: string, command: string): Promise<{ success: boolean; error?: string }> {
  const containerName = getContainerName(serverId);
  appendLog(serverId, `> ${command}`);

  const running = await containerRunning(containerName);
  if (!running) {
    appendLog(serverId, "[Rubber] Cannot execute command: Server instance is offline.");
    return { success: true };
  }

  // Sanitize: strip any leading slash — Minecraft server console does NOT use /command syntax
  const cleanCmd = command.startsWith("/") ? command.slice(1) : command;
  const escapedCmd = cleanCmd.replace(/'/g, "'\\''");

  // Strategy 1: Native console pipe (/tmp/console.in)
  try {
    await execAsync(`docker exec ${containerName} sh -c "echo '${escapedCmd}' > /tmp/console.in"`);
    return { success: true };
  } catch {}

  // Strategy 2: Direct process stdin fd/0
  try {
    await execAsync(`docker exec ${containerName} sh -c "echo '${escapedCmd}' > /proc/1/fd/0"`);
    return { success: true };
  } catch {}

  // Strategy 3: mc-send-to-console wrapper (legacy itzg containers)
  try {
    await execAsync(`docker exec ${containerName} mc-send-to-console '${escapedCmd}'`);
    return { success: true };
  } catch {}

  // Strategy 4: Legacy itzg pipe (safe -p check)
  try {
    const pipeCmd = `docker exec ${containerName} sh -c "if [ -p /tmp/minecraft-console-in ]; then echo '${escapedCmd}' > /tmp/minecraft-console-in; else exit 1; fi"`;
    await execAsync(pipeCmd);
    return { success: true };
  } catch {}

  // Strategy 5: rcon-cli (if user explicitly enabled RCON)
  try {
    await execAsync(`docker exec ${containerName} rcon-cli '${escapedCmd}'`);
    return { success: true };
  } catch (err: any) {
    appendLog(serverId, `[Rubber] Server console is not ready yet.`);
    return { success: false, error: err.message };
  }
}

export const sendConsoleCommand = sendCommand;
export const sendServerCommand = sendCommand;

export async function deleteContainer(serverId: string): Promise<void> {
  const containerName = getContainerName(serverId);
  try {
    await execAsync(`docker rm -f ${containerName}`);
  } catch {}
}

export async function calculateServerDiskBytes(serverId: string): Promise<number> {
  const dir = getServerDir(serverId);
  async function getDirSize(p: string): Promise<number> {
    let total = 0;
    try {
      const entries = await fs.readdir(p, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(p, entry.name);
        if (entry.isDirectory()) {
          total += await getDirSize(full);
        } else if (entry.isFile()) {
          const s = await fs.stat(full);
          total += s.size;
        }
      }
    } catch {}
    return total;
  }
  return getDirSize(dir);
}

interface CachedDockerStats {
  cpuUsage: number;
  ramUsageMb: number;
  ramLimitMb: number;
  ramPercent: number;
  netRx: string;
  netTx: string;
  fetchedAt: number;
}

const statsCache = new Map<string, CachedDockerStats>();

export async function fetchLiveDockerStats(containerName: string, fallbackRamLimit = 1024): Promise<CachedDockerStats> {
  const cached = statsCache.get(containerName);
  const now = Date.now();
  if (cached && (now - cached.fetchedAt) < 1200) {
    return cached;
  }

  let cpuUsage = 0;
  let ramUsageMb = 0;
  let ramLimitMb = fallbackRamLimit;
  let ramPercent = 0;
  let netRx = "0 B";
  let netTx = "0 B";

  try {
    const { stdout } = await execAsync(`docker stats --no-stream --format "{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" ${containerName}`);
    const parts = stdout.trim().split("\t");
    if (parts.length >= 2) {
      // 1. CPU
      cpuUsage = parseFloat(parts[0].replace("%", "").trim()) || 0;

      // 2. Memory (e.g. "450.2MiB / 2.000GiB" or "1.23GiB / 4GiB")
      const memParts = parts[1].split("/");
      if (memParts.length >= 2) {
        const usedStr = memParts[0].trim().toLowerCase();
        const limStr = memParts[1].trim().toLowerCase();

        if (usedStr.endsWith("gib")) ramUsageMb = Math.round(parseFloat(usedStr) * 1024);
        else if (usedStr.endsWith("mib")) ramUsageMb = Math.round(parseFloat(usedStr));
        else if (usedStr.endsWith("kib") || usedStr.endsWith("kb")) ramUsageMb = Math.round(parseFloat(usedStr) / 1024);
        else if (usedStr.endsWith("b")) ramUsageMb = Math.round(parseFloat(usedStr) / (1024 * 1024));

        if (limStr.endsWith("gib")) ramLimitMb = Math.round(parseFloat(limStr) * 1024);
        else if (limStr.endsWith("mib")) ramLimitMb = Math.round(parseFloat(limStr));

        if (ramLimitMb > 0) {
          ramPercent = parseFloat(((ramUsageMb / ramLimitMb) * 100).toFixed(1));
        }
      }

      // 3. Net I/O (e.g. "1.2MB / 5.4MB")
      if (parts[2] && parts[2].includes("/")) {
        const [rx, tx] = parts[2].split("/").map(s => s.trim());
        netRx = rx || "0 B";
        netTx = tx || "0 B";
      }
    }
  } catch {}

  const result: CachedDockerStats = {
    cpuUsage,
    ramUsageMb,
    ramLimitMb,
    ramPercent,
    netRx,
    netTx,
    fetchedAt: now,
  };
  statsCache.set(containerName, result);
  return result;
}

export async function getServerStatus(serverId: string): Promise<ServerInfo | undefined> {
  const dir = getServerDir(serverId);
  let state = await getOrLoadServerState(serverId);
  if (!state) {
    return undefined;
  }

  const { isWakeProxyRunning } = await import("./cryo-sleep-proxy");
  const isSleeping = isWakeProxyRunning(serverId);

  // Ensure port is defined from server.properties or environment if missing
  if (!state.port) {
    try {
      const props = await fs.readFile(path.join(dir, "server.properties"), "utf-8");
      const m = props.match(/server-port=(\d+)/);
      if (m) state.port = parseInt(m[1]);
    } catch {}
  }

  const containerName = getContainerName(serverId);
  const isRunning = await containerRunning(containerName);

  if (isRunning) {
    state.status = "RUNNING";
    state.isCryoSleeping = false;
    serverStates.set(serverId, state);
  } else if (isSleeping) {
    state.status = "SLEEPING";
    state.isCryoSleeping = true;
    serverStates.set(serverId, state);
  } else if (state.status === "RUNNING") {
    state.status = "STOPPED";
    serverStates.set(serverId, state);
  }

  let cpuUsage = 0;
  let ramUsageMb = 0;
  let ramPercent = 0;
  let netRx = "0 B";
  let netTx = "0 B";

  if (isRunning) {
    const live = await fetchLiveDockerStats(containerName, state.ram || 1024);
    cpuUsage = live.cpuUsage;
    ramUsageMb = live.ramUsageMb;
    ramPercent = live.ramPercent;
    netRx = live.netRx;
    netTx = live.netTx;
  }

  try {
    const diskBytes = await calculateServerDiskBytes(serverId);
    const diskUsedMb = Math.round(diskBytes / (1024 * 1024));
    return {
      ...state,
      cpuUsage,
      ramUsageMb,
      ramPercent,
      netRx,
      netTx,
      diskUsedBytes: diskBytes,
      diskUsedMb,
      isCryoSleeping: isSleeping,
      status: state.status,
    };
  } catch {
    return {
      ...state,
      cpuUsage,
      ramUsageMb,
      ramPercent,
      netRx,
      netTx,
      isCryoSleeping: isSleeping,
      status: state.status,
    };
  }
}

export async function getServerLiveStats(serverId: string) {
  const status = await getServerStatus(serverId);
  if (!status) return null;

  const diskLimitMb = status.disk || 10240;
  const diskUsedMb = status.diskUsedMb || 0;
  const diskPercent = diskLimitMb > 0 ? parseFloat(((diskUsedMb / diskLimitMb) * 100).toFixed(1)) : 0;

  return {
    id: serverId,
    name: status.name,
    status: status.status,
    isCryoSleeping: status.isCryoSleeping || false,
    cpuUsage: status.cpuUsage || 0,
    cpuLimit: status.cpu || 100,
    ramUsageMb: status.ramUsageMb || 0,
    ramLimitMb: status.ram || 1024,
    ramPercent: status.ramPercent || 0,
    diskUsedMb,
    diskLimitMb,
    diskPercent,
    netRx: status.netRx || "0 B",
    netTx: status.netTx || "0 B",
    timestamp: Date.now(),
  };
}

export async function getAllServers(): Promise<ServerInfo[]> {
  if (serverStates.size === 0) {
    await reloadStatesFromDisk().catch(() => {});
  }
  const list = Array.from(serverStates.values());
  return Promise.all(
    list.map(async (s) => {
      try {
        const isRunning = await containerRunning(getContainerName(s.id));
        if (isRunning) {
          s.status = "RUNNING";
          s.isCryoSleeping = false;
        }
        const diskBytes = await calculateServerDiskBytes(s.id);
        return {
          ...s,
          diskUsedBytes: diskBytes,
          diskUsedMb: Math.round(diskBytes / (1024 * 1024)),
        };
      } catch {
        return s;
      }
    })
  );
}
