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
const TAG = "v0.1.0-beta.39.2";
const NAME = "Rubber Panel v0.1.0-beta.39.2 — Fix: Cloud IDE Start Button & Balanced Docker Security";
const BODY = `## v0.1.0-beta.39.2 — Cloud IDE Start Button Fix & Balanced Docker Security

> Requires **v0.1.0-beta.39.1** or later already installed. If upgrading from beta.38 or earlier, install beta.39.1 first.

---

### 🔧 Fix: Cloud IDE "Start" Button Returns 404

- **Root Cause**: The "Start Cloud VS Code IDE" button was calling \`/api/user/servers/[id]/power\` — a route that does not exist. The correct endpoint is \`/api/user/servers/[id]\` with \`{ action: "start" }\`.
- **Fix**: Updated the IDE page to hit the correct API route. Also replaced the fire-and-forget 2s timeout with an active **auto-polling mechanism** — the spinner stays visible until the server status changes to \`RUNNING\` (up to 30s), then clears automatically.

---

### 🔐 Fix: \`sudo\` / \`apt install\` Blocked in Code Sandbox Terminal

- **Root Cause**: The previous beta.39 hardening applied \`--security-opt=no-new-privileges:true\`, \`--cap-drop=SYS_ADMIN\`, \`--cap-drop=SYS_PTRACE\`, and \`--user 1000:1000\` to code-server containers. These flags, especially \`no-new-privileges\` and the forced user context, completely prevented \`sudo\`, \`apt\`, \`pip\`, and most package managers from working.
- **Fix**: Removed over-restrictive flags. New Docker security profile:
  - ✅ \`--cap-drop=SYS_BOOT\` — prevents rebooting/shutting down the host
  - ✅ \`--cap-drop=SYS_RAWIO\` — prevents raw disk/port I/O
  - ✅ \`--cap-drop=SYS_MODULE\` — prevents loading kernel modules
  - ✅ \`--pids-limit=512\` — fork bomb protection
  - ❌ Removed: \`no-new-privileges\`, \`SYS_ADMIN\` drop, \`SYS_PTRACE\` drop, \`--user 1000:1000\`
- Users can now freely run \`sudo apt install\`, \`pip install\`, \`npm install -g\`, etc. in the Cloud IDE terminal.

---

### 🚀 Update Commands (Linux VPS):

\`\`\`bash
# Update Panel (IDE button fix)
curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/install-panel.sh | sudo bash

# Update Node Daemon (Docker security fix — required for new Code Sandbox containers)
curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/install-node.sh | sudo bash
\`\`\`

> **Note**: Existing running Code Sandbox containers are **not affected** by the security change. Only newly started containers will use the updated Docker flags. Restart your sandbox to apply the new security profile.
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
