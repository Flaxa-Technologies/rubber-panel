import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken, unauthorizedResponse } from "@/lib/auth";
import fs from "fs";
import path from "path";
import https from "https";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  if (!verifyAgentToken(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { assetUrl, version } = body;

    if (!assetUrl || !version) {
      return NextResponse.json({ error: "Missing assetUrl or version" }, { status: 400 });
    }

    const nodeDir = process.cwd();
    const tempDir = path.join(nodeDir, ".updates", `node-${version}`);
    const zipPath = path.join(tempDir, "node-side.zip");

    // 1. Prepare temp dir
    fs.mkdirSync(tempDir, { recursive: true });

    // 2. Download zip
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

    // 3. Extract
    const AdmZip = (await import("adm-zip")).default;
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(tempDir, true);

    const entries = fs.readdirSync(tempDir).filter((f) => f !== "node-side.zip");
    const extractedRoot =
      entries.length === 1 && fs.statSync(path.join(tempDir, entries[0])).isDirectory()
        ? path.join(tempDir, entries[0])
        : tempDir;

    // 4. Safe copy — protect data and secrets
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

    // 5. Install deps and build
    await execAsync("npm install --include=dev --prefer-offline --no-audit --no-fund", { cwd: nodeDir, timeout: 300_000 });
    await execAsync("npm run build", { cwd: nodeDir, timeout: 600_000 });

    // 6. Clean temp files
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}

    // 7. Schedule auto-restart (PM2/systemd will automatically respawn)
    setTimeout(() => {
      try {
        process.exit(0);
      } catch {}
    }, 1500);

    return NextResponse.json({
      success: true,
      message: `Node daemon updated to ${version}. Auto-restarting process...`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update node" }, { status: 500 });
  }
}
