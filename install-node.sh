#!/usr/bin/env bash
# ==============================================================================
#  Rubber Panel — 1-Click Node Daemon Installer (Compute Node)
#  Installs Docker CE, Node.js 20, PM2, sets up daemon agent & auto-starts.
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
echo "              Rubber Panel — Node Daemon Installer                 "
echo "              Automated Docker & Daemon Compute Agent Setup        "
echo "==================================================================="
echo -e "${NC}"

# Check Root
if [ "$(id -u)" -ne 0 ]; then
  echo -e "${RED}[Error] This script must be run as root (sudo bash install-node.sh)${NC}"
  exit 1
fi

# Detect OS & Base Tools
echo -e "${CYAN}[1/6] Installing Base Dependencies...${NC}"
if [ -f /etc/debian_version ]; then
  apt-get update -y
  apt-get install -y curl git unzip tar build-essential openssl ca-certificates gnupg
elif [ -f /etc/redhat-release ]; then
  yum install -y curl git unzip tar make gcc gcc-c++ openssl
fi

# Check & Install Docker CE
echo -e "${CYAN}[2/6] Checking Docker Engine...${NC}"
if ! command -v docker >/dev/null 2>&1; then
  echo -e "${YELLOW}Docker not found. Installing Docker CE automatically...${NC}"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
else
  echo -e "${GREEN}✓ Docker is already installed ($(docker --version)).${NC}"
fi

# Ensure Docker service is running
systemctl start docker || true

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

# Install PM2
if ! command -v pm2 >/dev/null 2>&1; then
  echo -e "${CYAN}Installing PM2 Process Manager...${NC}"
  npm install -g pm2
fi

# Prepare Directories
INSTALL_DIR="/var/www/rubber-node"
DATA_DIR="/var/lib/rubber-panel/servers"

mkdir -p "${INSTALL_DIR}"
mkdir -p "${DATA_DIR}"
cd "${INSTALL_DIR}"

# Fetch Latest Node Release
REPO="Flaxa-Technologies/rubber-panel"
echo -e "${CYAN}[4/6] Fetching Node Daemon package from GitHub (${REPO})...${NC}"

LATEST_TAG=$(curl -s "https://api.github.com/repos/${REPO}/releases" | grep '"tag_name":' | head -n 1 | cut -d'"' -f4)
if [ -z "${LATEST_TAG}" ]; then
  LATEST_TAG="v0.1.0-beta.1"
fi

NODE_ZIP_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/node-side.zip"
curl -sL "${NODE_ZIP_URL}" -o node-side.zip || true

if [ -f node-side.zip ] && [ -s node-side.zip ]; then
  unzip -qo node-side.zip -d "${INSTALL_DIR}"
  rm -f node-side.zip
else
  # Fallback: Clone repo
  echo -e "${YELLOW}Release asset pending; extracting node-side from repository...${NC}"
  TEMP_CLONE=$(mktemp -d)
  git clone --depth 1 "https://github.com/${REPO}.git" "${TEMP_CLONE}"
  cp -r "${TEMP_CLONE}/node-side/"* "${INSTALL_DIR}/" 2>/dev/null || true
  rm -rf "${TEMP_CLONE}"
fi

# Interactive Configuration
echo ""
echo -e "${LIME}--- Node Daemon Configuration ---${NC}"
echo -e "${YELLOW}(Create a Node in your Admin Panel -> Nodes -> 'Add Node' to obtain the token)${NC}"
echo ""

read -p "Enter Admin Panel URL [e.g. http://your-panel-ip:3000]: " ADMIN_URL
while [ -z "${ADMIN_URL}" ]; do
  read -p "Admin Panel URL cannot be empty. Please enter URL: " ADMIN_URL
done

read -p "Enter Node Auth Token (from Admin Panel): " NODE_TOKEN
while [ -z "${NODE_TOKEN}" ]; do
  read -p "Node Auth Token cannot be empty. Please enter Token: " NODE_TOKEN
done

read -p "Enter Node Daemon Port [Default: 3001]: " NODE_PORT
NODE_PORT=${NODE_PORT:-3001}

# Configure node-side .env
echo -e "${CYAN}[5/6] Writing configuration (.env)...${NC}"
cat <<EOF > "${INSTALL_DIR}/.env"
NODE_PORT=${NODE_PORT}
ADMIN_API_URL="${ADMIN_URL}"
NODE_TOKEN="${NODE_TOKEN}"
DATA_DIR="${DATA_DIR}"
GITHUB_REPO="Flaxa-Technologies/rubber-panel"
EOF

# Build Node Side
echo -e "${CYAN}[6/6] Building Node Daemon...${NC}"
npm install --prefer-offline --no-audit --no-fund
npm run build

# Start via PM2
pm2 delete rubber-node 2>/dev/null || true
pm2 start npm --name "rubber-node" -- run start -- --port "${NODE_PORT}"
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo -e "${LIME}"
echo "==================================================================="
echo "            🎉 Rubber Node Daemon Setup Complete!                  "
echo "==================================================================="
echo -e "${NC}"
echo -e "  ${GREEN}Daemon Port:${NC}     ${NODE_PORT}"
echo -e "  ${GREEN}Admin URL:${NC}       ${ADMIN_URL}"
echo -e "  ${GREEN}Data Directory:${NC}  ${DATA_DIR}"
echo -e "  ${GREEN}Docker Service:${NC}  Running"
echo ""
echo -e "  ${CYAN}Heartbeat:${NC} The daemon is now actively communicating with your panel."
echo -e "             Check the Admin Dashboard under 'Nodes' to verify the green ONLINE status."
echo ""
echo -e "  ${LIME}Auto-Updates:${NC} Node Daemon updates can be remotely dispatched directly"
echo -e "                from the Admin Dashboard -> Updates Manager."
echo "==================================================================="
