#!/usr/bin/env bash
# ==============================================================================
#  Rubber Node Daemon — 1-Click Automated Repair & Reconnect Script
# ==============================================================================

set -e

LIME="\033[38;2;163;230;53m"
CYAN="\033[0;36m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

echo -e "${LIME}"
echo "==================================================================="
echo "           Rubber Node Daemon — 1-Click Automated Repair           "
echo "==================================================================="
echo -e "${NC}"

if [ "$EUID" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    exec sudo bash "$0" "$@"
  else
    echo -e "${RED}[Error] Please run this script as root or with sudo.${NC}"
    exit 1
  fi
fi

INSTALL_DIR="/var/rubber-panel/node-daemon"
if [ ! -d "${INSTALL_DIR}" ]; then
  if [ -d "./node-side" ]; then
    INSTALL_DIR="$(pwd)/node-side"
  elif [ -f "./package.json" ] && grep -q "node-side" package.json 2>/dev/null; then
    INSTALL_DIR="$(pwd)"
  else
    echo -e "${RED}[Error] Could not find Node Daemon at /var/rubber-panel/node-daemon.${NC}"
    exit 1
  fi
fi

INPUT_ADMIN_URL=""
INPUT_NODE_ID=""
INPUT_NODE_TOKEN=""
INPUT_PORT="3001"

for arg in "$@"; do
  case $arg in
    --admin-url=*)
      INPUT_ADMIN_URL="${arg#*=}"
      ;;
    --node-id=*)
      INPUT_NODE_ID="${arg#*=}"
      ;;
    --token=*|--node-token=*)
      INPUT_NODE_TOKEN="${arg#*=}"
      ;;
    --port=*)
      INPUT_PORT="${arg#*=}"
      ;;
  esac
done

ENV_FILE="${INSTALL_DIR}/.env"

# Read existing values if present
CURRENT_ADMIN_URL=""
CURRENT_NODE_ID=""
CURRENT_NODE_TOKEN=""
if [ -f "${ENV_FILE}" ]; then
  CURRENT_ADMIN_URL=$(grep '^ADMIN_API_URL=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' \r\n' || true)
  CURRENT_NODE_ID=$(grep '^NODE_ID=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' \r\n' || true)
  CURRENT_NODE_TOKEN=$(grep '^NODE_TOKEN=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' \r\n' || true)
fi

ADMIN_URL="${INPUT_ADMIN_URL:-${CURRENT_ADMIN_URL}}"
NODE_ID="${INPUT_NODE_ID:-${CURRENT_NODE_ID}}"
NODE_TOKEN="${INPUT_NODE_TOKEN:-${CURRENT_NODE_TOKEN}}"

if [ -z "${ADMIN_URL}" ] || [ "${ADMIN_URL}" = "http://localhost:3000" ] || [ "${NODE_ID}" = "paste-your-node-id-here" ] || [ -z "${NODE_ID}" ] || [ "${NODE_TOKEN}" = "paste-your-node-token-here" ] || [ -z "${NODE_TOKEN}" ]; then
  if [ -t 0 ] || [ -e /dev/tty ]; then
    echo -e "${YELLOW}Please enter your Node connection details from the Admin Panel:${NC}\n"
    read -p "Admin Panel URL (e.g. http://192.168.1.3:3000): " USER_URL < /dev/tty || true
    read -p "Node ID (UUID): " USER_ID < /dev/tty || true
    read -p "Node Secret Token: " USER_TOKEN < /dev/tty || true
    
    ADMIN_URL=${USER_URL:-$ADMIN_URL}
    NODE_ID=${USER_ID:-$NODE_ID}
    NODE_TOKEN=${USER_TOKEN:-$NODE_TOKEN}
  fi
fi

cat <<EOF > "${ENV_FILE}"
NODE_TOKEN="${NODE_TOKEN}"
NODE_ID="${NODE_ID}"
ADMIN_API_URL="${ADMIN_URL}"
AGENT_PORT=${INPUT_PORT}
PORT=${INPUT_PORT}
HEARTBEAT_INTERVAL_SECONDS=30
SERVER_DATA_DIR="./server-data"
EOF

echo -e "${GREEN}✓ Node configuration saved (.env)${NC}"

echo -e "${CYAN}Building Node Daemon in production mode...${NC}"
cd "${INSTALL_DIR}"
rm -rf .next
npm run build

echo -e "${CYAN}Reloading Rubber Node via PM2...${NC}"
if command -v pm2 >/dev/null 2>&1; then
  sudo pm2 restart rubber-node --update-env 2>/dev/null || pm2 restart rubber-node --update-env 2>/dev/null || (
    pm2 start npm --name "rubber-node" -- run start --port ${INPUT_PORT}
  )
  sudo pm2 save 2>/dev/null || pm2 save 2>/dev/null || true
fi

echo -e "${LIME}"
echo "==================================================================="
echo "       🎉 Rubber Node Daemon Successfully Repaired & Online!        "
echo "==================================================================="
echo -e "${NC}\n"
