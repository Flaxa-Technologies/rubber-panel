const https = require('https');
const fs = require('fs');
const path = require('path');
const AdmZip = require('./admin-side/node_modules/adm-zip');

let TOKEN = '';
const envFile = path.join(__dirname, 'github.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
    if (line.startsWith('GH_TOKEN=')) TOKEN = line.replace('GH_TOKEN=', '').trim();
    if (line.startsWith('GITHUB_TOKEN=')) TOKEN = line.replace('GITHUB_TOKEN=', '').trim();
  }
}

if (!TOKEN) {
  console.error('No GH_TOKEN found');
  process.exit(1);
}

function gh(url, method='GET', data=null, headers={}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url.startsWith('http') ? url : 'https://api.github.com' + url);
    const req = https.request(u, {
      method,
      headers: {
        'User-Agent': 'RubberPanel',
        Authorization: 'token ' + TOKEN,
        Accept: 'application/vnd.github.v3+json',
        ...headers
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(b || '{}') }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function createZip(sourceDir, zipPath) {
  const zip = new AdmZip();
  const excludes = ['node_modules', '.next', '.data', 'dev.db', 'dev.db-journal', '.env', '.git'];
  function add(cur, rel='') {
    for (const item of fs.readdirSync(cur)) {
      if (excludes.includes(item)) continue;
      const f = path.join(cur, item);
      const r = rel ? rel + '/' + item : item;
      if (fs.statSync(f).isDirectory()) add(f, r);
      else zip.addFile(r, fs.readFileSync(f));
    }
  }
  add(sourceDir);
  zip.writeZip(zipPath);
}

function uploadAsset(uploadUrlTemplate, assetPath) {
  return new Promise((resolve, reject) => {
    const uploadUrl = uploadUrlTemplate.replace(/\{(\?name,label)?\}/, '') + '?name=' + path.basename(assetPath);
    const stat = fs.statSync(assetPath);
    const req = https.request(new URL(uploadUrl), {
      method: 'POST',
      headers: {
        'User-Agent': 'RubberPanel',
        Authorization: 'token ' + TOKEN,
        'Content-Type': 'application/zip',
        'Content-Length': stat.size,
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    fs.createReadStream(assetPath).pipe(req);
  });
}

async function run() {
  const tagName = 'v0.1.0-beta.44';
  console.log('Fetching or creating release', tagName, '...');
  let relRes = await gh('/repos/Flaxa-Technologies/rubber-panel/releases/tags/' + tagName);
  let release;

  if (relRes.status === 200) {
    release = relRes.body;
    console.log('Found existing release ID:', release.id);

    // Delete any old assets on this release
    if (release.assets && release.assets.length > 0) {
      for (const asset of release.assets) {
        console.log('Deleting existing asset:', asset.name, '(ID:', asset.id, ')');
        await gh('/repos/Flaxa-Technologies/rubber-panel/releases/assets/' + asset.id, 'DELETE');
      }
    }
  } else {
    relRes = await gh('/repos/Flaxa-Technologies/rubber-panel/releases', 'POST', JSON.stringify({
      tag_name: tagName,
      target_commitish: 'main',
      name: 'Rubber Panel v0.1.0-beta.44',
      body: '## Rubber Panel v0.1.0-beta.44\n\n### Universal Container Port Auto-Compliance & Dynamic Overrides\n- **Automatic ExposedPorts Inspection**: Automatically inspects Docker image metadata for any container image to detect its native internal port and protocol.\n- **Built-in Registry Fallback**: Intelligent port resolution for MySQL (3306), Postgres (5432), Redis (6379), MongoDB (27017), RabbitMQ (5672), Web/Nginx (80), Code Server (8080), Grafana (3000), MinIO (9000), Terraria (7777), Valheim (2456), etc.\n- **Manual Internal Port Override**: Users and Admins can configure or override the internal container port directly from Server Settings in the dashboard without code changes.\n- **Dynamic Port Environment Injection**: Injects `PORT`, `SERVER_PORT`, `INTERNAL_PORT`, `APP_PORT`, `HTTP_PORT`, and `HOST=0.0.0.0` into all application containers so dynamic apps automatically comply with panel port assignments.\n- **Multi-Protocol Support**: Supports TCP, UDP, and dual-stack game servers dynamically.\n- **Updated Installers & Updaters**: Updated installer and updater scripts with automatic release resolution.\n\n### 📦 Release Assets\n- `admin-side.zip` — Admin Management Portal\n- `user-side.zip` — User Client Portal\n- `node-side.zip` — Node Daemon Agent\n\n### 🚀 1-Command VPS Update\n```bash\ncurl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/update-panel.sh | sudo bash\ncurl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/update-node.sh | sudo bash\n```',
      draft: false,
      prerelease: true
    }));

    if (relRes.status !== 201) {
      console.error('Failed to create release:', relRes.status, relRes.body);
      return;
    }
    release = relRes.body;
    console.log('Created release ID:', release.id);
  }

  const distDir = path.join(__dirname, '.dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  for (const side of ['admin-side', 'user-side', 'node-side']) {
    const zipPath = path.join(distDir, side + '.zip');
    console.log('Zipping', side, '...');
    createZip(path.join(__dirname, side), zipPath);
    console.log('Uploading', side + '.zip to GitHub release...');
    const status = await uploadAsset(release.upload_url, zipPath);
    console.log('Uploaded', side, 'status:', status);
  }

  for (const script of ['install-panel.sh', 'install-node.sh', 'update-panel.sh', 'update-node.sh', 'patch-panel.sh']) {
    const scriptPath = path.join(__dirname, script);
    if (fs.existsSync(scriptPath)) {
      console.log('Uploading', script, 'to GitHub release...');
      const status = await uploadAsset(release.upload_url, scriptPath);
      console.log('Uploaded', script, 'status:', status);
    }
  }

  console.log('All beta.44 assets uploaded successfully!');
}

run().catch(console.error);
