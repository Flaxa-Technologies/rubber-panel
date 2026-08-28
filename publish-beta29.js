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
      if (line.startsWith("GH_TOKEN=")) {
        TOKEN = line.replace("GH_TOKEN=", "").trim();
      }
    }
  }
}

const REPO = "Flaxa-Technologies/rubber-panel";
const TAG = "v0.1.0-beta.29";
const NAME = "Rubber Panel v0.1.0-beta.29 — Specific Ports Priority & Deterministic Port Allocation";
const BODY = `## What's New in v0.1.0-beta.29

### 🎯 Specific Ports Allocation Fix
- **Direct Priority Resolution**: Fixed an issue where auto-assigned fallback ports (e.g. \`25566\`) were prioritized over user-specified ports (\`specificPorts\`).
- **Exact Specific Ports Ordering**: When custom ports (e.g. \`25580, 25581\`) are entered during server creation, they are immediately placed at the front of the allocated ports list in exact order:
  - Primary Java port -> \`25580\`
  - Secondary Bedrock NetherNet port -> \`25581\`
- **Non-biased Fallback Randomization**: When no specific ports are given, auto-assignment selects randomly from the free allocation pool instead of always defaulting to the lowest available port.
`;

function createZip(sourceDir, zipPath) {
  console.log(`[ZIP] Creating ${path.basename(zipPath)} from ${sourceDir}...`);
  const zip = new AdmZip();
  const excludes = [
    "node_modules",
    ".next",
    ".data",
    "dev.db",
    "dev.db-journal",
    ".env",
    ".git",
    "uploads",
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
  console.log(`[ZIP] Created ${zipPath} (${(fs.statSync(zipPath).size / 1024 / 1024).toFixed(2)} MB)`);
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
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body || "{}"));
            } catch {
              resolve(body);
            }
          } else {
            reject(new Error(`GitHub API ${method} ${url} failed [${res.statusCode}]: ${body}`));
          }
        });
      }
    );
    req.on("error", reject);
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

function uploadAsset(uploadUrlTemplate, assetPath, contentType = "application/zip") {
  return new Promise((resolve, reject) => {
    const uploadUrl = uploadUrlTemplate.replace(/\{(\?name,label)?\}/, "") + `?name=${path.basename(assetPath)}`;
    const stat = fs.statSync(assetPath);
    const stream = fs.createReadStream(assetPath);

    const url = new URL(uploadUrl);
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          "User-Agent": "Rubber-Panel-Publisher",
          Authorization: `token ${TOKEN}`,
          "Content-Type": contentType,
          "Content-Length": stat.size,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[Upload] Uploaded ${path.basename(assetPath)} successfully!`);
            resolve(JSON.parse(body || "{}"));
          } else {
            reject(new Error(`Asset upload failed [${res.statusCode}]: ${body}`));
          }
        });
      }
    );
    req.on("error", reject);
    stream.pipe(req);
  });
}

async function main() {
  const distDir = path.join(__dirname, ".dist");
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

  const adminZip = path.join(distDir, "admin-side.zip");
  const userZip = path.join(distDir, "user-side.zip");
  const nodeZip = path.join(distDir, "node-side.zip");

  createZip(path.join(__dirname, "admin-side"), adminZip);
  createZip(path.join(__dirname, "user-side"), userZip);
  createZip(path.join(__dirname, "node-side"), nodeZip);

  console.log(`[GitHub] Creating release ${TAG} for ${REPO}...`);
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

  console.log(`\n🎉 RELEASE ${TAG} PUBLISHED SUCCESSFULLY WITH ALL ASSETS!`);
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
