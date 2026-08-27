import fs from "fs";
import path from "path";
import https from "https";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

let isUpdating = false;

function cleanVer(v: string): string {
  return (v || "").replace(/^v/, "").trim();
}

export async function runNodeUpdate(
  version: string,
  assetUrl: string
): Promise<{ success: boolean; message: string }> {
  const nodeDir = process.cwd();
  const lockFile = path.join(nodeDir, ".updating");

  // 1. Check current version
  let currentVer = "0.1.0-beta.16";
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(nodeDir, "package.json"), "utf8"));
    if (pkg?.version) currentVer = pkg.version;
  } catch {}

  if (cleanVer(currentVer) === cleanVer(version)) {
    console.log(`[NodeUpdater] Node is already on version ${version}. Skipping update.`);
    return { success: true, message: `Node is already at ${version}.` };
  }

  // 2. Check in-memory and disk lock
  if (isUpdating || fs.existsSync(lockFile)) {
    // Check if lock file is stale (> 10 minutes)
    try {
      const stats = fs.statSync(lockFile);
      if (Date.now() - stats.mtimeMs < 600_000) {
        return { success: true, message: "Update is already running in background." };
      }
    } catch {}
  }

  isUpdating = true;
  try { fs.writeFileSync(lockFile, JSON.stringify({ version, startedAt: new Date().toISOString() })); } catch {}
  console.log(`[NodeUpdater] 🚀 Initiating background update to ${version} (from ${currentVer})...`);

  // Launch async worker without blocking
  (async () => {
    try {
      const tempDir = path.join(nodeDir, ".updates", `node-${version}`);
      const zipPath = path.join(tempDir, "node-side.zip");

      fs.mkdirSync(tempDir, { recursive: true });

      console.log(`[NodeUpdater] [1/5] Downloading package from ${assetUrl}...`);
      await new Promise<void>((resolve, reject) => {
        function doGet(url: string) {
          https.get(url, { headers: { "User-Agent": "RubberPanel-NodeUpdater/1.0" } }, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
              doGet(res.headers.location!);
              return;
            }
            if (res.statusCode !== 200) {
              reject(new Error(`Download failed: HTTP ${res.statusCode}`));
              return;
            }
            const file = fs.createWriteStream(zipPath);
            res.pipe(file);
            file.on("finish", () => file.close(() => resolve()));
            file.on("error", (err) => { fs.unlink(zipPath, () => {}); reject(err); });
          }).on("error", reject);
        }
        doGet(assetUrl);
      });

      console.log(`[NodeUpdater] [2/5] Extracting archive...`);
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(tempDir, true);

      const entries = fs.readdirSync(tempDir).filter((f) => f !== "node-side.zip");
      const extractedRoot =
        entries.length === 1 && fs.statSync(path.join(tempDir, entries[0])).isDirectory()
          ? path.join(tempDir, entries[0])
          : tempDir;

      console.log(`[NodeUpdater] [3/5] Applying updated source files...`);
      const SKIP = new Set([
        "node_modules", ".next", ".env", ".env.local",
        "servers", ".git", ".updates", ".updating",
      ]);

      function copyDir(src: string, dest: string) {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
          if (SKIP.has(entry.name)) continue;
          const srcP = path.join(src, entry.name);
          const dstP = path.join(dest, entry.name);
          entry.isDirectory() ? copyDir(srcP, dstP) : fs.copyFileSync(srcP, dstP);
        }
      }

      copyDir(extractedRoot, nodeDir);

      console.log(`[NodeUpdater] [4/5] Compiling and building Next.js daemon...`);
      await execAsync("npm install --prefer-offline --no-audit --no-fund", { cwd: nodeDir, timeout: 300_000 });
      await execAsync("npm run build", { cwd: nodeDir, timeout: 600_000 });

      // Clean temp files & release lock
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      try { fs.unlinkSync(lockFile); } catch {}

      console.log(`[NodeUpdater] [5/5] ✓ Build complete. Reloading Rubber Node Daemon process...`);
      
      // Execute PM2 reload or respawn
      try {
        await execAsync("sudo pm2 restart rubber-node --update-env 2>/dev/null || pm2 restart rubber-node --update-env 2>/dev/null");
      } catch {
        setTimeout(() => {
          try { process.exit(0); } catch {}
        }, 1000);
      }
    } catch (err: any) {
      console.error(`[NodeUpdater] ❌ Update failed:`, err);
    } finally {
      isUpdating = false;
      try { fs.unlinkSync(lockFile); } catch {}
    }
  })();

  return {
    success: true,
    message: `Node update to ${version} started in background. Compiling and auto-reloading...`,
  };
}
