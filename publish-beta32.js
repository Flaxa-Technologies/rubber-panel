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
const TAG = "v0.1.0-beta.32";
const NAME = "Rubber Panel v0.1.0-beta.32 — Rubber Radar: Traffic Telemetry & Abuse Mitigation";
const BODY = `## What's New in v0.1.0-beta.32

### 🛡️ Rubber Radar — Traffic Telemetry, Anomaly Detection & Abuse Mitigation

#### Node Daemon: In-Process Radar Engine
- **Sliding-Window Connection Rate Tracking**: In-memory per-IP connection counters with 10s rolling windows — automatically detects rapid reconnect loops, handshake floods, and slowloris holds.
- **Real-Time Bandwidth Telemetry**: Live RX/TX byte accumulator updated on every request via \`proxy.ts\` edge interceptor; Linux nodes additionally read \`/proc/net/dev\` for kernel-level byte counters.
- **Automatic IP Banning**: When any IP exceeds configurable threshold (default: 20 conns/10s), Radar auto-bans with \`iptables DROP\` rule injection and 403 Forbidden enforcement at the proxy layer.
- **Fleet Shield Mode**: 1-click command from Admin Control Plane doubles rate sensitivity fleet-wide (50% stricter thresholds) during active incidents.
- **Server Under Attack Mode**: Per-server 3x stricter throttle, auto-reverts after 1 hour.
- **Trusted IP Whitelist**: RFC1918 private subnets, loopback, and admin-defined IPs are permanently exempt from banning.
- **GeoIP Intelligence**: Offline country resolution via MaxMind GeoLite2 with no API calls.
- **Ban TTL & Auto-Expiry**: Default 15-minute bans with scheduled auto-unban timers.

#### Admin Control Plane: Traffic Radar Dashboard (\`/radar\`)
- **Live Fleet Metric Cards**: Fleet Connections/Sec, Inbound/Outbound Bandwidth, Active Bans, Defense State.
- **15-Minute Live Traffic Graph**: Real-time responsive SVG curve showing fleet-wide connection rate trends.
- **Active Bans Table**: Live view of quarantined IPs with GeoIP country, reason, port, expiry timer, and 1-click Unban.
- **Per-Node Fleet Breakdown**: Individual node RX/TX bandwidth per node.
- **Trusted IPs Whitelist Manager**: Add/remove trusted IPs and subnets with instant node synchronization.
- **Threshold Policy Editor**: Configure sliding-window size, ban duration, and auto-mitigation toggles.
- **Fleet Shield Mode Toggle**: Instantly push stricter rate limits to all online compute nodes.

#### User Client Portal: Per-Server Security Widget
- Live connection rate counter scoped to the user's server.
- Traffic status badge: All Clear / Elevated Traffic / Under Attack Filtering.
- Self-Service "Under Attack Mode" with 1-hour auto-revert.
- Privacy: Raw attacker IPs never exposed to non-admin users.

#### Heartbeat Sync Protocol
- Nodes report live conns/sec, bandwidth deltas, and top offenders on every 30s heartbeat.
- Admin plane pushes updated trusted IPs, threshold policies, and fleet shield commands back to all nodes.
- 24-hour automated RadarSample time-series pruning to keep database sizes minimal.

---

### 📦 Release Assets
- \`admin-side.zip\` — Admin Management Portal
- \`user-side.zip\` — User Client Portal
- \`node-side.zip\` — Node Daemon Agent

### 🚀 Installation
\`\`\`bash
# Panel
curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/install-panel.sh | sudo bash

# Node Daemon
curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/install-node.sh | sudo bash
\`\`\`

> ⚠️ **Note**: Rubber Radar handles **application-layer abuse** (handshake floods, rate abuse, slowloris). It does not stop volumetric L3/L4 floods — those require your hosting provider's DDoS mitigation.
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
