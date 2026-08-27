import fs from "fs";
import path from "path";
import https from "https";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

let isUpdating = false;

export async function runNodeUpdate(
  version: string,
  assetUrl: string
): Promise<{ success: boolean; message: string }> {
  if (isUpdating) {
    return { success: true, message: "Update is already running in background." };
  }

  isUpdating = true;
  console.log(`[NodeUpdater] 🚀 Initiating background update to ${version}...`);

  // Launch async worker without blocking
  (async () => {
    try {
      const nodeDir = process.cwd();
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
        "servers", ".git", ".updates",
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

      // Clean temp files
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}

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
    }
  })();

  return {
    success: true,
    message: `Node update to ${version} started in background. Compiling and auto-reloading...`,
  };
}
