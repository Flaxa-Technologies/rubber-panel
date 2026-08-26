#!/usr/bin/env bash
# ==============================================================================
#  Rubber Panel Node Daemon - Automated Installer & Supervisor
#  Powered by Flaxa Studios (https://flaxa.net)
# ==============================================================================

set -e

# Parse arguments
INPUT_ADMIN_URL=""
INPUT_NODE_ID=""
INPUT_NODE_TOKEN=""
INPUT_PORT="3001"
NON_INTERACTIVE=false

for arg in "$@"; do
  case $arg in
    --admin-url=*)
      INPUT_ADMIN_URL="${arg#*=}"
      shift
      ;;
    --node-id=*)
      INPUT_NODE_ID="${arg#*=}"
      shift
      ;;
    --node-token=*)
      INPUT_NODE_TOKEN="${arg#*=}"
      shift
      ;;
    --port=*)
      INPUT_PORT="${arg#*=}"
      shift
      ;;
    --non-interactive|-y)
      NON_INTERACTIVE=true
      shift
      ;;
  esac
done

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

clear 2>/dev/null || true
echo -e "${GREEN}${BOLD}"
echo " ================================================================"
echo "   ____       _     _                  ____                  _   "
echo "  |  _ \ _   _| |__ | |__   ___ _ __   |  _ \ __ _ _ __   ___| |  "
echo "  | |_) | | | | '_ \| '_ \ / _ \ '__|  | |_) / _\` | '_ \ / _ \ |  "
echo "  |  _ <| |_| | |_) | |_) |  __/ |     |  __/ (_| | | | |  __/ |  "
echo "  |_| \_\\__,_|_.__/|_.__/ \___|_|     |_|   \__,_|_| |_|\___|_|  "
echo "                                                                 "
echo "          RUBBER PANEL NODE DAEMON — BY FLAXA STUDIOS            "
echo " ================================================================"
echo -e "${NC}"

# Check for root/sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}[i] Running as non-root user ($(whoami)). For automatic package installs, sudo may be required.${NC}"
fi

echo -e "${CYAN}[1/6] Checking system prerequisites...${NC}"

# Package manager detection
if command -v apt-get >/dev/null 2>&1; then
  PKG_MGR="apt"
elif command -v dnf >/dev/null 2>&1; then
  PKG_MGR="dnf"
elif command -v yum >/dev/null 2>&1; then
  PKG_MGR="yum"
elif command -v pacman >/dev/null 2>&1; then
  PKG_MGR="pacman"
else
  PKG_MGR="unknown"
fi

install_packages() {
  if [ "$PKG_MGR" = "apt" ]; then
    sudo apt-get update -y 2>/dev/null || apt-get update -y 2>/dev/null || true
    sudo apt-get install -y curl wget git tar unzip jq ca-certificates gnupg 2>/dev/null || apt-get install -y curl wget git tar unzip jq ca-certificates gnupg 2>/dev/null || true
  elif [ "$PKG_MGR" = "dnf" ] || [ "$PKG_MGR" = "yum" ]; then
    sudo $PKG_MGR install -y curl wget git tar unzip jq ca-certificates 2>/dev/null || $PKG_MGR install -y curl wget git tar unzip jq ca-certificates 2>/dev/null || true
  fi
}

install_packages >/dev/null 2>&1 || true

# 1. Install/Verify Node.js (v20+ LTS required)
echo -e "${CYAN}[2/6] Checking Node.js runtime environment...${NC}"
NODE_OK=0
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VER" -ge 20 ]; then
    echo -e "${GREEN}✓ Node.js $(node -v) is ready.${NC}"
    NODE_OK=1
  fi
fi

if [ "$NODE_OK" -eq 0 ]; then
  echo -e "${YELLOW}[i] Installing Node.js 20 LTS...${NC}"
  if [ "$PKG_MGR" = "apt" ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | (sudo bash - || bash -)
    sudo apt-get install -y nodejs || apt-get install -y nodejs
  elif [ "$PKG_MGR" = "dnf" ] || [ "$PKG_MGR" = "yum" ]; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | (sudo bash - || bash -)
    sudo $PKG_MGR install -y nodejs || $PKG_MGR install -y nodejs
  else
    echo -e "${RED}[✗] Please install Node.js v20+ manually for your distribution.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Installed Node.js $(node -v).${NC}"
fi

# 2. Install/Verify Docker
echo -e "${CYAN}[3/6] Checking Docker engine & daemon...${NC}"
if ! command -v docker >/dev/null 2>&1; then
  echo -e "${YELLOW}[i] Docker not found. Installing Docker engine automatically...${NC}"
  curl -fsSL https://get.docker.com | (sudo sh || sh)
  (sudo service docker start 2>/dev/null || service docker start 2>/dev/null || sudo systemctl enable --now docker 2>/dev/null || systemctl enable --now docker 2>/dev/null) || true
  echo -e "${GREEN}✓ Docker engine installed and service initialized.${NC}"
else
  echo -e "${GREEN}✓ Docker is ready: $(docker --version).${NC}"
  (sudo service docker start 2>/dev/null || service docker start 2>/dev/null || sudo systemctl enable --now docker 2>/dev/null || systemctl enable --now docker 2>/dev/null) || true
fi

# 3. Setup Server Storage Directory
STORAGE_DIR="/var/rubber-panel/servers"
(sudo mkdir -p "$STORAGE_DIR" 2>/dev/null && sudo chmod 755 "$STORAGE_DIR" 2>/dev/null) || mkdir -p "$STORAGE_DIR" 2>/dev/null || true
mkdir -p "./data/servers" 2>/dev/null || true

# 4. Configure .env credentials
echo -e "${CYAN}[4/6] Checking node configuration (.env)...${NC}"
if [ ! -f .env ]; then
  cp .env.example .env 2>/dev/null || touch .env
fi

# Use existing env variables if defined
[ -n "$NODE_TOKEN" ] && INPUT_NODE_TOKEN="$NODE_TOKEN"
[ -n "$NODE_ID" ] && INPUT_NODE_ID="$NODE_ID"
[ -n "$ADMIN_API_URL" ] && INPUT_ADMIN_URL="$ADMIN_API_URL"
[ -n "$AGENT_PORT" ] && INPUT_PORT="$AGENT_PORT"

# Check if required values exist in .env
NEED_SETUP=0
if grep -q 'NODE_TOKEN="paste-your-node-token-here"' .env 2>/dev/null || ! grep -q 'NODE_TOKEN=' .env 2>/dev/null || grep -q 'NODE_TOKEN=""' .env 2>/dev/null; then
  NEED_SETUP=1
fi
if grep -q 'NODE_ID="paste-your-node-id-here"' .env 2>/dev/null || ! grep -q 'NODE_ID=' .env 2>/dev/null || grep -q 'NODE_ID=""' .env 2>/dev/null; then
  NEED_SETUP=1
fi

if [ -n "$INPUT_NODE_TOKEN" ] && [ -n "$INPUT_NODE_ID" ]; then
  NEED_SETUP=2
fi

if [ "$NEED_SETUP" -eq 1 ] && [ "$NON_INTERACTIVE" = false ] && [ -t 0 ]; then
  echo -e "${YELLOW}${BOLD}"
  echo " ================================================================"
  echo "   NODE SETUP CONFIGURATION (From Admin Panel -> Nodes -> Add)   "
  echo " ================================================================"
  echo -e "${NC}"
  
  read -p "Enter Admin Panel URL [http://localhost:3000]: " USER_ADMIN_URL
  INPUT_ADMIN_URL=${USER_ADMIN_URL:-http://localhost:3000}
  
  read -p "Enter Node ID (UUID): " INPUT_NODE_ID
  read -p "Enter Node Secret Token: " INPUT_NODE_TOKEN
  read -p "Enter Node Agent Port [3001]: " USER_PORT
  INPUT_PORT=${USER_PORT:-3001}
  NEED_SETUP=2
fi

if [ "$NEED_SETUP" -eq 2 ]; then
  INPUT_ADMIN_URL=${INPUT_ADMIN_URL:-http://localhost:3000}
  printf '%s\n' \
    "# Rubber Panel — Node Side Environment" \
    "# Generated by Flaxa Studios Setup Script" \
    "" \
    "NODE_TOKEN=\"${INPUT_NODE_TOKEN}\"" \
    "NODE_ID=\"${INPUT_NODE_ID}\"" \
    "ADMIN_API_URL=\"${INPUT_ADMIN_URL}\"" \
    "AGENT_PORT=${INPUT_PORT}" \
    "PORT=${INPUT_PORT}" \
    "HEARTBEAT_INTERVAL_SECONDS=30" \
    "SERVER_DATA_DIR=\"${STORAGE_DIR}\"" > .env
  echo -e "${GREEN}✓ Configuration saved to .env${NC}"
else
  echo -e "${GREEN}✓ Existing configuration found in .env${NC}"
fi

# 5. Install NPM Dependencies & Build
echo -e "${CYAN}[5/6] Installing dependencies and building production bundle...${NC}"
npm install --legacy-peer-deps
npm run build

# 6. PM2 Process Supervisor & Startup
echo -e "${CYAN}[6/6] Launching Rubber Panel Node Daemon...${NC}"
if ! command -v pm2 >/dev/null 2>&1; then
  echo -e "${YELLOW}[i] Installing PM2 process supervisor...${NC}"
  (sudo npm install -g pm2 2>/dev/null || npm install -g pm2 2>/dev/null) || true
fi

if command -v pm2 >/dev/null 2>&1; then
  pm2 delete rubber-node 2>/dev/null || true
  pm2 start npm --name "rubber-node" --update-env -- run start
  pm2 save 2>/dev/null || true
  echo -e "\n${GREEN}${BOLD}================================================================${NC}"
  echo -e "${GREEN}${BOLD}  🎉 RUBBER PANEL NODE DAEMON RUNNING SUCCESSFULLY!              ${NC}"
  echo -e "${GREEN}${BOLD}  Powered by Flaxa Studios (https://flaxa.net)                   ${NC}"
  echo -e "${GREEN}${BOLD}================================================================${NC}"
  echo -e "  • Process Name: ${CYAN}rubber-node${NC}"
  echo -e "  • Status:       ${CYAN}Active & Supervised via PM2${NC}"
  echo -e "  • View Logs:    ${YELLOW}pm2 logs rubber-node${NC}"
  echo -e "  • Restart:      ${YELLOW}pm2 restart rubber-node${NC}"
  echo -e "  • Stop:         ${YELLOW}pm2 stop rubber-node${NC}"
  echo -e "================================================================\n"
else
  echo -e "${GREEN}✓ Starting daemon directly on port ${INPUT_PORT}...${NC}"
  npm run start
fi
