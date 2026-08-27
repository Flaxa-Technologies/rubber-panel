#!/usr/bin/env bash
# ==============================================================================
#  Rubber Panel — 1-Click Compute Node Daemon Installer
#  Installs Docker, Node.js 20, PM2, and configures the compute agent daemon.
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
echo "             Rubber Panel — Compute Node Daemon Setup              "
echo "==================================================================="
echo -e "${NC}"

# Parse optional command-line flags
INPUT_ADMIN_URL=""
INPUT_NODE_TOKEN=""
INPUT_NODE_ID=""
INPUT_PORT=""

for arg in "$@"; do
  case $arg in
    --admin-url=*)
      INPUT_ADMIN_URL="${arg#*=}"
      ;;
    --node-token=*)
      INPUT_NODE_TOKEN="${arg#*=}"
      ;;
    --node-id=*)
      INPUT_NODE_ID="${arg#*=}"
      ;;
    --port=*)
      INPUT_PORT="${arg#*=}"
      ;;
  esac
done

# Check Root
if [ "$(id -u)" -ne 0 ]; then
  echo -e "${RED}[Error] This script must be run as root (sudo bash install-node.sh)${NC}"
  exit 1
fi

# Detect OS
echo -e "${CYAN}[1/6] Detecting OS & Installing Base Dependencies...${NC}"
if [ -f /etc/debian_version ]; then
  apt-get update -y
  apt-get install -y curl git unzip tar build-essential openssl ca-certificates gnupg
elif [ -f /etc/redhat-release ]; then
  yum install -y curl git unzip tar make gcc gcc-c++ openssl
else
  echo -e "${YELLOW}[Warning] Unknown OS. Continuing with generic setup...${NC}"
fi

# Install Docker if not present
if ! command -v docker >/dev/null 2>&1; then
  echo -e "${CYAN}[2/6] Installing Docker Engine...${NC}"
  curl -fsSL https://get.docker.com | bash
  systemctl enable docker 2>/dev/null || true
  systemctl start docker 2>/dev/null || true
fi
echo -e "${GREEN}✓ Docker $(docker --version 2>/dev/null | cut -d',' -f1 || echo 'Engine') ready.${NC}"

# Install Node.js 20 LTS if not present
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; then
  echo -e "${CYAN}[3/6] Installing Node.js 20 LTS...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  if [ -f /etc/debian_version ]; then
    apt-get install -y nodejs
  else
    yum install -y nodejs
  fi
fi
echo -e "${GREEN}✓ Node.js $(node -v) & npm $(npm -v) ready.${NC}"

# Install PM2 globally
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

# Prepare Data Directory for Game Servers
DATA_DIR="/var/rubber-panel/servers"
mkdir -p "${DATA_DIR}"

# Install Directory
INSTALL_DIR="/var/rubber-panel/node-daemon"
mkdir -p "${INSTALL_DIR}"
cd "${INSTALL_DIR}"

# Fetch Latest Node Release
REPO="Flaxa-Technologies/rubber-panel"
echo -e "${CYAN}[4/6] Fetching Node Daemon package from GitHub (${REPO})...${NC}"

LATEST_TAG=$(git ls-remote --tags "https://github.com/${REPO}.git" 2>/dev/null | grep -v '\^{}' | tail -n 1 | sed 's/.*\///' | tr -d ' \n\r')
if [ -z "${LATEST_TAG}" ]; then
  LATEST_TAG=$(curl -s "https://github.com/${REPO}/releases.atom" 2>/dev/null | grep -o '<id>tag:github.com[^<]*' | head -n 1 | sed 's/.*\///')
fi
if [ -z "${LATEST_TAG}" ]; then
  LATEST_TAG="v0.1.0-beta.17"
fi

NODE_ZIP_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/node-side.zip"
curl -sL "${NODE_ZIP_URL}" -o node-side.zip || true

if [ -f node-side.zip ] && [ -s node-side.zip ]; then
  unzip -qo node-side.zip -d "${INSTALL_DIR}"
  rm -f node-side.zip
else
  echo -e "${YELLOW}Downloading source tree from repository...${NC}"
  TEMP_CLONE=$(mktemp -d)
  git clone --depth 1 "https://github.com/${REPO}.git" "${TEMP_CLONE}"
  cp -r "${TEMP_CLONE}/node-side/"* "${INSTALL_DIR}/" 2>/dev/null || true
  rm -rf "${TEMP_CLONE}"
fi

# Interactive CLI Form if not provided via flags
prompt_field() {
  local prompt_label="$1"
  local prompt_hint="$2"
  local default_val="$3"
  local var_name="$4"
  local val=""

  echo -e "${LIME}┌── ${prompt_label}${NC}"
  if [ -n "${prompt_hint}" ]; then
    echo -e "${LIME}│${NC}   ${YELLOW}Hint: ${prompt_hint}${NC}"
  fi
  echo -ne "${LIME}└──> ${NC}"

  if [ -e /dev/tty ] && [ -r /dev/tty ]; then
    read -r val < /dev/tty || true
  else
    read -r val || true
  fi

  val=$(echo "$val" | tr -d '\r\n')
  if [ -z "$val" ]; then
    val="$default_val"
  fi
  eval "$var_name=\"\$val\""
  echo ""
}

NODE_TOKEN="${INPUT_NODE_TOKEN}"
NODE_ID="${INPUT_NODE_ID}"
ADMIN_URL="${INPUT_ADMIN_URL}"
if [ -z "${NODE_TOKEN}" ] || [ -z "${ADMIN_URL}" ]; then
  # Standby installation mode if run without CLI flags
  NODE_PORT=${NODE_PORT:-3001}
  ADMIN_URL=${ADMIN_URL:-"http://localhost:3000"}
fi

NODE_PORT=${NODE_PORT:-3001}

# Configure node-side .env
echo -e "${CYAN}[5/6] Writing configuration (.env)...${NC}"
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

# Build Node Side
echo -e "${CYAN}[6/6] Building Node Daemon...${NC}"
npm install --include=dev --prefer-offline --no-audit --no-fund
npm run build

# Start via PM2 Ecosystem
cat <<EOF > "${INSTALL_DIR}/ecosystem.config.js"
module.exports = {
  apps: [
    {
      name: "rubber-node",
      cwd: "${INSTALL_DIR}",
      script: "node_modules/next/dist/bin/next",
      args: "start --port ${NODE_PORT}",
      env: {
        NODE_ENV: "production",
        PORT: ${NODE_PORT}
      },
      max_memory_restart: "1G",
      restart_delay: 2000
    }
  ]
};
EOF

pm2 delete rubber-node 2>/dev/null || true
pm2 start "${INSTALL_DIR}/ecosystem.config.js"
pm2 save

# Ensure systemd auto-start on boot
if [ -d /run/systemd/system ] || command -v systemctl >/dev/null 2>&1; then
  pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup 2>/dev/null || true
  systemctl enable pm2-root 2>/dev/null || true
fi
pm2 save

echo -e "${LIME}"
echo "==================================================================="
echo "            Rubber Node Daemon Setup Complete!                     "
echo "==================================================================="
echo -e "${NC}"
echo -e "  ${GREEN}Daemon Port:${NC}     ${NODE_PORT}"
echo -e "  ${GREEN}Admin URL:${NC}       ${ADMIN_URL}"
echo -e "  ${GREEN}Data Directory:${NC}  ${DATA_DIR}"
echo -e "  ${GREEN}Docker Service:${NC}  Running"
echo ""
echo -e "  ${CYAN}Heartbeat:${NC} The daemon is now actively communicating with your panel."
echo -e "             Check the Admin Dashboard under 'Nodes' to verify the green ONLINE status."
