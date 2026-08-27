import fs from "fs/promises";
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
  ram: number;
  cpu: number;
  disk?: number;
  cpuUsage?: number;
  ramUsageMb?: number;
  diskUsedBytes?: number;
  diskUsedMb?: number;
  uptime?: number;
  environment?: Record<string, string>;
  startupCommand?: string;
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
  softwareVersion?: string;
  startupCommand?: string;
  environment?: Record<string, string>;
}

// In-memory state — populated from disk on startup
const serverStates = new Map<string, ServerInfo>();

// ─── CONSOLE LOG RING BUFFER ───────────────────────────────────────────────
const MAX_LOG_LINES = 1000;
const consoleLogs = new Map<string, string[]>();

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

function getServerDir(serverId: string): string {
  return path.join(process.cwd(), ".data", "servers", serverId);
}

function resolveSecurePath(serverId: string, reqPath: string): string {
  const baseDir = getServerDir(serverId);
  const normalizedPath = path.normalize(path.join(baseDir, reqPath || "/"));
  if (!normalizedPath.startsWith(baseDir)) {
    throw new Error("Directory traversal detected");
  }
  return normalizedPath;
}

const HIDDEN_PANEL_FILES = new Set([".rp-state.json", ".rp-lock"]);

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

export async function listFiles(serverId: string, dirPath: string) {
  // Sync server.jar if a version jar was downloaded
  await syncServerJar(serverId);

  const target = resolveSecurePath(serverId, dirPath);
  try {
    const entries = await fs.readdir(target, { withFileTypes: true });
    const result = [];
    for (const entry of entries) {
      if (HIDDEN_PANEL_FILES.has(entry.name)) continue;
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
  const target = resolveSecurePath(serverId, filePath);
  return fs.readFile(target, "utf-8");
}

export async function writeFileContent(serverId: string, filePath: string, content: string) {
  const target = resolveSecurePath(serverId, filePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf-8");
}

export async function uploadFile(serverId: string, filePath: string, base64Content: string) {
  const target = resolveSecurePath(serverId, filePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const buffer = Buffer.from(base64Content, "base64");
  await fs.writeFile(target, buffer);
}

export async function unzipFile(serverId: string, filePath: string, destDir?: string) {
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

function attachLogs(serverId: string) {
  const containerName = getContainerName(serverId);
  const child = spawn("docker", ["logs", "-f", "--tail", "100", containerName], { stdio: ["ignore", "pipe", "pipe"] });

  function onLine(data: Buffer) {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) {
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
  }

  child.stdout.on("data", onLine);
  child.stderr.on("data", onLine);

  child.on("close", () => {
    appendLog(serverId, "[Console] Log stream ended.");
    syncServerJar(serverId).catch(() => {});
  });

  return child;
}

// ─── PERSIST STATE TO DISK ────────────────────────────────────────────────

async function saveState(serverId: string, info: ServerInfo) {
  const stateFile = path.join(getServerDir(serverId), ".rp-state.json");
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(info, null, 2), "utf-8");
}

export async function reloadStatesFromDisk() {
  const serversDir = path.join(process.cwd(), ".data", "servers");
  try {
    const dirs = await fs.readdir(serversDir, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const stateFile = path.join(serversDir, d.name, ".rp-state.json");
      try {
        const raw = await fs.readFile(stateFile, "utf-8");
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

        // 💤 On node startup/restart: If Cryo-Sleep is enabled and container is not actively running,
        // immediately auto-arm the lightweight wake proxy on the assigned port (0% RAM mode)
        if (isCryoEnabled && !running) {
          hibernateServer(info.id, "Node boot auto-arm").catch((err) => {
            console.warn(`[Cryo-Sleep] Boot auto-arm notice for ${info.id}:`, err.message);
          });
        }
      } catch {
        // No state file
      }
    }
    console.log(`[ServerManager] Reloaded ${serverStates.size} server states from disk`);
  } catch {
    // No dir
  }
}

// ─── DOCKER LIFECYCLE ────────────────────────────────────────────────────

function detectRuntime(sType: string, dImage: string) {
  const t = (sType || "").toUpperCase();
  const img = (dImage || "").toLowerCase();

  const isNodeJs = t === "NODEJS" || img.startsWith("node:") || img.includes("bun") || img.includes("deno");
  const isPython = t === "PYTHON" || img.startsWith("python:") || img.includes("pytorch");
  const isRust = t === "RUST" || img.startsWith("rust:") || img.includes("rustlang");
  const isPhp = t === "PHP" || img.startsWith("php:") || img.includes("php");
  const isGo = t === "GO" || t === "GOLANG" || img.startsWith("golang:");
  const isRuby = t === "RUBY" || img.startsWith("ruby:");
  const isWeb = t === "WEB" || img.includes("nginx") || img.includes("caddy") || img.includes("httpd") || img.includes("traefik");
  const isDatabase = t === "DATABASE" || t === "MYSQL" || t === "POSTGRES" || t === "REDIS" || t === "MONGO" ||
    img.includes("mysql") || img.includes("postgres") || img.includes("redis") || img.includes("mongo") ||
    img.includes("mariadb") || img.includes("rabbitmq") || img.includes("elastic") || img.includes("meili");
  const isGame = t === "GAME" || img.includes("steam") || img.includes("palworld") || img.includes("terraria") || img.includes("valheim");
  const isMinecraft = !isNodeJs && !isPython && !isRust && !isPhp && !isGo && !isRuby && !isWeb && !isDatabase && !isGame &&
    (t === "MINECRAFT" || t === "PAPER" || t === "PURPUR" || t === "FABRIC" || t === "FORGE" || t === "VANILLA" || t === "SPIGOT" || t === "VELOCITY" || t === "BUNGEECORD" || img.includes("minecraft"));

  let label = "Custom Container";
  if (isPhp) label = "PHP";
  else if (isPython) label = "Python";
  else if (isRust) label = "Rust";
  else if (isGo) label = "Golang";
  else if (isRuby) label = "Ruby";
  else if (isNodeJs) label = "Node.js";
  else if (isWeb) label = "Web Server";
  else if (isDatabase) label = "Database";
  else if (isGame) label = "Game Server";
  else if (isMinecraft) label = "Minecraft";

  return { isNodeJs, isPython, isRust, isPhp, isGo, isRuby, isWeb, isDatabase, isGame, isMinecraft, label };
}

export async function createServer(params: CreateServerParams): Promise<{ success: boolean; error?: string }> {
  console.log(`[ServerManager] CREATE server ${params.id} (${params.name})`);

  const dir = getServerDir(params.id);
  await fs.mkdir(dir, { recursive: true });

  const assignedPort = params.port ?? 25566;
  const env = { ...(params.environment || {}) };
  const sType = env.SERVER_TYPE || env.TYPE || "MINECRAFT";
  const dImage = env.DOCKER_IMAGE || "";

  const runtime = detectRuntime(sType, dImage);

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
  } else if (runtime.isMinecraft) {
    // Accept EULA automatically
    await fs.writeFile(path.join(dir, "eula.txt"), "eula=true\n", "utf-8");

    // Create initial server.properties
    const serverPropertiesContent = [
      "# Minecraft server properties",
      "# Auto-generated by Rubber Panel",
      `server-port=25565`,
      `query.port=25565`,
      "enable-rcon=true",
      "rcon.port=25575",
      `rcon.password=rp-${params.id.slice(0, 8)}`,
      "online-mode=false",
      "motd=A Minecraft Server powered by Rubber Panel",
      "enable-query=true",
      "eula=true",
      "",
    ].join("\n");

    await fs.writeFile(path.join(dir, "server.properties"), serverPropertiesContent, "utf-8");
  } else {
    // Generic Custom Container Image
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
    startupCommand: effectiveStartup || undefined,
    environment: env,
  };

  serverStates.set(params.id, info);
  await saveState(params.id, info);

  appendLog(params.id, `[Panel] Server "${params.name}" (${runtime.label}) provisioned on port ${assignedPort}. Press Start to initialize.`);
  return { success: true };
}

export async function startServer(serverId: string): Promise<{ success: boolean; error?: string }> {
  console.log(`[ServerManager] START server ${serverId}`);
  let info = serverStates.get(serverId);

  if (!info) {
    const stateFile = path.join(getServerDir(serverId), ".rp-state.json");
    try {
      const raw = await fs.readFile(stateFile, "utf-8");
      info = JSON.parse(raw) as ServerInfo;
      serverStates.set(serverId, info);
    } catch {
      return { success: false, error: "Server not found on this node" };
    }
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
  const sType = env.SERVER_TYPE || env.TYPE || "MINECRAFT";
  const dImageRaw = env.DOCKER_IMAGE || "";
  const runtime = detectRuntime(sType, dImageRaw);

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
  const { stopWakeProxy } = await import("./cryo-sleep-proxy");
  await stopWakeProxy(serverId).catch(() => {});

  const containerName = getContainerName(serverId);
  info.status = "STARTING";
  info.isCryoSleeping = false;
  serverStates.set(serverId, info);
  appendLog(serverId, `[Panel] Starting ${runtime.label} server container...`);

  try {
    const dir = getServerDir(serverId);
    const assignedPort = info.port ?? 25566;

    if (runtime.isMinecraft) {
      // Ensure eula.txt is in place
      await fs.writeFile(path.join(dir, "eula.txt"), "eula=true\n", "utf-8");
    }

    // Clean up any stale or exited container before starting fresh
    const isRunning = await containerRunning(containerName);
    if (isRunning) {
      appendLog(serverId, "[Panel] Container already active, attaching to output...");
      attachLogs(serverId);
      info.status = "RUNNING";
      serverStates.set(serverId, info);
      return { success: true };
    }

    const exists = await containerExists(containerName);
    if (exists) {
      appendLog(serverId, "[Panel] Removing previous container state for clean start...");
      try {
        await execAsync(`docker rm -f ${containerName}`);
      } catch {}
    }

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

      appendLog(serverId, `[Panel] Launching Node.js ${dockerImage} on host port ${assignedPort}...`);
      appendLog(serverId, `[Panel] Security Shield: ${securityEnabled ? "ACTIVE (Threat Scanner & 5-Min Quarantine)" : "DISABLED"}`);
      appendLog(serverId, `[Panel] Startup Script:  ${startCmd}`);

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
        `if [ -f package.json ] && [ ! -d node_modules ]; then echo '[Panel] Running npm install...'; npm install --production --no-audit; fi; echo '[Panel] Executing: ${startCmd}'; exec ${startCmd}`
      ];
    } else if (runtime.isPhp) {
      const dockerImage = env.DOCKER_IMAGE || "php:8.3-cli-alpine";
      const internalPort = env.INTERNAL_PORT || "8080";
      delete env.DOCKER_IMAGE;
      delete env.INTERNAL_PORT;

      const envArgs = buildEnvArgs(env);
      const startCmd = info.startupCommand?.trim() || `php -S 0.0.0.0:${internalPort} index.php`;

      appendLog(serverId, `[Panel] Launching PHP ${dockerImage} on host port ${assignedPort} (internal :${internalPort})...`);
      appendLog(serverId, `[Panel] Startup Script: ${startCmd}`);

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
        `echo '[Panel] Executing: ${startCmd}'; exec ${startCmd}`
      ];
    } else if (runtime.isPython) {
      const dockerImage = env.DOCKER_IMAGE || "python:3.12-alpine";
      const internalPort = env.INTERNAL_PORT || "8000";
      delete env.DOCKER_IMAGE;
      delete env.INTERNAL_PORT;

      const envArgs = buildEnvArgs(env);
      const startCmd = info.startupCommand?.trim() || "python -u main.py";

      appendLog(serverId, `[Panel] Launching Python ${dockerImage} on host port ${assignedPort} (internal :${internalPort})...`);
      appendLog(serverId, `[Panel] Startup Script: ${startCmd}`);

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
        "-e", "PYTHONUNBUFFERED=1",
        ...envArgs,
        dockerImage,
        "sh", "-c",
        `if [ -f requirements.txt ] && [ -s requirements.txt ]; then echo '[Panel] Installing pip packages...'; pip install --no-cache-dir -r requirements.txt; fi; echo '[Panel] Executing: ${startCmd}'; exec ${startCmd}`
      ];
    } else if (runtime.isRust) {
      const dockerImage = env.DOCKER_IMAGE || "rust:1.80-alpine";
      const internalPort = env.INTERNAL_PORT || "8080";
      delete env.DOCKER_IMAGE;
      delete env.INTERNAL_PORT;

      const envArgs = buildEnvArgs(env);
      const startCmd = info.startupCommand?.trim() || "cargo run --release";

      appendLog(serverId, `[Panel] Launching Rust ${dockerImage} on host port ${assignedPort} (internal :${internalPort})...`);
      appendLog(serverId, `[Panel] Startup Script: ${startCmd}`);

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
        `echo '[Panel] Executing: ${startCmd}'; exec ${startCmd}`
      ];
    } else if (runtime.isGo) {
      const dockerImage = env.DOCKER_IMAGE || "golang:1.23-alpine";
      const internalPort = env.INTERNAL_PORT || "8080";
      delete env.DOCKER_IMAGE;
      delete env.INTERNAL_PORT;

      const envArgs = buildEnvArgs(env);
      const startCmd = info.startupCommand?.trim() || "go run main.go";

      appendLog(serverId, `[Panel] Launching Golang ${dockerImage} on host port ${assignedPort} (internal :${internalPort})...`);
      appendLog(serverId, `[Panel] Startup Script: ${startCmd}`);

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
        `echo '[Panel] Executing: ${startCmd}'; exec ${startCmd}`
      ];
    } else if (runtime.isDatabase) {
      const dockerImage = env.DOCKER_IMAGE || "mysql:8.0";
      const internalPort = env.INTERNAL_PORT || (dockerImage.includes("postgres") ? "5432" : dockerImage.includes("redis") ? "6379" : dockerImage.includes("mongo") ? "27017" : "3306");
      delete env.DOCKER_IMAGE;
      delete env.INTERNAL_PORT;

      const envArgs = buildEnvArgs(env);
      const startCmd = info.startupCommand?.trim();

      appendLog(serverId, `[Panel] Launching Database ${dockerImage} on host port ${assignedPort} (internal :${internalPort})...`);
      if (startCmd) appendLog(serverId, `[Panel] Startup Script: ${startCmd}`);

      dockerArgs = [
        "run", "-d",
        "--name", containerName,
        "-p", `${assignedPort}:${internalPort}`,
        "-v", `${getServerDir(serverId)}:/data`,
        "-m", `${info.ram}m`,
        `--cpus=${cpuLimit}`,
        "--restart=no",
        ...envArgs,
        dockerImage,
      ];

      if (startCmd) {
        dockerArgs.push("sh", "-c", `echo '[Panel] Executing: ${startCmd}'; exec ${startCmd}`);
      }
    } else if (runtime.isMinecraft) {
      // Minecraft Server Execution
      if (!env.EULA) env.EULA = "TRUE";
      const heapRam = Math.max(256, Math.floor(info.ram * 0.85));
      const initRam = Math.max(128, Math.floor(info.ram * 0.20));
      env.MEMORY = `${heapRam}M`;
      if (!env.JVM_XX_OPTS) env.JVM_XX_OPTS = `-Xms${initRam}M`;

      const dockerImage = env.DOCKER_IMAGE || "itzg/minecraft-server";
      delete env.DOCKER_IMAGE;

      if (env.TYPE && env.TYPE !== "CUSTOM") {
        delete env.CUSTOM_SERVER;
      }

      const envArgs = buildEnvArgs(env);

      appendLog(serverId, `[Panel] Launching ${dockerImage} on host port ${assignedPort}...`);
      appendLog(serverId, `[Panel] Software: ${env.TYPE || "PAPER"} ${env.VERSION || "LATEST"}`);
      if (env.JAVA_VERSION) {
        appendLog(serverId, `[Panel] Java Runtime: Java ${env.JAVA_VERSION}`);
      }

      dockerArgs = [
        "run", "-d",
        "--name", containerName,
        "-p", `${assignedPort}:25565`,
        "--dns", "8.8.8.8",
        "--dns", "1.1.1.1",
        "-v", `${getServerDir(serverId)}:/data`,
        "-m", `${info.ram}m`,
        `--cpus=${cpuLimit}`,
        "--restart=no",
        ...envArgs,
        dockerImage,
      ];
    } else {
      // Generic Custom Container Image
      const dockerImage = env.DOCKER_IMAGE || "alpine:latest";
      const internalPort = env.INTERNAL_PORT || "8080";
      delete env.DOCKER_IMAGE;
      delete env.INTERNAL_PORT;

      const envArgs = buildEnvArgs(env);
      const startCmd = info.startupCommand?.trim();

      appendLog(serverId, `[Panel] Launching Custom Container ${dockerImage} on host port ${assignedPort} (internal :${internalPort})...`);
      if (startCmd) appendLog(serverId, `[Panel] Startup Script: ${startCmd}`);

      dockerArgs = [
        "run", "-d",
        "--name", containerName,
        "-p", `${assignedPort}:${internalPort}`,
        "-w", "/app",
        "-v", `${getServerDir(serverId)}:/app`,
        "-m", `${info.ram}m`,
        `--cpus=${cpuLimit}`,
        "--restart=no",
        ...envArgs,
        dockerImage,
      ];

      if (startCmd) {
        dockerArgs.push("sh", "-c", `echo '[Panel] Executing: ${startCmd}'; exec ${startCmd}`);
      } else if (dockerImage.includes("alpine") || dockerImage.includes("ubuntu") || dockerImage.includes("debian") || dockerImage.includes("busybox")) {
        dockerArgs.push("sh", "-c", "echo '[Panel] Interactive container active and running in background.'; tail -f /dev/null");
      }
    }

    console.log(`[ServerManager] docker ${dockerArgs.join(" ")}`);
    const { stdout } = await execAsync(`docker ${dockerArgs.map(a => JSON.stringify(a)).join(" ")}`);
    appendLog(serverId, `[Panel] Container initialized: ${stdout.trim().slice(0, 12)}`);

    // Attach log stream
    attachLogs(serverId);

    if (runtime.isMinecraft) {
      // Sync jar in background for Minecraft
      setTimeout(() => syncServerJar(serverId), 5000);
    }

    info.status = "RUNNING";
    serverStates.set(serverId, info);
    await saveState(serverId, info);
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
  const info = serverStates.get(serverId);
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
  appendLog(serverId, `[Panel] ${force ? "Force-killing" : "Stopping"} server...`);

  try {
    const containerName = getContainerName(serverId);
    const cmd = force ? `docker kill ${containerName}` : `docker stop -t 15 ${containerName}`;
    await execAsync(cmd);
    info.status = "STOPPED";
    serverStates.set(serverId, info);
    await saveState(serverId, info);
    appendLog(serverId, "[Panel] Server stopped.");
    syncServerJar(serverId).catch(() => {});
    return { success: true };
  } catch (err: any) {
    console.error(`[ServerManager] Failed to stop server ${serverId}:`, err);
    info.status = "CRASHED";
    serverStates.set(serverId, info);
    return { success: false, error: err.message };
  }
}

export async function restartServer(serverId: string): Promise<{ success: boolean; error?: string }> {
  appendLog(serverId, "[Panel] Restarting...");
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
  return { success: true };
}

export async function sendCommand(serverId: string, command: string): Promise<{ success: boolean; error?: string }> {
  const containerName = getContainerName(serverId);
  appendLog(serverId, `> ${command}`);

  const running = await containerRunning(containerName);
  if (!running) {
    appendLog(serverId, "[Panel] Cannot execute command: Server instance is offline.");
    return { success: true };
  }

  try {
    const rconPass = `rp-${serverId.slice(0, 8)}`;
    const cmd = `docker exec ${containerName} rcon-cli --password "${rconPass}" "${command}"`;
    const { stdout, stderr } = await execAsync(cmd);
    const output = (stdout || stderr).trim();
    if (output) {
      appendLog(serverId, output);
    }
    return { success: true };
  } catch {
    try {
      const escapedCmd = command.replace(/"/g, '\\"');
      await execAsync(`docker exec ${containerName} sh -c "echo '${escapedCmd}' > /tmp/minecraft-input"`);
      return { success: true };
    } catch (err: any) {
      appendLog(serverId, `[Error executing command]: ${err.message}`);
      return { success: false, error: err.message };
    }
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

export async function getServerStatus(serverId: string): Promise<ServerInfo | undefined> {
  const dir = getServerDir(serverId);
  const exists = await fs.stat(dir).then(() => true).catch(() => false);
  if (!exists && !serverStates.has(serverId)) {
    return undefined;
  }

  const { isWakeProxyRunning } = await import("./cryo-sleep-proxy");
  const isSleeping = isWakeProxyRunning(serverId);

  let state = serverStates.get(serverId);
  if (!state) {
    const stateFile = path.join(dir, ".rp-state.json");
    try {
      const raw = await fs.readFile(stateFile, "utf-8");
      state = JSON.parse(raw) as ServerInfo;
      serverStates.set(serverId, state);
    } catch {
      state = {
        id: serverId,
        name: "Minecraft Server",
        status: (isSleeping ? "SLEEPING" : "OFFLINE") as ServerStatus,
        ram: 1024,
        cpu: 100,
      };
    }
  }

  // Ensure port is defined from server.properties or environment if missing
  if (!state.port) {
    try {
      const props = await fs.readFile(path.join(dir, "server.properties"), "utf-8");
      const m = props.match(/server-port=(\d+)/);
      if (m) state.port = parseInt(m[1]);
    } catch {}
  }

  if (isSleeping) {
    state.status = "SLEEPING";
    state.isCryoSleeping = true;
  }

  try {
    const diskBytes = await calculateServerDiskBytes(serverId);
    const diskUsedMb = Math.round(diskBytes / (1024 * 1024));
    return {
      ...state,
      diskUsedBytes: diskBytes,
      diskUsedMb,
      isCryoSleeping: isSleeping,
      status: isSleeping ? "SLEEPING" : state.status,
    };
  } catch {
    return {
      ...state,
      isCryoSleeping: isSleeping,
      status: isSleeping ? "SLEEPING" : state.status,
    };
  }
}

export async function getAllServers(): Promise<ServerInfo[]> {
  const list = Array.from(serverStates.values());
  return Promise.all(
    list.map(async (s) => {
      try {
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
