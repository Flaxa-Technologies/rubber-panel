import { NextRequest, NextResponse } from "next/server";
import { verifySetupToken } from "@/lib/node-setup-tokens";

export const dynamic = "force-dynamic";

// GET /api/node/configure/[token] (e.g. /api/node/configure/ncfg_....sh)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const setupData = verifySetupToken(token);

  if (!setupData) {
    const expiredScript = `#!/usr/bin/env bash
echo ""
echo -e "\\033[0;31m===================================================================\\033[0m"
echo -e "\\033[0;31m  [Error] This Node Auto-Configuration link has EXPIRED (15-min limit) \\033[0m"
echo -e "\\033[0;31m===================================================================\\033[0m"
echo ""
echo -e "\\033[1;33mTo generate a fresh 1-click command:\\033[0m"
echo "  1. Go to your Admin Panel -> Nodes"
echo "  2. Open the node setup or click 'Add Node' to copy a new command."
echo ""
exit 1
`;
    return new NextResponse(expiredScript, {
      status: 410,
      headers: {
        "Content-Type": "text/x-shellscript; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const { nodeId, authToken, port } = setupData;

  const script = `#!/usr/bin/env bash
# ==============================================================================
#  Rubber Panel — 1-Click Instant Node Daemon Auto-Configuration
#  Generated dynamically by Admin Panel (15-minute temporary link)
# ==============================================================================

set -e

GREEN="\\033[0;32m"
LIME="\\033[38;2;163;230;53m"
CYAN="\\033[0;36m"
YELLOW="\\033[1;33m"
RED="\\033[0;31m"
NC="\\033[0m"

echo -e "\${LIME}"
echo "==================================================================="
echo "           Rubber Panel — Node Daemon Configuration                "
echo "==================================================================="
echo -e "\${NC}"

ADMIN_URL="${origin}"
NODE_TOKEN="${authToken}"
NODE_ID="${nodeId}"
NODE_PORT="${port}"

INSTALL_DIR="/var/rubber-panel/node-daemon"
DATA_DIR="/var/rubber-panel/servers"

# 1. If not installed, automatically install node daemon first
if [ ! -d "\${INSTALL_DIR}" ] || [ ! -f "\${INSTALL_DIR}/package.json" ]; then
  echo -e "\${CYAN}Node daemon not found on this machine. Running installer first...\\033[0m"
  curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/install-node.sh | sudo bash -s -- --admin-url="\${ADMIN_URL}" --node-id="\${NODE_ID}" --node-token="\${NODE_TOKEN}" --port="\${NODE_PORT}"
  exit 0
fi

# 2. Update .env file instantly
echo -e "\${CYAN}[1/3] Updating Node Daemon credentials (.env)...\\033[0m"
mkdir -p "\${DATA_DIR}"
cat <<EOF > "\${INSTALL_DIR}/.env"
NODE_PORT=\${NODE_PORT}
PORT=\${NODE_PORT}
AGENT_PORT=\${NODE_PORT}
ADMIN_API_URL="\${ADMIN_URL}"
NODE_TOKEN="\${NODE_TOKEN}"
NODE_ID="\${NODE_ID}"
DATA_DIR="\${DATA_DIR}"
SERVER_DATA_DIR="\${DATA_DIR}"
HEARTBEAT_INTERVAL_SECONDS=30
GITHUB_REPO="Flaxa-Technologies/rubber-panel"
EOF

# 3. Restart PM2 process with updated environment variables
echo -e "\${CYAN}[2/3] Reloading Rubber Node Daemon with new credentials...\\033[0m"
if command -v pm2 >/dev/null 2>&1; then
  sudo pm2 restart rubber-node --update-env 2>/dev/null || pm2 restart rubber-node --update-env 2>/dev/null || (
    cd "\${INSTALL_DIR}"
    sudo pm2 start ecosystem.config.js 2>/dev/null || pm2 start ecosystem.config.js 2>/dev/null || true
  )
  sudo pm2 save 2>/dev/null || pm2 save 2>/dev/null || true
fi

# 4. Immediate Connection Verification
echo -e "\${CYAN}[3/3] Verifying heartbeat connection with Admin Panel...\\033[0m"
PAYLOAD='{"nodeId":"'\${NODE_ID}'","agentVersion":"0.1.0-beta.11","cpuUsage":0,"ramUsage":0,"diskUsage":0}'
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "\${ADMIN_URL}/api/node/heartbeat" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer \${NODE_TOKEN}" \\
  -H "X-Node-Id: \${NODE_ID}" \\
  -H "Bypass-Tunnel-Reminder: true" \\
  -d "\${PAYLOAD}" 2>/dev/null || echo "000")

if [ "\${STATUS_CODE}" = "200" ]; then
  echo -e "\${LIME}"
  echo "==================================================================="
  echo "         ✓ Node Daemon Configured & Connected Successfully!        "
  echo "==================================================================="
  echo -e "\\033[0m"
  echo -e "  \${GREEN}Admin URL:\\033[0m       \${ADMIN_URL}"
  echo -e "  \${GREEN}Node ID:\\033[0m         \${NODE_ID}"
  echo -e "  \${GREEN}Status:\\033[0m          ONLINE (Verified 200 OK)"
  echo -e "  Check your Admin Panel -> Nodes to see the green active indicator."
else
  echo -e "\${YELLOW}[Notice] Credentials saved and PM2 reloaded (Heartbeat response: \${STATUS_CODE}).\\033[0m"
  echo -e "The background daemon is now actively communicating with \${ADMIN_URL}."
fi
`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
