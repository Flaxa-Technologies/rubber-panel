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

# Parse optional command-line flags
INPUT_DOMAIN=""
INPUT_EMAIL=""
INPUT_USERNAME=""
INPUT_PASSWORD=""

for arg in "$@"; do
  case $arg in
    --domain=*)
      INPUT_DOMAIN="${arg#*=}"
      ;;
    --email=*)
      INPUT_EMAIL="${arg#*=}"
      ;;
    --username=*)
      INPUT_USERNAME="${arg#*=}"
      ;;
    --password=*)
      INPUT_PASSWORD="${arg#*=}"
      ;;
  esac
done

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

LATEST_TAG=$(curl -s "https://api.github.com/repos/${REPO}/releases" 2>/dev/null | grep '"tag_name":' | head -n 1 | sed -E 's/.*"([^"]+)".*/\1/' | tr -d ' \n\r')
if [ -z "${LATEST_TAG}" ]; then
  LATEST_TAG=$(git ls-remote --tags "https://github.com/${REPO}.git" 2>/dev/null | grep -v '\^{}' | sort -V | tail -n 1 | sed 's/.*\///' | tr -d ' \n\r')
fi
if [ -z "${LATEST_TAG}" ]; then
  LATEST_TAG="v0.1.0-beta.48"
fi
echo -e "${GREEN}✓ Targeted Release: ${LATEST_TAG}${NC}"

# Download Release Zips
ADMIN_ZIP_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/admin-side.zip"
USER_ZIP_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/user-side.zip"

echo -e "${CYAN}Stopping running panel services...${NC}"
pm2 stop rubber-admin rubber-user 2>/dev/null || true

mkdir -p "${INSTALL_DIR}/admin-side"
mkdir -p "${INSTALL_DIR}/user-side"

echo -e "${CYAN}Downloading Admin and User packages...${NC}"
curl -sL "${ADMIN_ZIP_URL}" -o admin-side.zip || true
curl -sL "${USER_ZIP_URL}" -o user-side.zip || true

if [ -f admin-side.zip ] && [ -s admin-side.zip ]; then
  unzip -qo admin-side.zip -d "${INSTALL_DIR}/admin-side"
  rm -f admin-side.zip
else
  echo -e "${YELLOW}Downloading source tree from repository...${NC}"
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

# Detect Public IP if not provided
if [ -n "${INPUT_DOMAIN}" ]; then
  SERVER_IP="${INPUT_DOMAIN}"
else
  SERVER_IP=$(curl -s -4 --max-time 3 ifconfig.me 2>/dev/null || curl -s -4 --max-time 3 icanhazip.com 2>/dev/null || echo "localhost")
  SERVER_IP=$(echo "${SERVER_IP}" | tr -d ' \n\r')
  if [ -z "${SERVER_IP}" ]; then
    SERVER_IP="localhost"
  fi
fi

# Interactive Setup Form
echo ""
echo -e "${LIME}"
echo "==================================================================="
echo "                  Super Admin Setup Configuration Form             "
echo "==================================================================="
echo -e "${NC}"
echo -e "  Please provide your domain/IP and initial administrator credentials:"
echo ""

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

# Prompt for domain / hostname
PANEL_HOST="${INPUT_DOMAIN:-${PANEL_HOST}}"
if [ -z "${PANEL_HOST}" ]; then
  prompt_field "[1/4] Panel Domain or Public IP [Default: ${SERVER_IP}]" "The IP address or domain used to access your panel in browser" "${SERVER_IP}" PANEL_HOST
fi

# Prompt for Admin Credentials
ADMIN_EMAIL="${INPUT_EMAIL:-${ADMIN_EMAIL}}"
while [ -z "${ADMIN_EMAIL}" ]; do
  prompt_field "[2/4] Super Admin Email Address" "Primary email address for logging into the Admin Panel" "" ADMIN_EMAIL
done

ADMIN_USERNAME="${INPUT_USERNAME:-${ADMIN_USERNAME}}"
if [ -z "${ADMIN_USERNAME}" ]; then
  prompt_field "[3/4] Super Admin Username [Default: admin]" "Username for the administrator account" "admin" ADMIN_USERNAME
fi

ADMIN_PASSWORD="${INPUT_PASSWORD:-${ADMIN_PASSWORD}}"
while [ -z "${ADMIN_PASSWORD}" ]; do
  prompt_field "[4/4] Super Admin Password" "Choose a strong password for your super admin account" "" ADMIN_PASSWORD
done

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
npm install --include=dev --prefer-offline --no-audit --no-fund
npx prisma db push --accept-data-loss
if [ -f prisma/seed.ts ]; then
  SEED_ADMIN_EMAIL="${ADMIN_EMAIL}" SEED_ADMIN_PASSWORD="${ADMIN_PASSWORD}" SEED_ADMIN_USERNAME="${ADMIN_USERNAME}" npx tsx prisma/seed.ts || true
fi
rm -rf .next
npm run build

# Build User Side
echo -e "${CYAN}Building User Panel...${NC}"
cd "${INSTALL_DIR}/user-side"
npm install --include=dev --prefer-offline --no-audit --no-fund
rm -rf .next
npm run build

# Create PM2 Ecosystem File for clean multi-app execution
echo -e "${CYAN}[7/7] Starting Services via PM2...${NC}"
cat <<EOF > "${INSTALL_DIR}/ecosystem.config.js"
module.exports = {
  apps: [
    {
      name: "rubber-admin",
      cwd: "${INSTALL_DIR}/admin-side",
      script: "node_modules/next/dist/bin/next",
      args: "start --port 3000",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      max_memory_restart: "1G",
      restart_delay: 2000
    },
    {
      name: "rubber-user",
      cwd: "${INSTALL_DIR}/user-side",
      script: "node_modules/next/dist/bin/next",
      args: "start --port 3002",
      env: {
        NODE_ENV: "production",
        PORT: 3002
      },
      max_memory_restart: "1G",
      restart_delay: 2000
    }
  ]
};
EOF

pm2 delete rubber-admin rubber-user 2>/dev/null || true
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
echo "            Rubber Panel Installation Complete!                    "
echo "==================================================================="
echo -e "${NC}"
echo -e "  ${GREEN}Admin Portal:${NC}       http://${PANEL_HOST}:3000"
echo -e "  ${GREEN}User Client Portal:${NC} http://${PANEL_HOST}:3002"
echo ""
echo -e "  ${CYAN}Admin Login Credentials:${NC}"
echo -e "    Email:     ${ADMIN_EMAIL}"
echo -e "    Password:  ${ADMIN_PASSWORD}"
echo ""
echo -e "  ${YELLOW}PM2 Management Commands:${NC}"
echo -e "    Status:    pm2 status"
echo -e "    Logs:      pm2 logs"
echo -e "    Restart:   pm2 restart all"
echo ""
echo -e "  ${LIME}Auto-Updates:${NC} Admin, User, & Node fleet updates can be applied directly"
echo -e "                from Admin Dashboard -> Update Manager."
echo "==================================================================="
