const fs = require("fs");
const path = require("path");
const AdmZip = require(path.join(__dirname, "admin-side", "node_modules", "adm-zip"));
const https = require("https");

let TOKEN = process.env.GH_TOKEN || "";
if (!TOKEN) {
  const envFile = path.join(__dirname, "github.env");
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, "utf-8").split("\n");
    for (const line of lines) {
      if (line.startsWith("GH_TOKEN=")) TOKEN = line.replace("GH_TOKEN=", "").trim();
      if (line.startsWith("GITHUB_TOKEN=")) TOKEN = line.replace("GITHUB_TOKEN=", "").trim();
    }
  }
}

const REPO = "Flaxa-Technologies/rubber-panel";
const TAG = "v0.1.0-beta.36";
const NAME = "Rubber Panel v0.1.0-beta.36 — Node Loopback Fallback, 3.5s Fast Timeout & PM2 Clean Update";
const BODY = `## What's New in v0.1.0-beta.36

### 🚀 Zero Lag & Instant Node Connection
- **Loopback IP Candidate Fallbacks**: Fixed \`[Heartbeat] Failed to ping admin (192.168.1.3:3000): timeout\` and \`Node OFFLINE\` by allowing admin and node daemons to fallback to \`127.0.0.1\` when hairpin NAT or LAN routing fails.
- **Fast 3.5s Non-Blocking Timeouts**: Reduced node command timeouts from 20s to 3.5s per candidate, completely eliminating long page freezes.
- **Clean PM2 Updates in Installer**: \`install-panel.sh\` and \`install-node.sh\` stop running PM2 services prior to extraction to prevent file locks, stale Turbopack caches, and \`MODULE_NOT_FOUND\` errors.

---

### 📦 Release Assets
- \`admin-side.zip\` — Admin Management Portal
- \`user-side.zip\` — User Client Portal
- \`node-side.zip\` — Node Daemon Agent

### 🚀 Quick 1-Command Installation
\`\`\`bash
# 1. Panel Installation (Admin Portal :3000 & User Portal :3002)
curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/install-panel.sh | sudo bash

# 2. Node Daemon Agent (:3001)
curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/install-node.sh | sudo bash
\`\`\`
`;

function createZip(sourceDir, zipPath) {
  console.log(`[ZIP] Creating ${path.basename(zipPath)} from ${sourceDir}...`);
  const zip = new AdmZip();
  const excludes = [
    "node_modules", ".next", ".data", "dev.db", "dev.db-journal",
    ".env", ".git", "uploads", "server-data", "servers", ".updates",
    "live-traffic-sim.ts",
  ];

  function addDir(currentDir, relativePath = "") {
    const items = fs.readdirSync(currentDir);
    for (const item of items) {
      if (excludes.includes(item)) continue;
      const fullPath = path.join(currentDir, item);
      const relItemPath = relativePath ? `${relativePath}/${item}` : item;
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        addDir(fullPath, relItemPath);
      } else {
        const fileData = fs.readFileSync(fullPath);
        zip.addFile(relItemPath, fileData);
      }
    }
  }

  addDir(sourceDir);
  zip.writeZip(zipPath);
  console.log(`[ZIP] Done: ${zipPath} (${(fs.statSync(zipPath).size / 1024 / 1024).toFixed(2)} MB)`);
}

function githubRequest(endpoint, method, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint.startsWith("http") ? endpoint : `https://api.github.com${endpoint}`);
    const req = https.request(url, {
      method,
      headers: {
        "User-Agent": "Rubber-Panel-Publisher",
        Authorization: `token ${TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        ...headers,
      },
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body || "{}")); } catch { resolve(body); }
        } else {
          reject(new Error(`GitHub API ${method} ${url} [${res.statusCode}]: ${body}`));
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function uploadAsset(uploadUrlTemplate, assetPath, contentType = "application/zip") {
  return new Promise((resolve, reject) => {
    const uploadUrl = uploadUrlTemplate.replace(/\{(\?name,label)?\}/, "") + `?name=${path.basename(assetPath)}`;
    const stat = fs.statSync(assetPath);
    const stream = fs.createReadStream(assetPath);
    const url = new URL(uploadUrl);
    const req = https.request(url, {
      method: "POST",
      headers: {
        "User-Agent": "Rubber-Panel-Publisher",
        Authorization: `token ${TOKEN}`,
        "Content-Type": contentType,
        "Content-Length": stat.size,
      },
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[Upload] ✓ ${path.basename(assetPath)}`);
          resolve(JSON.parse(body || "{}"));
        } else {
          reject(new Error(`Upload failed [${res.statusCode}]: ${body}`));
        }
      });
    });
    req.on("error", reject);
    stream.pipe(req);
  });
}

async function main() {
  if (!TOKEN) { console.error("ERROR: No GitHub token found in GH_TOKEN env or github.env"); process.exit(1); }

  const distDir = path.join(__dirname, ".dist");
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

  const adminZip = path.join(distDir, "admin-side.zip");
  const userZip = path.join(distDir, "user-side.zip");
  const nodeZip = path.join(distDir, "node-side.zip");

  createZip(path.join(__dirname, "admin-side"), adminZip);
  createZip(path.join(__dirname, "user-side"), userZip);
  createZip(path.join(__dirname, "node-side"), nodeZip);

  console.log(`\n[GitHub] Creating release ${TAG}...`);
  const release = await githubRequest(`/repos/${REPO}/releases`, "POST", JSON.stringify({
    tag_name: TAG,
    target_commitish: "main",
    name: NAME,
    body: BODY,
    draft: false,
    prerelease: true,
  }));

  console.log(`[GitHub] Release created: ${release.html_url}`);

  await uploadAsset(release.upload_url, adminZip);
  await uploadAsset(release.upload_url, userZip);
  await uploadAsset(release.upload_url, nodeZip);

  console.log(`\n✅ RELEASE ${TAG} PUBLISHED SUCCESSFULLY!`);
  console.log(`   ${release.html_url}`);
}

main().catch((err) => { console.error("FATAL:", err.message); process.exit(1); });
