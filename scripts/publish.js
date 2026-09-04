const fs = require("fs");
const path = require("path");
const rootDir = path.resolve(__dirname, "..");
const AdmZip = require(path.join(rootDir, "admin-side", "node_modules", "adm-zip"));
const https = require("https");
const { execSync } = require("child_process");

let TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
if (!TOKEN) {
  const envFile = path.join(rootDir, "github.env");
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, "utf-8").split("\n");
    for (const line of lines) {
      if (line.startsWith("GH_TOKEN=")) TOKEN = line.replace("GH_TOKEN=", "").trim();
      if (line.startsWith("GITHUB_TOKEN=")) TOKEN = line.replace("GITHUB_TOKEN=", "").trim();
    }
  }
}

// Read current version from admin-side/package.json
const pkgPath = path.join(rootDir, "admin-side", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
const TAG = `v${pkg.version}`;
const REPO = "Flaxa-Technologies/rubber-panel";
const NAME = `Rubber Panel ${TAG}`;
const BODY = `## Rubber Panel ${TAG}

### 🚀 Highlights
- Fixed software selection reversion issue in user panel where selecting another software reverted back to Paper after few seconds.
- Integrated official icons for Pumpkin (icon.svg), Fabric (logo.png), NeoForge, Vanilla Minecraft, and Bedrock.
- Separated Version Change into a dedicated modal so changing version does not expose or alter server software.
- Added live Server Uptime duration counter and Server ID with one-click copy button to the Console page telemetry row.
- Updated settings API to cleanly process software, version, and runtime changes with individual admin permission gating.

### 📦 Release Assets
- \`admin-side.zip\` — Admin Management Portal
- \`user-side.zip\` — User Client Portal
- \`node-side.zip\` — Node Daemon Agent

### 🚀 1-Command VPS Update
\`\`\`bash
curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/update-panel.sh | sudo bash
curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/update-node.sh | sudo bash
\`\`\`
`;

function ghRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function uploadAssetSingle(uploadUrlTemplate, filePath, fileName) {
  return new Promise((resolve, reject) => {
    const uploadUrl = uploadUrlTemplate.replace(/\{.*\}/, "") + `?name=${encodeURIComponent(fileName)}`;
    const urlObj = new URL(uploadUrl);
    const stat = fs.statSync(filePath);
    const fileStream = fs.createReadStream(filePath);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      timeout: 120000,
      headers: {
        "User-Agent": "RubberPanel-ReleaseBot",
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/zip",
        "Content-Length": stat.size,
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, data });
        } else {
          reject(new Error(`Upload failed with status ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", (err) => reject(err));
    fileStream.pipe(req);
  });
}

async function uploadAssetWithRetry(uploadUrlTemplate, filePath, fileName, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Uploading ${fileName} (Attempt ${attempt}/${retries})...`);
      await uploadAssetSingle(uploadUrlTemplate, filePath, fileName);
      console.log(`✓ Uploaded ${fileName}`);
      return;
    } catch (err) {
      console.error(`Attempt ${attempt} for ${fileName} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

const IGNORED = new Set([
  "node_modules", ".next", ".git", "dist", ".dist", ".data", "data",
  ".turbo", ".cache", "dev.db", "dev.db-journal", "dev.db-wal", "dev.db-shm",
  ".env", ".env.local", ".env.development", ".env.production", ".env.test",
  "github.env"
]);

function buildZip(folder, outPath) {
  console.log(`Packaging ${folder}...`);
  const zip = new AdmZip();
  const basePath = path.join(rootDir, folder);
  function addFiles(currentPath, zipPath) {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      if (IGNORED.has(entry.name)) continue;
      const full = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        addFiles(full, zipPath ? `${zipPath}/${entry.name}` : entry.name);
      } else {
        zip.addLocalFile(full, zipPath || "");
      }
    }
  }
  addFiles(basePath, "");
  zip.writeZip(outPath);
  console.log(`Created ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB)`);
}

async function main() {
  console.log(`=== Packaging clean zip archives for ${TAG} ===`);
  const adminZipPath = path.join(rootDir, "admin-side.zip");
  const userZipPath = path.join(rootDir, "user-side.zip");
  const nodeZipPath = path.join(rootDir, "node-side.zip");
  buildZip("admin-side", adminZipPath);
  buildZip("user-side", userZipPath);
  buildZip("node-side", nodeZipPath);

  console.log("\n=== Committing & pushing to Git ===");
  try {
    execSync("git add .", { cwd: rootDir, stdio: "inherit" });
    execSync(`git commit -m "chore: update release assets for ${TAG}"`, { cwd: rootDir, stdio: "inherit" });
  } catch { console.log("Nothing new to commit."); }
  try {
    execSync("git push origin main", { cwd: rootDir, stdio: "inherit" });
  } catch (e) { console.warn("Push failed:", e.message); }

  console.log(`\n=== Checking GitHub Release ${TAG} ===`);
  let release = null;
  const listRes = await ghRequest({ hostname: "api.github.com", path: `/repos/${REPO}/releases`, method: "GET", headers: { "User-Agent": "RubberPanel-ReleaseBot", Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github.v3+json" } });
  if (Array.isArray(listRes.data)) release = listRes.data.find((r) => r.tag_name === TAG);

  if (!release) {
    const createRes = await ghRequest(
      { hostname: "api.github.com", path: `/repos/${REPO}/releases`, method: "POST", headers: { "User-Agent": "RubberPanel-ReleaseBot", Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Accept: "application/vnd.github.v3+json" } },
      JSON.stringify({ tag_name: TAG, name: NAME, body: BODY, draft: false, prerelease: true })
    );
    if (createRes.status === 201) {
      release = createRes.data;
      console.log(`✓ Release ${TAG} created (ID: ${release.id})`);
    } else {
      throw new Error(`Failed to create release: ${JSON.stringify(createRes.data)}`);
    }
  }

  if (release.assets?.length) {
    for (const asset of release.assets) {
      if (asset.name.endsWith(".zip")) {
        await ghRequest({ hostname: "api.github.com", path: `/repos/${REPO}/releases/assets/${asset.id}`, method: "DELETE", headers: { "User-Agent": "RubberPanel-ReleaseBot", Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github.v3+json" } });
      }
    }
  }

  console.log("\n=== Uploading ZIP assets ===");
  await uploadAssetWithRetry(release.upload_url, adminZipPath, "admin-side.zip");
  await uploadAssetWithRetry(release.upload_url, userZipPath, "user-side.zip");
  await uploadAssetWithRetry(release.upload_url, nodeZipPath, "node-side.zip");

  console.log(`\n✅ Successfully published ${TAG}!\n`);
}

main().catch((err) => { console.error("Release script error:", err); process.exit(1); });
