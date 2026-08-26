#!/usr/bin/env bash
# ==============================================================================
#  Rubber Panel — 1-Click Unified Panel Installer (Admin + User Panel)
#  Installs Node.js 20, PM2, Git, dependencies, builds, & starts both portals.
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
echo "              Rubber Panel — Unified Panel Installer               "
echo "              Admin Portal (:3000) & User Portal (:3002)           "
echo "==================================================================="
echo -e "${NC}"

# Check Root
if [ "$(id -u)" -ne 0 ]; then
  echo -e "${RED}[Error] This script must be run as root (sudo bash install-panel.sh)${NC}"
  exit 1
fi

# Detect OS
echo -e "${CYAN}[1/7] Detecting OS & Installing Base Dependencies...${NC}"
if [ -f /etc/debian_version ]; then
  apt-get update -y
  apt-get install -y curl git unzip tar build-essential openssl sqlite3
elif [ -f /etc/redhat-release ]; then
  yum install -y curl git unzip tar make gcc gcc-c++ openssl sqlite
else
  echo -e "${YELLOW}[Warning] Unknown OS. Attempting standard package installation...${NC}"
fi

# Install Node.js 20 LTS if not present
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; then
  echo -e "${CYAN}[2/7] Installing Node.js 20 LTS...${NC}"
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
  echo -e "${CYAN}[3/7] Installing PM2 Process Manager...${NC}"
  npm install -g pm2
fi

# Install Directory
INSTALL_DIR="/var/www/rubber-panel"
echo -e "${CYAN}[4/7] Setting up installation directory at ${INSTALL_DIR}...${NC}"
mkdir -p "${INSTALL_DIR}"
cd "${INSTALL_DIR}"

# Fetch Latest Release from GitHub or Clone
REPO="Flaxa-Technologies/rubber-panel"
echo -e "${CYAN}Fetching latest release information from GitHub (${REPO})...${NC}"

LATEST_TAG=$(curl -s "https://api.github.com/repos/${REPO}/releases" | grep '"tag_name":' | head -n 1 | cut -d'"' -f4)
if [ -z "${LATEST_TAG}" ]; then
  LATEST_TAG="v0.1.0-beta.1"
fi
echo -e "${GREEN}✓ Targeted Release: ${LATEST_TAG}${NC}"

# Download Release Zips
ADMIN_ZIP_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/admin-side.zip"
USER_ZIP_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/user-side.zip"

mkdir -p "${INSTALL_DIR}/admin-side"
mkdir -p "${INSTALL_DIR}/user-side"

echo -e "${CYAN}Downloading Admin and User packages...${NC}"
curl -sL "${ADMIN_ZIP_URL}" -o admin-side.zip || true
curl -sL "${USER_ZIP_URL}" -o user-side.zip || true

if [ -f admin-side.zip ] && [ -s admin-side.zip ]; then
  unzip -qo admin-side.zip -d "${INSTALL_DIR}/admin-side"
  rm -f admin-side.zip
else
  # Fallback: Clone repo if zip asset not yet uploaded
  echo -e "${YELLOW}Release assets pending; cloning from repository...${NC}"
  TEMP_CLONE=$(mktemp -d)
  git clone --depth 1 "https://github.com/${REPO}.git" "${TEMP_CLONE}"
  cp -r "${TEMP_CLONE}/admin-side/"* "${INSTALL_DIR}/admin-side/" 2>/dev/null || true
  cp -r "${TEMP_CLONE}/user-side/"* "${INSTALL_DIR}/user-side/" 2>/dev/null || true
  rm -rf "${TEMP_CLONE}"
fi

if [ -f user-side.zip ] && [ -s user-side.zip ]; then
  unzip -qo user-side.zip -d "${INSTALL_DIR}/user-side"
  rm -f user-side.zip
fi

# Detect Public IP
SERVER_IP=$(curl -s -4 ifconfig.me || curl -s -4 icanhazip.com || echo "localhost")

# Prompt for domain / hostname
echo ""
echo -e "${LIME}--- Configuration Settings ---${NC}"
read -p "Enter Domain or Public IP for Panel [Default: ${SERVER_IP}]: " PANEL_HOST
PANEL_HOST=${PANEL_HOST:-$SERVER_IP}

# Generate Secure Random Secrets
NEXTAUTH_SECRET=$(openssl rand -hex 32)
INTERNAL_SECRET=$(openssl rand -hex 32)
NODE_SECRET=$(openssl rand -hex 32)

echo -e "${CYAN}[5/7] Configuring Environment (.env)...${NC}"

# Configure admin-side .env
cat <<EOF > "${INSTALL_DIR}/admin-side/.env"
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
NEXTAUTH_URL="http://${PANEL_HOST}:3000"
NEXTAUTH_TRUST_HOST=true
AUTH_TRUST_HOST=true
NEXT_PUBLIC_APP_URL="http://${PANEL_HOST}:3000"
NEXT_PUBLIC_APP_NAME="Rubber Panel"
NODE_WEBHOOK_SECRET="${NODE_SECRET}"
INTERNAL_API_SECRET="${INTERNAL_SECRET}"
GITHUB_REPO="Flaxa-Technologies/rubber-panel"
EOF

# Configure user-side .env
cat <<EOF > "${INSTALL_DIR}/user-side/.env"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
NEXTAUTH_URL="http://${PANEL_HOST}:3002"
NEXTAUTH_TRUST_HOST=true
AUTH_TRUST_HOST=true
NEXT_PUBLIC_APP_URL="http://${PANEL_HOST}:3002"
NEXT_PUBLIC_APP_NAME="Rubber Panel"
ADMIN_API_URL="http://localhost:3000"
INTERNAL_API_SECRET="${INTERNAL_SECRET}"
GITHUB_REPO="Flaxa-Technologies/rubber-panel"
EOF

echo -e "${GREEN}✓ Environments configured with secure random keys.${NC}"

# Build Admin Side
echo -e "${CYAN}[6/7] Building Admin Panel...${NC}"
cd "${INSTALL_DIR}/admin-side"
npm install --prefer-offline --no-audit --no-fund
npx prisma db push --accept-data-loss
if [ -f prisma/seed.ts ]; then
  npx tsx prisma/seed.ts || true
fi
npm run build

# Build User Side
echo -e "${CYAN}Building User Panel...${NC}"
cd "${INSTALL_DIR}/user-side"
npm install --prefer-offline --no-audit --no-fund
npm run build

# Start with PM2
echo -e "${CYAN}[7/7] Starting Services via PM2...${NC}"
pm2 delete rubber-admin 2>/dev/null || true
pm2 delete rubber-user 2>/dev/null || true

cd "${INSTALL_DIR}/admin-side"
pm2 start npm --name "rubber-admin" -- run start

cd "${INSTALL_DIR}/user-side"
pm2 start npm --name "rubber-user" -- run start -- -p 3002

pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo -e "${LIME}"
echo "==================================================================="
echo "            🎉 Rubber Panel Installation Complete!                 "
echo "==================================================================="
echo -e "${NC}"
echo -e "  ${GREEN}Admin Portal:${NC}      http://${PANEL_HOST}:3000"
echo -e "  ${GREEN}User Client Portal:${NC}http://${PANEL_HOST}:3002"
echo ""
echo -e "  ${CYAN}Default Admin Login:${NC}"
echo -e "    Email:     admin@flaxa.local"
echo -e "    Password:  Admin@Rubber123#"
echo ""
echo -e "  ${YELLOW}Note:${NC} Please log in and change your default password."
echo -e "  ${LIME}Auto-Updates:${NC} Admin & User panel updates can now be applied directly"
echo -e "                from the Admin Dashboard -> Updates Manager."
echo "==================================================================="
