const fs = require("fs");
const path = require("path");
const AdmZip = require(path.join(__dirname, "admin-side", "node_modules", "adm-zip"));
const https = require("https");
const { execSync } = require("child_process");

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
const TAG = "v0.1.0-beta.48";
const NAME = "Rubber Panel v0.1.0-beta.48 — Live Host RAM Telemetry, Dynamic Overcommit & Node Health Precision";
const BODY = `## Rubber Panel v0.1.0-beta.48

### 🚀 Highlights & Improvements
- **Accurate Live Host Memory Telemetry**: Node health status, memory gauges, and warning alerts are now driven strictly by real-time live host RAM usage on the node machine rather than theoretical server allocation limits.
- **Overcommit & Allocation Transparency**: Clear distinction between physical host RAM load and provisioned server allocations, with clean overcommit indicators.
- **False Alert Elimination**: Prevents false "OOM Crash Risk" and critical error banners when servers are stopped, idle, or hibernated in Cryo-Sleep.
- **Updated Installer & Updaters**: Version bump and alignment across all panel updaters, installers, and node daemons.

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

    req.on("timeout", () => {
      req.destroy(new Error("Request timed out"));
    });

    req.on("error", (err) => {
      reject(err);
    });

    fileStream.pipe(req);
  });
}

async function uploadAssetWithRetry(uploadUrlTemplate, filePath, fileName, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Uploading ${fileName} (Attempt ${attempt}/${retries})...`);
      const res = await uploadAssetSingle(uploadUrlTemplate, filePath, fileName);
      console.log(`✓ Uploaded ${fileName} successfully!`);
      return res;
    } catch (err) {
      console.error(`Attempt ${attempt} for ${fileName} failed: ${err.message}`);
      if (attempt === retries) throw err;
      console.log(`Waiting 3s before retrying...`);
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

async function main() {
  console.log("=== Packaging clean zip archives for release ===");

  const adminZipPath = path.join(__dirname, "admin-side.zip");
  const userZipPath = path.join(__dirname, "user-side.zip");
  const nodeZipPath = path.join(__dirname, "node-side.zip");

  const buildZip = (folder, outPath) => {
    console.log(`Packaging ${folder}...`);
    const zip = new AdmZip();
    const basePath = path.join(__dirname, folder);

    function addFiles(currentPath, zipPath) {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORED.has(entry.name)) {
          continue;
        }
        const full = path.join(currentPath, entry.name);
        const rel = zipPath ? `${zipPath}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          addFiles(full, rel);
        } else {
          zip.addLocalFile(full, zipPath || "");
        }
      }
    }

    addFiles(basePath, "");
    zip.writeZip(outPath);
    console.log(`Created ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB)`);
  };

  buildZip("admin-side", adminZipPath);
  buildZip("user-side", userZipPath);
  buildZip("node-side", nodeZipPath);

  console.log("\n=== Committing and pushing changes to Git ===");
  try {
    execSync("git add .", { stdio: "inherit" });
    execSync(`git commit -m "Release ${TAG} - Live Host RAM Telemetry, Overcommit Transparency & Health Precision"`, { stdio: "inherit" });
  } catch (e) {
    console.log("Git commit had nothing new or already committed.");
  }

  try {
    execSync("git push origin main", { stdio: "inherit" });
    console.log("Pushed main to remote.");
  } catch (e) {
    console.warn("Git push failed:", e.message);
  }

  if (!TOKEN) {
    console.error("No GH_TOKEN found. Cannot publish GitHub Release automatically.");
    return;
  }

  console.log(`\n=== Checking GitHub Release ${TAG} ===`);
  let release = null;
  const getRes = await ghRequest({
    hostname: "api.github.com",
    path: `/repos/${REPO}/releases/tags/${TAG}`,
    method: "GET",
    headers: {
      "User-Agent": "RubberPanel-ReleaseBot",
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (getRes.status === 200 && getRes.data?.upload_url) {
    release = getRes.data;
    console.log(`Release ${TAG} found (ID: ${release.id}).`);
  } else {
    console.log(`Creating Release ${TAG}...`);
    const createRes = await ghRequest(
      {
        hostname: "api.github.com",
        path: `/repos/${REPO}/releases`,
        method: "POST",
        headers: {
          "User-Agent": "RubberPanel-ReleaseBot",
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
        },
      },
      JSON.stringify({
        tag_name: TAG,
        name: NAME,
        body: BODY,
        draft: false,
        prerelease: true,
      })
    );
    release = createRes.data;
  }

  if (!release || !release.upload_url) {
    console.error("Failed to obtain release upload_url:", release);
    return;
  }

  // Check existing assets and clean up
  const existingAssets = release.assets || [];
  console.log(`Found ${existingAssets.length} existing assets on release.`);

  for (const item of [
    { name: "admin-side.zip", path: adminZipPath },
    { name: "user-side.zip", path: userZipPath },
    { name: "node-side.zip", path: nodeZipPath },
  ]) {
    const existing = existingAssets.find((a) => a.name === item.name);
    if (existing) {
      console.log(`Replacing existing asset ${item.name} (ID: ${existing.id})...`);
      await ghRequest({
        hostname: "api.github.com",
        path: `/repos/${REPO}/releases/assets/${existing.id}`,
        method: "DELETE",
        headers: {
          "User-Agent": "RubberPanel-ReleaseBot",
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/vnd.github.v3+json",
        },
      });
    }

    await uploadAssetWithRetry(release.upload_url, item.path, item.name);
  }

  console.log(`\n✅ Successfully published ${TAG} and uploaded all clean assets!`);
}

main().catch(console.error);
