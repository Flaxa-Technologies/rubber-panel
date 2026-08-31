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
const TAG = "v0.1.0-beta.47";
const NAME = "Rubber Panel v0.1.0-beta.47 — Universal Dynamic Port Engine & Game Server Presets";
const BODY = `## Rubber Panel v0.1.0-beta.47

### 🚀 Highlights & Improvements
- **Universal Container Port Auto-Compliance**: Any container image (from Docker Hub or private registries) automatically discovers its native listening port and binds seamlessly to the panel-assigned host port.
- **Dynamic Port Environment Injection**: Injects standard port environment variables (\`PORT\`, \`SERVER_PORT\`, \`INTERNAL_PORT\`, \`APP_PORT\`, \`HTTP_PORT\`, \`HOST=0.0.0.0\`, \`BIND_ADDRESS=0.0.0.0\`) into all container runtimes.
- **Game Server Engine Enhancements**: Updated Terraria and other game server presets with optimized runtime configurations and persistent worlds directory mounting.
- **Zero Configuration Needed**: Administrators and users no longer need to manually modify codebase port mappings when adding new Docker images or server types.
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

  console.log("\n=== Committing and pushing changes to Git ===");
  try {
    execSync("git add .", { stdio: "inherit" });
    execSync(`git commit -m "Release ${TAG} - Universal Container Port Compliance & Resilience"`, { stdio: "inherit" });
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

  console.log(`\n=== Creating GitHub Release ${TAG} ===`);
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

  let release = createRes.data;
  if (createRes.status !== 201) {
    console.log(`Release creation returned status ${createRes.status}, checking existing release...`);
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
    release = getRes.data;
  }

  if (!release || !release.upload_url) {
    console.error("Failed to get release upload_url:", release);
    return;
  }

  console.log(`Uploading assets to ${TAG}...`);
  console.log("Uploading admin-side.zip...");
  await uploadAsset(release.upload_url, adminZipPath, "admin-side.zip");
  console.log("Uploading user-side.zip...");
  await uploadAsset(release.upload_url, userZipPath, "user-side.zip");
  console.log("Uploading node-side.zip...");
  await uploadAsset(release.upload_url, nodeZipPath, "node-side.zip");

  console.log(`\n✅ Successfully published ${TAG} and uploaded all assets!`);
}

main().catch(console.error);
