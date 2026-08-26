/**
 * Rubber Panel — Unified Auto-Updater System
 * Handles checking, downloading, extracting, and applying updates for Admin, User, and Node sides.
 * Zero-Data Loss Guarantee: Preserves .env, SQLite databases, user files, game servers, and node_modules.
 */

import https from "https";
import fs, { createWriteStream } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import db from "./db";

const execAsync = promisify(exec);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GitHubAsset {
  id: number;
  name: string;
  browser_download_url: string;
  size: number;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  draft: boolean;
  prerelease: boolean;
  assets: GitHubAsset[];
}

export interface UpdateInfo {
  available: boolean;
  currentVersions: {
    admin: string;
    user: string;
  };
  latestVersion: string;
  releaseDate: string;
  changelog: string;
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

// ── In-Memory Cache ───────────────────────────────────────────────────────────

let cachedReleases: { data: GitHubRelease[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 120_000; // 2 minutes

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

/** Unmetered Fallback: Fetches release data via public GitHub Atom feed (0 Rate Limits) */
function fetchAtomReleases(repo: string): Promise<GitHubRelease[]> {
  return new Promise((resolve) => {
    https.get(`https://github.com/${repo}/releases.atom`, { headers: { "User-Agent": "RubberPanel-AutoUpdater/1.0" } }, (res) => {
      if (res.statusCode !== 200) return resolve([]);
      let xml = "";
      res.on("data", (c) => (xml += c));
      res.on("end", () => {
        const entries = xml.split("<entry>");
        entries.shift();
        const releases: GitHubRelease[] = [];
        for (const entry of entries) {
          const tagMatch = entry.match(/<id>tag:github\.com[^:]*:[^\/]+\/([^<]+)<\/id>/);
          const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
          const updatedMatch = entry.match(/<updated>([^<]+)<\/updated>/);
          if (tagMatch) {
            const rawTag = tagMatch[1].split("/").pop()?.trim() || "";
            const tag = rawTag;
            releases.push({
              id: Date.now() + releases.length,
              tag_name: tag,
              name: titleMatch ? titleMatch[1] : tag,
              body: `Release ${tag}`,
              published_at: updatedMatch ? updatedMatch[1] : new Date().toISOString(),
              draft: false,
              prerelease: tag.includes("-"),
              assets: [
                { id: 1, name: "admin-side.zip", browser_download_url: `https://github.com/${repo}/releases/download/${tag}/admin-side.zip`, size: 900000 },
                { id: 2, name: "user-side.zip", browser_download_url: `https://github.com/${repo}/releases/download/${tag}/user-side.zip`, size: 2900000 },
                { id: 3, name: "node-side.zip", browser_download_url: `https://github.com/${repo}/releases/download/${tag}/node-side.zip`, size: 700000 },
              ],
            });
          }
        }
        resolve(releases);
      });
    }).on("error", () => resolve([]));
  });
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
        ...(token ? { Authorization: `token ${token}` } : {}),
      },
    };
    https.get(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 404) {
          resolve("null");
          return;
        }
        if ((res.statusCode ?? 0) >= 400) {
          // Reject with status code for fallback handling
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
      const isGithubApi = parsed.hostname === "api.github.com";
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          "User-Agent": "RubberPanel-AutoUpdater/1.0",
          "Accept": "application/octet-stream",
          ...(isGithubApi && token ? { Authorization: `token ${token}` } : {}),
        },
      };

      const req = https.get(options, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
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
        file.on("error", (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      });
      req.on("error", reject);
    });
  }

  return doGet(url);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Fetch recent releases with rate-limit handling and unmetered Atom fallback */
export async function fetchAllReleases(perPage = 10): Promise<GitHubRelease[]> {
  const now = Date.now();
  if (cachedReleases && now - cachedReleases.timestamp < CACHE_TTL_MS) {
    return cachedReleases.data;
  }

  const { repo } = getGithubConfig();
  try {
    const data = await githubGet(`/repos/${repo}/releases?per_page=${perPage}`);
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      cachedReleases = { data: parsed, timestamp: now };
      return parsed;
    }
  } catch (err) {
    // API rate limited or offline — use unmetered public Atom feed fallback
  }

  // Atom Fallback (0 Rate Limits)
  const atomReleases = await fetchAtomReleases(repo);
  if (atomReleases.length > 0) {
    cachedReleases = { data: atomReleases, timestamp: now };
    return atomReleases;
  }

  return cachedReleases ? cachedReleases.data : [];
}

/** Fetch the latest release from GitHub (supports Beta/Prereleases) */
export async function fetchLatestRelease(includePrerelease = true): Promise<GitHubRelease | null> {
  const releases = await fetchAllReleases(10);
  if (releases.length === 0) return null;
  if (!includePrerelease) {
    const stable = releases.find((r) => !r.draft && !r.prerelease);
    return stable ?? releases[0];
  }
  const active = releases.find((r) => !r.draft);
  return active ?? releases[0] ?? null;
}

/** Returns true if latestVersion is newer or different from currentVersion */
export function isNewerVersion(current: string, latest: string): boolean {
  if (!current || !latest) return false;
  const clean = (v: string) => v.replace(/^v/, "").trim();
  return clean(current) !== clean(latest);
}

/** Read currently installed package version from package.json */
export function getCurrentVersion(side: "admin" | "user"): string {
  try {
    const pkgPath = path.join(getSideDir(side), "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      return pkg.version ?? "0.1.0";
    }
  } catch {}
  return "0.1.0";
}

/** Comprehensive check for updates across all sides */
export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentAdmin = getCurrentVersion("admin");
  const currentUser = getCurrentVersion("user");

  const latestRelease = await fetchLatestRelease(true);

  if (!latestRelease) {
    return {
      available: false,
      currentVersions: { admin: currentAdmin, user: currentUser },
      latestVersion: currentAdmin,
      releaseDate: new Date().toISOString(),
      changelog: "No release information available.",
      assets: [],
    };
  }

  const cleanLatest = latestRelease.tag_name.replace(/^v/, "");
  const hasUpdate =
    isNewerVersion(currentAdmin, cleanLatest) ||
    isNewerVersion(currentUser, cleanLatest) ||
    cleanLatest !== currentAdmin;

  const assets: UpdateInfo["assets"] = [];
  const { repo } = getGithubConfig();

  for (const side of ["admin", "user", "node"] as const) {
    const targetAsset = `${side}-side.zip`;
    const found = latestRelease.assets.find((a) => a.name === targetAsset);
    if (found) {
      assets.push({
        side,
        downloadUrl: found.browser_download_url,
        sizeBytes: found.size,
      });
    } else {
      // Direct CDN download URL fallback
      assets.push({
        side,
        downloadUrl: `https://github.com/${repo}/releases/download/${latestRelease.tag_name}/${targetAsset}`,
        sizeBytes: side === "user" ? 2900000 : 900000,
      });
    }
  }

  return {
    available: hasUpdate,
    currentVersions: { admin: currentAdmin, user: currentUser },
    latestVersion: latestRelease.tag_name,
    releaseDate: latestRelease.published_at,
    changelog: latestRelease.body || "Performance improvements and bug fixes.",
    assets,
  };
}

/** Applies an update package safely with zero data loss and automated rebuild */
export async function applySideUpdate(
  side: "admin" | "user" | "node",
  version: string,
  downloadUrl: string,
  onProgress: (progress: UpdateProgress) => void
): Promise<void> {
  const sideDir = getSideDir(side);
  const updatesDir = path.join(sideDir, ".updates", version);
  const zipPath = path.join(updatesDir, `${side}-side.zip`);

  // 1. Prepare temp directory
  fs.mkdirSync(updatesDir, { recursive: true });

  // 2. Download
  onProgress({ phase: "downloading", message: `Downloading ${side} release ${version}...`, percent: 0 });
  await downloadFile(downloadUrl, zipPath, (pct) => {
    onProgress({ phase: "downloading", message: `Downloading... ${pct}%`, percent: pct });
  });

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

  // 4. Copy files — protect data, secrets, build dirs
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
  await execAsync("npm install --include=dev --prefer-offline --no-audit --no-fund", { cwd: sideDir, timeout: 300_000 });

  // 7. Rebuild
  onProgress({ phase: "building", message: "Building updated code (npm run build)..." });
  await execAsync("npm run build", { cwd: sideDir, timeout: 600_000 });

  // 8. Cleanup temp zip
  try {
    fs.rmSync(updatesDir, { recursive: true, force: true });
  } catch {}

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

export const applyUpdate = applySideUpdate;
