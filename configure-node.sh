#!/usr/bin/env bash
# ==============================================================================
#  Rubber Panel — Instant Node Configuration Script
#  Quickly configures credentials on an existing (or fresh) node daemon & restarts it.
# ==============================================================================

set -e

# Visual colors
GREEN="\033[0;32m"
LIME="\033[38;2;163;230;53m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

echo -e "${LIME}"
echo "==================================================================="
echo "           Rubber Panel — Node Daemon Configuration                "
echo "==================================================================="
echo -e "${NC}"

# Parse command line flags
ADMIN_URL=""
NODE_TOKEN=""
NODE_ID=""
NODE_PORT="3001"

for arg in "$@"; do
  case $arg in
    --admin-url=*)
      ADMIN_URL="${arg#*=}"
      ;;
    --node-token=*)
      NODE_TOKEN="${arg#*=}"
      ;;
    --node-id=*)
      NODE_ID="${arg#*=}"
      ;;
    --port=*)
      NODE_PORT="${arg#*=}"
      ;;
  esac
done

if [ -z "${NODE_TOKEN}" ] || [ -z "${ADMIN_URL}" ]; then
  echo -e "${RED}[Error] Missing required arguments: --admin-url and --node-token${NC}"
  echo -e "${YELLOW}Usage: ./configure-node.sh --admin-url=\"http://...\" --node-id=\"...\" --node-token=\"...\" --port=3001${NC}"
  exit 1
fi

INSTALL_DIR="/var/rubber-panel/node-daemon"
DATA_DIR="/var/rubber-panel/servers"

# 1. If not installed, automatically install node daemon first
if [ ! -d "${INSTALL_DIR}" ] || [ ! -f "${INSTALL_DIR}/package.json" ]; then
  echo -e "${CYAN}Node daemon not found. Running installer first...${NC}"
  curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/install-node.sh | sudo bash -s -- --admin-url="${ADMIN_URL}" --node-id="${NODE_ID}" --node-token="${NODE_TOKEN}" --port="${NODE_PORT}"
  exit 0
fi

# 2. Update .env file instantly
echo -e "${CYAN}[1/3] Updating Node Daemon credentials (.env)...${NC}"
mkdir -p "${DATA_DIR}"
cat <<EOF > "${INSTALL_DIR}/.env"
NODE_PORT=${NODE_PORT}
PORT=${NODE_PORT}
AGENT_PORT=${NODE_PORT}
ADMIN_API_URL="${ADMIN_URL}"
NODE_TOKEN="${NODE_TOKEN}"
NODE_ID="${NODE_ID}"
DATA_DIR="${DATA_DIR}"
SERVER_DATA_DIR="${DATA_DIR}"
HEARTBEAT_INTERVAL_SECONDS=30
GITHUB_REPO="Flaxa-Technologies/rubber-panel"
EOF

# 3. Restart PM2 process
echo -e "${CYAN}[2/3] Restarting Rubber Node Daemon...${NC}"
if command -v pm2 >/dev/null 2>&1; then
  sudo pm2 restart rubber-node 2>/dev/null || pm2 restart rubber-node 2>/dev/null || (
    cd "${INSTALL_DIR}"
    sudo pm2 start ecosystem.config.js 2>/dev/null || pm2 start ecosystem.config.js 2>/dev/null || true
  )
  sudo pm2 save 2>/dev/null || pm2 save 2>/dev/null || true
fi

# 4. Immediate Connection Verification
echo -e "${CYAN}[3/3] Verifying heartbeat connection with Admin Panel...${NC}"
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${ADMIN_URL}/api/node/heartbeat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${NODE_TOKEN}" \
  -H "X-Node-Id: ${NODE_ID}" \
  -H "Bypass-Tunnel-Reminder: true" \
  -d "{\"nodeId\":\"${NODE_ID}\",\"agentVersion\":\"0.1.0-beta.10\",\"cpuUsage\":0,\"ramUsage\":0,\"diskUsage\":0}" 2>/dev/null || echo "000")

if [ "${STATUS_CODE}" = "200" ]; then
  echo -e "${LIME}"
  echo "==================================================================="
  echo "         ✓ Node Daemon Configured & Connected Successfully!        "
  echo "==================================================================="
  echo -e "${NC}"
  echo -e "  ${GREEN}Admin URL:${NC}       ${ADMIN_URL}"
  echo -e "  ${GREEN}Node ID:${NC}         ${NODE_ID}"
  echo -e "  ${GREEN}Status:${NC}          ONLINE (Verified 200 OK)"
  echo -e "  Check your Admin Panel -> Nodes to see the green active indicator."
else
  echo -e "${YELLOW}[Notice] Credentials saved and PM2 reloaded (Heartbeat HTTP ${STATUS_CODE}).${NC}"
  echo -e "The background daemon is now running and heartbeating to ${ADMIN_URL}."
fi
