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
const TAG = "v0.1.0-beta.46";
const NAME = "Rubber Panel v0.1.0-beta.46 — Universal Container Port Compliance & Resilience";
const BODY = `## Rubber Panel v0.1.0-beta.46

### 🚀 Highlights & Improvements
- **Universal Container Port Auto-Compliance**: Added automatic internal port resolution engine that inspects image metadata (\`ExposedPorts\`) and queries our comprehensive service registry. Any arbitrary Docker container now automatically binds its internal listening port to the panel-assigned host port without requiring panel codebase edits.
- **Port Environment Injection**: Automatically injects standard port environment variables (\`PORT\`, \`SERVER_PORT\`, \`INTERNAL_PORT\`, \`APP_PORT\`, \`HTTP_PORT\`, \`HOST=0.0.0.0\`, \`BIND_ADDRESS=0.0.0.0\`) into all container runtimes.
- **Dashboard & App Error Boundaries**: Implemented graceful error recovery pages (\`error.tsx\`) across both User and Admin dashboard layouts to eliminate blank crash screens.
- **Console Panel Hardening**: Wrapped player lists and search filters with defensive checks against malformed or empty responses.
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
    console.log(`Saved ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB)`);
  };

  buildZip("admin-side", adminZipPath);
  buildZip("user-side", userZipPath);
  buildZip("node-side", nodeZipPath);

  if (!TOKEN) {
    console.error("No GH_TOKEN found! Cannot upload release.");
    process.exit(1);
  }

  console.log(`\n=== Creating Release ${TAG} on GitHub ===`);

  // Check if release exists
  const getReleaseOpts = {
    hostname: "api.github.com",
    path: `/repos/${REPO}/releases/tags/${TAG}`,
    method: "GET",
    headers: {
      "User-Agent": "RubberPanel-ReleaseBot",
      Authorization: `Bearer ${TOKEN}`,
    },
  };

  let releaseRes = await ghRequest(getReleaseOpts);
  let release = releaseRes.data;

  if (releaseRes.status === 404 || !release || !release.id) {
    console.log(`Release ${TAG} not found, creating new release...`);
    const createReleaseOpts = {
      hostname: "api.github.com",
      path: `/repos/${REPO}/releases`,
      method: "POST",
      headers: {
        "User-Agent": "RubberPanel-ReleaseBot",
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    };

    const createRes = await ghRequest(createReleaseOpts, JSON.stringify({
      tag_name: TAG,
      target_commitish: "main",
      name: NAME,
      body: BODY,
      draft: false,
      prerelease: true,
    }));

    if (createRes.status !== 201) {
      console.error("Failed to create release:", createRes);
      process.exit(1);
    }
    release = createRes.data;
    console.log(`Created release ID: ${release.id}`);
  } else {
    console.log(`Release exists with ID: ${release.id}`);
  }

  // Delete existing assets if they exist on the release
  if (release.assets && release.assets.length > 0) {
    for (const asset of release.assets) {
      console.log(`Deleting previous asset: ${asset.name} (ID: ${asset.id})...`);
      const delOpts = {
        hostname: "api.github.com",
        path: `/repos/${REPO}/releases/assets/${asset.id}`,
        method: "DELETE",
        headers: {
          "User-Agent": "RubberPanel-ReleaseBot",
          Authorization: `Bearer ${TOKEN}`,
        },
      };
      await ghRequest(delOpts);
    }
  }

  // Upload assets
  console.log(`\n=== Uploading release assets ===`);
  const uploadUrl = release.upload_url;

  console.log("Uploading admin-side.zip...");
  await uploadAsset(uploadUrl, adminZipPath, "admin-side.zip");
  console.log("Uploaded admin-side.zip!");

  console.log("Uploading user-side.zip...");
  await uploadAsset(uploadUrl, userZipPath, "user-side.zip");
  console.log("Uploaded user-side.zip!");

  console.log("Uploading node-side.zip...");
  await uploadAsset(uploadUrl, nodeZipPath, "node-side.zip");
  console.log("Uploaded node-side.zip!");

  console.log(`\n🎉 Successfully published ${TAG} to GitHub!`);
}

main().catch(console.error);
