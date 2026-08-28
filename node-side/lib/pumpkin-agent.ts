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

// Download file with redirect handling and SHA-256 verification
function downloadFile(url: string, destPath: string, expectedSha256?: string | null): Promise<boolean> {
  return new Promise((resolve, reject) => {
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

      const fileStream = fsSync.createWriteStream(destPath);
      const hash = crypto.createHash("sha256");

      response.on("data", (chunk) => {
        hash.update(chunk);
        fileStream.write(chunk);
      });

      response.on("end", () => {
        fileStream.end();
        fileStream.on("finish", () => {
          const calculatedHash = hash.digest("hex").toLowerCase();
          if (expectedSha256 && expectedSha256.trim()) {
            const cleanExpected = expectedSha256.trim().toLowerCase();
            if (calculatedHash !== cleanExpected) {
              try { fsSync.unlinkSync(destPath); } catch {}
              return reject(new Error(`SHA-256 checksum mismatch: expected ${cleanExpected}, got ${calculatedHash}`));
            }
          }
          console.log(`[PumpkinAgent] Verified SHA-256 for ${path.basename(destPath)} (${calculatedHash.slice(0, 12)}...)`);
          resolve(true);
        });
      });

      response.on("error", (err) => {
        fileStream.destroy();
        try { fsSync.unlinkSync(destPath); } catch {}
        reject(err);
      });
    });

    request.on("error", (err) => {
      reject(err);
    });
  });
}

// Download and install Pumpkin binary onto this node
export async function installPumpkinBinaryOnNode(params: SyncPumpkinParams): Promise<{ success: boolean; path: string; error?: string }> {
  const commit = (params.commitSha || "").trim();
  if (!commit) return { success: false, path: "", error: "Missing commitSha" };

  const targetDir = path.join(PUMPKIN_STORAGE_DIR, commit);
  const targetBin = path.join(targetDir, "pumpkin");

  // If already exists and valid, return success
  try {
    const stat = await fs.stat(targetBin);
    if (stat.size > 1000000) {
      await fs.chmod(targetBin, 0o755).catch(() => {});
      return { success: true, path: targetBin };
    }
  } catch {}

  await fs.mkdir(targetDir, { recursive: true });

  // Determine architecture: x64 vs arm64 (glibc Linux)
  const isArm = process.arch === "arm64";
  const downloadUrl = isArm ? (params.arm64Url || params.x64Url) : (params.x64Url || params.arm64Url);
  const expectedHash = isArm ? (params.arm64Sha256 || params.x64Sha256) : (params.x64Sha256 || params.arm64Sha256);

  let downloaded = false;

  // 1. Try downloading directly from GitHub Release Asset
  if (downloadUrl) {
    try {
      console.log(`[PumpkinAgent] Downloading Pumpkin (${commit}) for ${process.arch} from ${downloadUrl}...`);
      await downloadFile(downloadUrl, targetBin, expectedHash);
      downloaded = true;
    } catch (err: any) {
      console.warn(`[PumpkinAgent] GitHub download failed for ${commit}:`, err?.message);
    }
  }

  // 2. If GitHub asset failed or is expired/replaced, try downloading from peer nodes
  if (!downloaded && params.peerNodeUrls && params.peerNodeUrls.length > 0) {
    for (const peer of params.peerNodeUrls) {
      try {
        const peerUrl = `${peer.replace(/\/$/, "")}/api/agent/software/pumpkin/binary?commit=${commit}`;
        console.log(`[PumpkinAgent] Attempting peer node download from ${peerUrl}...`);
        await downloadFile(peerUrl, targetBin, expectedHash);
        downloaded = true;
        break;
      } catch (pErr: any) {
        console.warn(`[PumpkinAgent] Peer sync from ${peer} failed:`, pErr?.message);
      }
    }
  }

  if (!downloaded) {
    return { success: false, path: "", error: "Failed to download Pumpkin binary from GitHub assets and peer nodes." };
  }

  // Set executable permission (chmod 755)
  await fs.chmod(targetBin, 0o755).catch(() => {});
  return { success: true, path: targetBin };
}

// Generate or update Pumpkin's configuration.toml with exact allocated Java & Bedrock ports
export async function ensurePumpkinConfiguration(serverDir: string, javaPort: number, bedrockPort: number) {
  const configPath = path.join(serverDir, "configuration.toml");
  let content = "";

  try {
    content = await fs.readFile(configPath, "utf-8");
  } catch {
    content = "";
  }

  // If configuration does not exist, write the clean initial configuration block
  if (!content.trim()) {
    const initialConfig = `# ─── PUMPKIN MINECRAFT CONFIGURATION (RUBBER PANEL) ───
# Native multithreaded Rust Minecraft server supporting Java & Bedrock Edition

[networking.query]
enabled = false

[networking.java]
enabled = true
address = "0.0.0.0:${javaPort}"

[networking.bedrock]
enabled = true

[networking.bedrock.nethernet]
enabled = true
address = "0.0.0.0:${bedrockPort}"

[resource_pack]
enabled = false

[basic]
motd = "A Minecraft Server Powered by Rubber Panel"
max_players = 20
view_distance = 10
simulation_distance = 10
default_gamemode = "survival"
difficulty = "normal"
pvp = true
hardcore = false
allow_flight = false
online_mode = false
white_list = false
`;
    await fs.writeFile(configPath, initialConfig, "utf-8");
    return;
  }

  // If configuration exists, update the port addresses without destroying custom user settings
  let updated = content;

  // Ensure query is disabled
  if (updated.includes("[networking.query]")) {
    updated = updated.replace(/\[networking\.query\][^\[]*/m, "[networking.query]\nenabled = false\n\n");
  }

  // Update Java address
  if (updated.includes("[networking.java]")) {
    updated = updated.replace(/address\s*=\s*"[^"]*"/, `address = "0.0.0.0:${javaPort}"`);
  }

  // Update Bedrock NetherNet address
  if (updated.includes("[networking.bedrock.nethernet]")) {
    updated = updated.replace(/(\[networking\.bedrock\.nethernet\][^\[]*address\s*=\s*")[^"]*(")/m, `$10.0.0.0:${bedrockPort}$2`);
  } else if (!updated.includes("[networking.bedrock]")) {
    updated += `\n\n[networking.bedrock]\nenabled = true\n\n[networking.bedrock.nethernet]\nenabled = true\naddress = "0.0.0.0:${bedrockPort}"\n`;
  }

  await fs.writeFile(configPath, updated, "utf-8");
}
