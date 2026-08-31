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
const TAG = "v0.1.0-beta.39.1";
const NAME = "Rubber Panel v0.1.0-beta.39.1 — Hotfix: Server 503 After State Migration & IDE Page Guard";
const BODY = `## Hotfix: v0.1.0-beta.39.1

### 🔧 Critical Fix: 503 Service Unavailable on Server Start After v0.1.0-beta.39 Upgrade
- **Root Cause**: The state migration in v0.1.0-beta.39 (which moved \`.rp-state.json\` from inside server directories to \`.data/server-states/\`) was correctly migrating files to the new location, but **was not loading those migrated servers into the in-memory \`serverStates\` map** during startup. This caused the node daemon to return 503 "Server not found on this node" for all existing servers immediately after upgrading from beta.38.
- **Fix**: The migration loop now fully loads migrated servers into memory (including status, Cryo-Sleep registration, and log attachment), exactly the same as loading from the new state directory. Servers that were already loaded from the new directory are skipped to prevent double-loading.

### 🖥️ Fix: IDE Page Showing 404/Broken State for Non-Sandbox Servers
- Non-Code Sandbox servers navigating to \`/servers/[id]/ide\` now see a clear, helpful notice explaining the Cloud IDE is only available for Code Sandbox instances, with a direct link to the Console page instead of a broken or empty state.

---

### 🚀 Quick 1-Command Update on Your Linux VPS:

\`\`\`bash
# 1. Update Node Daemon (REQUIRED - fixes the 503 bug)
curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/install-node.sh | sudo bash

# 2. Update Panel (fixes IDE page)
curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/install-panel.sh | sudo bash
\`\`\`

> **Note**: After updating, the node daemon will automatically migrate your existing server states to the new secure location on first startup.
`;

function createZip(sourceDir, zipPath) {
  console.log(`[ZIP] Creating ${path.basename(zipPath)}...`);
  const zip = new AdmZip();
  const excludes = ["node_modules", ".next", ".data", "dev.db", "dev.db-journal", ".env", ".git", "uploads", "server-data", "servers", ".updates", "live-traffic-sim.ts"];
  function addDir(currentDir, relativePath = "") {
    for (const item of fs.readdirSync(currentDir)) {
      if (excludes.includes(item)) continue;
      const fullPath = path.join(currentDir, item);
      const relItemPath = relativePath ? `${relativePath}/${item}` : item;
      if (fs.statSync(fullPath).isDirectory()) addDir(fullPath, relItemPath);
      else zip.addFile(relItemPath, fs.readFileSync(fullPath));
    }
  }
  addDir(sourceDir);
  zip.writeZip(zipPath);
  console.log(`[ZIP] Done: ${(fs.statSync(zipPath).size / 1024 / 1024).toFixed(2)} MB`);
}

function githubRequest(endpoint, method, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint.startsWith("http") ? endpoint : `https://api.github.com${endpoint}`);
    const req = https.request(url, { method, headers: { "User-Agent": "Rubber-Panel-Publisher", Authorization: `token ${TOKEN}`, Accept: "application/vnd.github.v3+json", ...headers } }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => res.statusCode >= 200 && res.statusCode < 300 ? resolve(JSON.parse(body || "{}")) : reject(new Error(`${method} ${url} [${res.statusCode}]: ${body}`)));
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function uploadAsset(uploadUrlTemplate, assetPath) {
  return new Promise((resolve, reject) => {
    const uploadUrl = uploadUrlTemplate.replace(/\{(\?name,label)?\}/, "") + `?name=${path.basename(assetPath)}`;
    const stat = fs.statSync(assetPath);
    const req = https.request(new URL(uploadUrl), { method: "POST", headers: { "User-Agent": "Rubber-Panel-Publisher", Authorization: `token ${TOKEN}`, "Content-Type": "application/zip", "Content-Length": stat.size } }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => res.statusCode >= 200 && res.statusCode < 300 ? (console.log(`[Upload] ✓ ${path.basename(assetPath)}`), resolve()) : reject(new Error(`Upload [${res.statusCode}]: ${body}`)));
    });
    req.on("error", reject);
    fs.createReadStream(assetPath).pipe(req);
  });
}

async function main() {
  if (!TOKEN) { console.error("No GitHub token"); process.exit(1); }
  const distDir = path.join(__dirname, ".dist");
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);
  const adminZip = path.join(distDir, "admin-side.zip");
  const userZip = path.join(distDir, "user-side.zip");
  const nodeZip = path.join(distDir, "node-side.zip");
  createZip(path.join(__dirname, "admin-side"), adminZip);
  createZip(path.join(__dirname, "user-side"), userZip);
  createZip(path.join(__dirname, "node-side"), nodeZip);
  console.log(`\n[GitHub] Creating release ${TAG}...`);
  const release = await githubRequest(`/repos/${REPO}/releases`, "POST", JSON.stringify({ tag_name: TAG, target_commitish: "main", name: NAME, body: BODY, draft: false, prerelease: true }));
  console.log(`[GitHub] Release: ${release.html_url}`);
  await uploadAsset(release.upload_url, adminZip);
  await uploadAsset(release.upload_url, userZip);
  await uploadAsset(release.upload_url, nodeZip);
  console.log(`\n✅ ${TAG} PUBLISHED!\n   ${release.html_url}`);
}
main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
