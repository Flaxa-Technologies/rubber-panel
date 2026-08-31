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
const TAG = "v0.1.0-beta.45";
const NAME = "Rubber Panel v0.1.0-beta.45 — Server Settings & Navigation Fixes";
const BODY = `## Rubber Panel v0.1.0-beta.45

### 🚀 Fixes & Improvements
- **Settings Page Hardening**: Resolved client-side state crash on settings page by adding type guards and default fallback strings to formatting helpers and MOTD parsing.
- **Java Runtime & Cryo-Sleep Scoping**: Gated Java version switcher and Cryo-Sleep hibernation cards strictly to Minecraft instances. Database containers and custom images no longer request Java endpoints or show Minecraft-specific configurations.
- **Java Proxy Authentication**: Fixed internal API proxying and secret matching for \`/api/user/servers/[id]/java-versions\`.
- **Dynamic Port Routing**: Fully passed \`internalPort\` through server query selects and settings configuration.
- **Client Error Boundary**: Added custom error boundary for server dashboard layouts to prevent blank crash screens.
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

function uploadAsset(uploadUrlTemplate, filePath, fileName) {
  return new Promise((resolve, reject) => {
    const uploadUrl = uploadUrlTemplate.replace(/\{.*\}/, "") + `?name=${encodeURIComponent(fileName)}`;
    const urlObj = new URL(uploadUrl);
    const fileData = fs.readFileSync(filePath);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "User-Agent": "RubberPanel-ReleaseBot",
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/zip",
        "Content-Length": fileData.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, data }));
    });
    req.on("error", reject);
    req.write(fileData);
    req.end();
  });
}

async function main() {
  console.log("=== Creating zip archives for release ===");

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
        if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git" || entry.name === "dist") {
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

  console.log(`=== Creating GitHub Release: ${TAG} ===`);
  const createRes = await ghRequest(
    {
      hostname: "api.github.com",
      path: `/repos/${REPO}/releases`,
      method: "POST",
      headers: {
        "User-Agent": "RubberPanel-ReleaseBot",
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    },
    JSON.stringify({
      tag_name: TAG,
      target_commitish: "main",
      name: NAME,
      body: BODY,
      draft: false,
      prerelease: true,
    })
  );

  let release = createRes.data;
  if (createRes.status === 422) {
    console.log("Release exists, fetching existing release...");
    const existing = await ghRequest({
      hostname: "api.github.com",
      path: `/repos/${REPO}/releases/tags/${TAG}`,
      method: "GET",
      headers: {
        "User-Agent": "RubberPanel-ReleaseBot",
        Authorization: `Bearer ${TOKEN}`,
      },
    });
    release = existing.data;
  }

  if (!release.upload_url) {
    console.error("Failed to get upload_url:", release);
    process.exit(1);
  }

  console.log(`Uploading assets to release ${release.id}...`);

  for (const asset of release.assets || []) {
    console.log(`Deleting existing asset ${asset.name} (${asset.id})...`);
    await ghRequest({
      hostname: "api.github.com",
      path: `/repos/${REPO}/releases/assets/${asset.id}`,
      method: "DELETE",
      headers: {
        "User-Agent": "RubberPanel-ReleaseBot",
        Authorization: `Bearer ${TOKEN}`,
      },
    });
  }

  console.log("Uploading admin-side.zip...");
  await uploadAsset(release.upload_url, adminZipPath, "admin-side.zip");

  console.log("Uploading user-side.zip...");
  await uploadAsset(release.upload_url, userZipPath, "user-side.zip");

  console.log("Uploading node-side.zip...");
  await uploadAsset(release.upload_url, nodeZipPath, "node-side.zip");

  console.log("=== All assets uploaded successfully! ===");
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
