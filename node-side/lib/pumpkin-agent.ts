import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import https from "https";
import http from "http";

const PUMPKIN_STORAGE_DIR = path.join(process.cwd(), ".data", "software", "pumpkin");

export interface SyncPumpkinParams {
  versionId: string;
  commitSha: string;
  x64Url?: string | null;
  x64Sha256?: string | null;
  arm64Url?: string | null;
  arm64Sha256?: string | null;
  peerNodeUrls?: string[];
}

// Check local cached Pumpkin builds on this node
export async function getLocalPumpkinBuilds(): Promise<{ commitSha: string; versionId: string; path: string; sizeBytes: number }[]> {
  try {
    await fs.mkdir(PUMPKIN_STORAGE_DIR, { recursive: true });
    const entries = await fs.readdir(PUMPKIN_STORAGE_DIR, { withFileTypes: true });
    const results: { commitSha: string; versionId: string; path: string; sizeBytes: number }[] = [];

    for (const ent of entries) {
      if (ent.isDirectory()) {
        const binPath = path.join(PUMPKIN_STORAGE_DIR, ent.name, "pumpkin");
        try {
          const stat = await fs.stat(binPath);
          results.push({
            commitSha: ent.name,
            versionId: `pumpkin-nightly-${ent.name}`,
            path: binPath,
            sizeBytes: stat.size,
          });
        } catch {}
      }
    }
    return results;
  } catch {
    return [];
  }
}

// Download file with redirect handling, atomic temp-file write, and SHA-256 verification
function downloadFile(url: string, destPath: string, expectedSha256?: string | null): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const tempPath = `${destPath}.dl.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`;
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const request = client.get(url, {
      headers: {
        "User-Agent": "RubberPanel-NodeAgent/2.0",
        "Accept": "application/octet-stream",
      },
    }, (response) => {
      // Follow HTTP 301/302 redirects
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, destPath, expectedSha256)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`Download failed with status ${response.statusCode}`));
      }

      const fileStream = fsSync.createWriteStream(tempPath);
      const hash = crypto.createHash("sha256");

      response.on("data", (chunk) => {
        hash.update(chunk);
        fileStream.write(chunk);
      });

      response.on("end", () => {
        fileStream.end();
      });

      // Wait for underlying file descriptor to fully close to prevent "text file busy" (ETXTBUSY)
      fileStream.on("close", () => {
        try {
          const calculatedHash = hash.digest("hex").toLowerCase();
          if (expectedSha256 && expectedSha256.trim()) {
            const cleanExpected = expectedSha256.trim().toLowerCase();
            if (calculatedHash !== cleanExpected) {
              try { fsSync.unlinkSync(tempPath); } catch {}
              return reject(new Error(`SHA-256 checksum mismatch: expected ${cleanExpected}, got ${calculatedHash}`));
            }
          }
          // Set executable permissions on temp file before atomic rename
          fsSync.chmodSync(tempPath, 0o755);
          // Atomic rename replaces the target file cleanly
          fsSync.renameSync(tempPath, destPath);
          console.log(`[PumpkinAgent] Verified & installed ${path.basename(destPath)} (${calculatedHash.slice(0, 12)}...)`);
          resolve(true);
        } catch (postErr) {
          try { fsSync.unlinkSync(tempPath); } catch {}
          reject(postErr);
        }
      });

      fileStream.on("error", (err) => {
        fileStream.destroy();
        try { fsSync.unlinkSync(tempPath); } catch {}
        reject(err);
      });

      response.on("error", (err) => {
        fileStream.destroy();
        try { fsSync.unlinkSync(tempPath); } catch {}
        reject(err);
      });
    });

    request.on("error", (err) => {
      reject(err);
    });
  });
}

// Global in-memory lock to prevent multiple concurrent downloads writing to the same binary
const activeDownloads = new Map<string, Promise<{ success: boolean; path: string; error?: string }>>();

// Download and install Pumpkin binary onto this node
export async function installPumpkinBinaryOnNode(params: SyncPumpkinParams): Promise<{ success: boolean; path: string; error?: string }> {
  const commit = (params.commitSha || "nightly").trim() || "nightly";

  if (activeDownloads.has(commit)) {
    return activeDownloads.get(commit)!;
  }

  const downloadPromise = (async () => {
    const targetDir = path.join(PUMPKIN_STORAGE_DIR, commit);
    const targetBin = path.join(targetDir, "pumpkin");

    // Clean up any corrupt directory created by Docker or failed runs
    try {
      if (fsSync.existsSync(targetBin) && fsSync.statSync(targetBin).isDirectory()) {
        fsSync.rmSync(targetBin, { recursive: true, force: true });
      }
    } catch {}

    try {
      if (fsSync.existsSync("/usr/local/bin/pumpkin") && fsSync.statSync("/usr/local/bin/pumpkin").isDirectory()) {
        fsSync.rmSync("/usr/local/bin/pumpkin", { recursive: true, force: true });
      }
    } catch {}

    // If targetBin already exists and is a valid binary (> 1MB), return success immediately
    try {
      const stat = await fs.stat(targetBin);
      if (!stat.isDirectory() && stat.size > 1000000) {
        await fs.chmod(targetBin, 0o755).catch(() => {});
        return { success: true, path: targetBin };
      }
    } catch {}

    await fs.mkdir(targetDir, { recursive: true });

    // Determine architecture: x64 vs arm64 (glibc Linux)
    const isArm = process.arch === "arm64";
    const archName = isArm ? "ARM64" : "X64";
    const preferredUrl = isArm ? (params.arm64Url || params.x64Url) : (params.x64Url || params.arm64Url);
    const expectedHash = isArm ? (params.arm64Sha256 || params.x64Sha256) : (params.x64Sha256 || params.arm64Sha256);

    // Candidate download URLs in priority order
    const candidateUrls: string[] = [];
    if (preferredUrl) candidateUrls.push(preferredUrl);
    candidateUrls.push(`https://github.com/Pumpkin-MC/Pumpkin/releases/download/nightly/pumpkin-${archName}-Linux`);
    candidateUrls.push(`https://github.com/Pumpkin-MC/Pumpkin/releases/download/nightly/pumpkin-${archName}-Linux-musl`);

    let downloaded = false;

    // 1. Try downloading directly from GitHub Release Assets
    for (const dlUrl of candidateUrls) {
      try {
        console.log(`[PumpkinAgent] Downloading Pumpkin (${commit}) for ${archName} from ${dlUrl}...`);
        await downloadFile(dlUrl, targetBin, expectedHash);
        const downloadedStat = await fs.stat(targetBin);
        if (downloadedStat.size > 1000000) {
          downloaded = true;
          break;
        }
      } catch (err: any) {
        console.warn(`[PumpkinAgent] Download from ${dlUrl} failed:`, err?.message);
        try { fsSync.unlinkSync(targetBin); } catch {}
      }
    }

    // 2. If GitHub asset failed or is expired/replaced, try downloading from peer nodes
    if (!downloaded && params.peerNodeUrls && params.peerNodeUrls.length > 0) {
      for (const peer of params.peerNodeUrls) {
        try {
          const peerUrl = `${peer.replace(/\/$/, "")}/api/agent/software/pumpkin/binary?commit=${commit}`;
          console.log(`[PumpkinAgent] Attempting peer node download from ${peerUrl}...`);
          await downloadFile(peerUrl, targetBin, expectedHash);
          const downloadedStat = await fs.stat(targetBin);
          if (downloadedStat.size > 1000000) {
            downloaded = true;
            break;
          }
        } catch (pErr: any) {
          console.warn(`[PumpkinAgent] Peer sync from ${peer} failed:`, pErr?.message);
          try { fsSync.unlinkSync(targetBin); } catch {}
        }
      }
    }

    if (!downloaded) {
      return { success: false, path: "", error: "Failed to download Pumpkin binary from GitHub assets and peer nodes." };
    }

    // Set executable permission (chmod 755)
    await fs.chmod(targetBin, 0o755).catch(() => {});

    return { success: true, path: targetBin };
  })();

  activeDownloads.set(commit, downloadPromise);
  try {
    return await downloadPromise;
  } finally {
    activeDownloads.delete(commit);
  }
}

// Generate or update Pumpkin's config.toml and configuration.toml with exact allocated Java & Bedrock ports
export async function ensurePumpkinConfiguration(serverDir: string, javaPort: number, bedrockPort: number) {
  const configNames = ["config.toml", "configuration.toml", "Pumpkin.toml"];
  
  const generateInitialPumpkinToml = (jPort: number, bPort: number) => `# ─── PUMPKIN MINECRAFT CONFIGURATION (RUBBER PANEL) ───
seed = "1789633435863525713"
default_difficulty = "Normal"
op_permission_level = 4
allow_nether = true
allow_end = true
hardcore = false
tps = 20.0
default_gamemode = "Survival"
force_gamemode = false
scrub_ips = true
use_favicon = true
default_level_name = "world"
allow_chat_reports = false
white_list = false
enforce_whitelist = false

[logging]
enabled = true
threads = true
color = true
timestamp = true
file = "latest.log"

[resource_pack.java]
enabled = false
url = ""
sha1 = ""
prompt_message = ""
force = false

[resource_pack.bedrock]
enabled = false
force = false
packs = []

[world]
lighting = "default"
autosave_ticks = 0

[world.chunk]
type = "anvil"
write_in_place = false

[world.chunk.compression]
algorithm = "LZ4"
level = 6

[networking.query]
enabled = false
address = "0.0.0.0:${jPort}"

[networking.rcon]
enabled = false
address = "0.0.0.0:25575"
password = ""
max_connections = 10

[networking.rcon.logging]
logged_successfully = true
wrong_password = true
commands = true
quit = true

[networking.proxy]
enabled = false

[networking.proxy.velocity]
enabled = false
secret = ""

[networking.proxy.bungeecord]
enabled = false
secret = ""

[networking.lan_broadcast]
enabled = false

[networking.java]
enabled = true
address = "0.0.0.0:${jPort}"
encryption = true
online_mode = false
max_players = 1000
view_distance = 16
simulation_distance = 10
keep_alive_time = 15
motd = "A blazingly fast Pumpkin server powered by Rubber Panel!"

[networking.java.compression]
enabled = true
threshold = 256
level = 4

[networking.java.authentication]
enabled = true
fallbacks = []
profile_by_name_fallbacks = []
profile_by_uuid_fallbacks = []
connect_timeout = 5000
read_timeout = 5000
prevent_proxy_connections = false

[networking.java.authentication.player_profile]
allow_banned_players = false
allowed_actions = ["FORCED_NAME_CHANGE", "USING_BANNED_SKIN"]

[networking.java.authentication.textures]
enabled = true
allowed_url_schemes = ["http", "https"]
allowed_url_domains = [".minecraft.net", ".mojang.com"]

[networking.java.authentication.textures.types]
skin = true
cape = true
elytra = true

[networking.java.packet_limiter]
enabled = true
max_packet_rate = 500.0
burst_capacity = 500.0
kick_message = "Kicked for spamming packets"

[networking.bedrock]
enabled = true
online_mode = false
max_players = 1000
view_distance = 16
simulation_distance = 10
motd = "A blazingly fast Pumpkin server powered by Rubber Panel!"
chunk_caching = true

[networking.bedrock.compression]
enabled = true
threshold = 256
level = 4

[networking.bedrock.authentication]
enabled = true
connect_timeout = 5000
read_timeout = 5000

[networking.bedrock.nethernet]
enabled = true
address = "0.0.0.0:${bPort}"
identity_key = "nethernet-key.der"
stun_servers = []

[networking.bedrock.packet_limiter]
enabled = true
max_packet_rate = 500.0
burst_capacity = 500.0
kick_message = "Kicked for spamming packets"

[commands]
use_console = true
use_tty = true
log_console = true
broadcast_console_to_ops = true
default_op_level = 0

[commands.overrides]

[chat]
format = "<{DISPLAYNAME}> {MESSAGE}"

[chat.anti_spam]
enabled = true
spam_threshold = 200
message_cost = 20
decay_per_tick = 1
ops_bypass = true

[pvp]
enabled = true
hurt_animation = true
protect_creative = true
knockback = true
swing = true

[server_links]
enabled = true
bug_report = "https://github.com/Pumpkin-MC/Pumpkin/issues"
support = ""
status = ""
feedback = ""
community = ""
website = ""
forums = ""
news = ""
announcements = ""

[server_links.custom]

[player_data]
save_player_data = true
save_player_cron_interval = 300

[fun]
april_fools = true

[recipe]
send_recipes = true

[plugins]
enabled = true
hot_reload = false
ask_permission_confirmation = true
allow_unsigned = true
allowed_permissions = []
blocked_permissions = []
inherit_env = false
loopback_only = false
verify_signatures = true

[plugins.overrides]

[advancement]
save_advancements = true
`;

  // Ensure config/ directory exists for native Pumpkin engine discovery
  const configSubDir = path.join(serverDir, "config");
  await fs.mkdir(configSubDir, { recursive: true }).catch(() => {});

  const configFilesToSync = [
    path.join(configSubDir, "configuration.toml"), // Official Pumpkin standard path
    path.join(configSubDir, "config.toml"),
    path.join(configSubDir, "Pumpkin.toml"),
    path.join(serverDir, "configuration.toml"),
    path.join(serverDir, "config.toml"),
    path.join(serverDir, "Pumpkin.toml"),
  ];

  for (const configPath of configFilesToSync) {
    let content = "";
    try {
      content = await fs.readFile(/*turbopackIgnore: true*/ configPath, "utf-8");
    } catch {
      content = "";
    }

    if (!content.trim()) {
      await fs.writeFile(/*turbopackIgnore: true*/ configPath, generateInitialPumpkinToml(javaPort, bedrockPort), "utf-8");
      console.log(`[PumpkinAgent] Generated initial config at ${configPath} (Java :${javaPort}, Bedrock :${bedrockPort})`);
    } else {
      let updated = content;

      // Update Java address
      if (updated.includes("[networking.java]")) {
        updated = updated.replace(/(\[networking\.java\][^\[]*address\s*=\s*")[^"]*(")/m, `$10.0.0.0:${javaPort}$2`);
      } else {
        updated += `\n\n[networking.java]\nenabled = true\naddress = "0.0.0.0:${javaPort}"\n`;
      }

      // Update Bedrock NetherNet address
      if (updated.includes("[networking.bedrock.nethernet]")) {
        updated = updated.replace(/(\[networking\.bedrock\.nethernet\][^\[]*address\s*=\s*")[^"]*(")/m, `$10.0.0.0:${bedrockPort}$2`);
      } else if (updated.includes("[networking.bedrock]")) {
        updated = updated.replace(/\[networking\.bedrock\][^\[]*/m, (match) => {
          return `${match}\n[networking.bedrock.nethernet]\nenabled = true\naddress = "0.0.0.0:${bedrockPort}"\n`;
        });
      } else {
        updated += `\n\n[networking.bedrock]\nenabled = true\n\n[networking.bedrock.nethernet]\nenabled = true\naddress = "0.0.0.0:${bedrockPort}"\n`;
      }

      // Ensure query port matches or disabled
      if (updated.includes("[networking.query]")) {
        updated = updated.replace(/(\[networking\.query\][^\[]*address\s*=\s*")[^"]*(")/m, `$10.0.0.0:${javaPort}$2`);
      }

      await fs.writeFile(configPath, updated, "utf-8");
      console.log(`[PumpkinAgent] Synchronized ports in ${configPath} (Java :${javaPort}, Bedrock :${bedrockPort})`);
    }
  }
}
