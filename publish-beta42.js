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
const TAG = "v0.1.0-beta.42";
const NAME = "Rubber Panel v0.1.0-beta.42 — Updates Auto-Discovery & Cloud IDE Fix";
const BODY = `## What's New in v0.1.0-beta.42

### 🚀 Instant Update Detection
- **Real-Time Release Polling**: Reduced update cache duration to 15s so the Admin Panel immediately displays newly available releases.
- **Accurate Release Diffing**: Admin updates page accurately fetches latest tags and provides 1-click update support.

### 🧹 UI Cleanliness & Fixes
- **Cloud IDE Removed from Minecraft**: Removed the \`</> Cloud IDE\` navigation button from Minecraft and other game server instances so it never shows 404 or causes confusion. It is now strictly limited to dedicated Code Sandbox servers.

---

### 📦 Release Assets
- \`admin-side.zip\` — Admin Management Portal
- \`user-side.zip\` — User Client Portal
- \`node-side.zip\` — Node Daemon Agent

### 🚀 Quick 1-Command Installation / Update
\`\`\`bash
# 1. Panel Installation / Update (Admin Portal :3000 & User Portal :3002)
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
        zip.addFile(relItemPath, fs.readFileSync(fullPath));
      }
    }
  }

  addDir(sourceDir);
  zip.writeZip(zipPath);
  console.log(`[ZIP] Done: ${(fs.statSync(zipPath).size / 1024 / 1024).toFixed(2)} MB`);
}

function githubRequest(endpoint, method, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint.startsWith("http") ? endpoint : `https://api.github.com${endpoint}`);
    const req = https.request(
      url,
      {
        method,
        headers: {
          "User-Agent": "Rubber-Panel-Publisher",
          Authorization: `token ${TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          ...headers,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body || "{}"));
          } else {
            reject(new Error(`${method} ${url} [${res.statusCode}]: ${body}`));
          }
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function uploadAsset(uploadUrlTemplate, assetPath) {
  return new Promise((resolve, reject) => {
    const uploadUrl = uploadUrlTemplate.replace(/\{(\?name,label)?\}/, "") + `?name=${path.basename(assetPath)}`;
    const stat = fs.statSync(assetPath);
    const req = https.request(
      new URL(uploadUrl),
      {
        method: "POST",
        headers: {
          "User-Agent": "Rubber-Panel-Publisher",
          Authorization: `token ${TOKEN}`,
          "Content-Type": "application/zip",
          "Content-Length": stat.size,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[Upload] ✓ ${path.basename(assetPath)}`);
            resolve();
          } else {
            reject(new Error(`Upload [${res.statusCode}]: ${body}`));
          }
        });
      }
    );
    req.on("error", reject);
    fs.createReadStream(assetPath).pipe(req);
  });
}

async function main() {
  if (!TOKEN) {
    console.error("FATAL: No GitHub token provided.");
    process.exit(1);
  }

  const distDir = path.join(__dirname, ".dist");
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

  const adminZip = path.join(distDir, "admin-side.zip");
  const userZip = path.join(distDir, "user-side.zip");
  const nodeZip = path.join(distDir, "node-side.zip");

  createZip(path.join(__dirname, "admin-side"), adminZip);
  createZip(path.join(__dirname, "user-side"), userZip);
  createZip(path.join(__dirname, "node-side"), nodeZip);

  console.log(`\n[GitHub] Creating release ${TAG}...`);
  const release = await githubRequest(
    `/repos/${REPO}/releases`,
    "POST",
    JSON.stringify({
      tag_name: TAG,
      target_commitish: "main",
      name: NAME,
      body: BODY,
      draft: false,
      prerelease: false,
    })
  );

  console.log(`[GitHub] Release created: ${release.html_url}`);

  await uploadAsset(release.upload_url, adminZip);
  await uploadAsset(release.upload_url, userZip);
  await uploadAsset(release.upload_url, nodeZip);

  console.log(`\n✅ ${TAG} PUBLISHED SUCCESSFULLY!\n   ${release.html_url}`);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
