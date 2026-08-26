/**
 * Rubber Panel — Auto-Updater Core Library
 * GitHub Releases API → Download → Extract → Migrate → Rebuild → Restart
 */

import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { exec } from "child_process";
import { promisify } from "util";
import { createWriteStream } from "fs";

const execAsync = promisify(exec);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  draft: boolean;
  prerelease: boolean;
  assets: {
    name: string;
    browser_download_url: string;
    size: number;
  }[];
}

export interface UpdateInfo {
  available: boolean;
  latestVersion: string;
  releaseUrl?: string;
  changelog?: string;
  publishedAt?: string;
  assets: {
    side: "admin" | "user" | "node";
    downloadUrl: string;
    sizeBytes: number;
  }[];
}

export type UpdateProgress = {
  phase: "downloading" | "extracting" | "migrating" | "building" | "done" | "error";
  message: string;
  percent?: number;
};

// ── Internal Helpers ──────────────────────────────────────────────────────────

function getGithubConfig() {
  return {
    token: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "",
    repo: process.env.GITHUB_REPO ?? "Flaxa-Technologies/rubber-panel",
  };
}

export function getProjectRoot() {
  return path.resolve(process.cwd(), "..");
}

export function getSideDir(side: "admin" | "user" | "node") {
  const root = getProjectRoot();
  const map = { admin: "admin-side", user: "user-side", node: "node-side" };
  return path.join(/*turbopackIgnore: true*/ root, map[side]);
}

function githubGet(urlPath: string): Promise<string> {
  const { token } = getGithubConfig();
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: urlPath,
      headers: {
        "User-Agent": "RubberPanel-AutoUpdater/1.0",
        "Accept": "application/vnd.github.v3+json",
        ...(token ? { "Authorization": `token ${token}` } : {}),
      },
    };
    https.get(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 404) { resolve("null"); return; }
        if ((res.statusCode ?? 0) >= 400) {
          reject(new Error(`GitHub API error ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        resolve(data);
      });
    }).on("error", reject);
  });
}

async function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  const { token } = getGithubConfig();

  function doGet(targetUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(targetUrl);
      const isGithub = parsed.hostname.includes("github");
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          "User-Agent": "RubberPanel-AutoUpdater/1.0",
          "Accept": "application/octet-stream",
          ...(isGithub && token ? { "Authorization": `token ${token}` } : {}),
        },
      };

      const req = https.get(options, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          doGet(res.headers.location!).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        const total = parseInt(res.headers["content-length"] ?? "0", 10);
        let downloaded = 0;
        const file = createWriteStream(destPath);
        res.on("data", (chunk: Buffer) => {
          downloaded += chunk.length;
          if (total > 0 && onProgress) onProgress(Math.round((downloaded / total) * 100));
        });
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
        file.on("error", (err) => { fs.unlink(destPath, () => {}); reject(err); });
      });
      req.on("error", reject);
    });
  }

  return doGet(url);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Fetch the latest release from GitHub (supports Beta/Prereleases) */
export async function fetchLatestRelease(includePrerelease = true): Promise<GitHubRelease | null> {
  const { repo } = getGithubConfig();
  if (!includePrerelease) {
    const data = await githubGet(`/repos/${repo}/releases/latest`);
    const parsed = JSON.parse(data);
    if (!parsed || parsed.message === "Not Found") return null;
    return parsed as GitHubRelease;
  }
  const releases = await fetchAllReleases(5);
  const active = releases.find((r) => !r.draft);
  return active ?? null;
}

/** Fetch recent releases */
export async function fetchAllReleases(perPage = 10): Promise<GitHubRelease[]> {
  const { repo } = getGithubConfig();
  const data = await githubGet(`/repos/${repo}/releases?per_page=${perPage}`);
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Returns true if latestVersion is newer than currentVersion (supports semver + beta/rc) */
export function isNewerVersion(current: string, latest: string): boolean {
  if (current === latest) return false;
  
  const clean = (v: string) => v.replace(/^v/, "").trim();
  const cClean = clean(current);
  const lClean = clean(latest);

  // Extract core numbers (e.g., 0.1.0 from 0.1.0-beta.1)
  const parseCore = (v: string) => {
    const [core] = v.split("-");
    return core.split(".").map((n) => parseInt(n, 10) || 0);
  };

  const [ca, cb, cc] = parseCore(cClean);
  const [la, lb, lc] = parseCore(lClean);

  if (la !== ca) return la > ca;
  if (lb !== cb) return lb > cb;
  if (lc !== cc) return lc > cc;

  // Same core version: compare prerelease tag if present
  const cHasPre = cClean.includes("-");
  const lHasPre = lClean.includes("-");

  // Core is identical: non-prerelease is newer than prerelease (1.0.0 > 1.0.0-beta)
  if (cHasPre && !lHasPre) return true;
  if (!cHasPre && lHasPre) return false;

  // Both have prereleases: compare string/number suffixes (e.g. beta.2 > beta.1)
  return lClean.localeCompare(cClean, undefined, { numeric: true }) > 0;
}

/** Read current version from package.json */
export function getCurrentVersions(): { admin: string; user: string; node: string } {
  function readVer(side: "admin" | "user" | "node") {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(getSideDir(side), "package.json"), "utf8"));
      return (pkg.version as string) ?? "0.1.0";
    } catch { return "0.1.0"; }
  }
  return { admin: readVer("admin"), user: readVer("user"), node: readVer("node") };
}

/** Compare current versions with GitHub latest release */
export async function checkForUpdates(): Promise<UpdateInfo & { currentVersions: { admin: string; user: string; node: string } }> {
  const currentVersions = getCurrentVersions();
  const release = await fetchLatestRelease(true);

  const noUpdate = {
    available: false,
    latestVersion: currentVersions.admin,
    assets: [] as UpdateInfo["assets"],
    currentVersions,
  };

  if (!release || release.draft) return noUpdate;

  const latest = release.tag_name;
  const anyNewer = (["admin", "user", "node"] as const).some(
    (s) => isNewerVersion(currentVersions[s], latest)
  );

  const ASSET_NAMES: { side: "admin" | "user" | "node"; name: string }[] = [
    { side: "admin", name: "admin-side.zip" },
    { side: "user", name: "user-side.zip" },
    { side: "node", name: "node-side.zip" },
  ];

  const assets = ASSET_NAMES.flatMap(({ side, name }) => {
    const a = release.assets.find((x) => x.name === name);
    return a ? [{ side, downloadUrl: a.browser_download_url, sizeBytes: a.size }] : [];
  });

  return {
    available: anyNewer,
    latestVersion: latest,
    releaseUrl: release.html_url,
    changelog: release.body,
    publishedAt: release.published_at,
    assets,
    currentVersions,
  };
}

/** Apply an update for one side — streams progress via callback */
export async function applyUpdate(
  side: "admin" | "user" | "node",
  assetUrl: string,
  version: string,
  onProgress: (p: UpdateProgress) => void
): Promise<void> {
  const sideDir = getSideDir(side);
  const updatesDir = path.join(getProjectRoot(), ".updates", `${side}-${version}`);
  const zipPath = path.join(updatesDir, `${side}-side.zip`);

  // 1. Prepare temp dir
  fs.mkdirSync(updatesDir, { recursive: true });

  // 2. Download zip
  onProgress({ phase: "downloading", message: `Downloading ${side}-side ${version}...`, percent: 0 });
  await downloadFile(assetUrl, zipPath, (pct) => {
    onProgress({ phase: "downloading", message: `Downloading... ${pct}%`, percent: pct });
  });
  onProgress({ phase: "downloading", message: "Download complete", percent: 100 });

  // 3. Extract
  onProgress({ phase: "extracting", message: "Extracting archive..." });
  const AdmZip = (await import("adm-zip")).default;
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(updatesDir, true);

  // Find root of extracted content
  const entries = fs.readdirSync(updatesDir).filter((f) => f !== `${side}-side.zip`);
  const extractedRoot =
    entries.length === 1 && fs.statSync(path.join(updatesDir, entries[0])).isDirectory()
      ? path.join(updatesDir, entries[0])
      : updatesDir;

  // 4. Copy files — skip data / secret / build dirs
  const SKIP = new Set([
    "node_modules", ".next", ".env", ".env.local",
    "dev.db", "dev.db-journal", ".git", ".updates",
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

  onProgress({ phase: "extracting", message: "Applying updated files..." });
  copyDir(extractedRoot, sideDir);

  // 5. DB migrations (admin only)
  if (side === "admin") {
    onProgress({ phase: "migrating", message: "Running database migrations (prisma db push)..." });
    try {
      await execAsync("npx prisma db push --accept-data-loss", { cwd: sideDir, timeout: 120_000 });
      onProgress({ phase: "migrating", message: "Database schema up-to-date." });
    } catch (err: any) {
      onProgress({ phase: "migrating", message: `DB migration note: ${String(err.message).slice(0, 160)}` });
    }
  }

  // 6. Reinstall deps
  onProgress({ phase: "building", message: "Installing dependencies..." });
  await execAsync("npm install --prefer-offline --no-audit --no-fund", { cwd: sideDir, timeout: 300_000 });

  // 7. Rebuild
  onProgress({ phase: "building", message: "Building updated code (npm run build)..." });
  await execAsync("npm run build", { cwd: sideDir, timeout: 600_000 });

  // 8. Cleanup temp zip
  try { fs.rmSync(updatesDir, { recursive: true, force: true }); } catch {}

  // 9. Done
  onProgress({ phase: "done", message: `${side} updated to ${version} successfully!` });

  // Restart admin process if admin was updated (PM2/Docker/systemd will automatically respawn)
  if (side === "admin") {
    setTimeout(() => {
      try {
        process.exit(0);
      } catch {}
    }, 2000);
  }
}
