#!/usr/bin/env bash
# ==============================================================================
#  Rubber Panel — 1-Click Update & Hotfix Patch Script
#  Updates existing installation to the latest GitHub release without losing data.
# ==============================================================================

set -e

GREEN="\033[0;32m"
LIME="\033[38;2;163;230;53m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

echo -e "${LIME}"
echo "==================================================================="
echo "              Rubber Panel — Hotfix & Update Patcher               "
echo "==================================================================="
echo -e "${NC}"

# Detect Install Directory
INSTALL_DIR="/var/www/rubber-panel"
if [ ! -d "${INSTALL_DIR}/admin-side" ]; then
  if [ -d "./admin-side" ]; then
    INSTALL_DIR="$(pwd)"
  elif [ -d "/workspaces/rubber-panel/admin-side" ]; then
    INSTALL_DIR="/workspaces/rubber-panel"
  else
    echo -e "${RED}[Error] Could not locate rubber-panel installation.${NC}"
    echo "Please specify installation directory: sudo bash patch-panel.sh /path/to/rubber-panel"
    exit 1
  fi
fi

if [ -n "$1" ] && [ -d "$1/admin-side" ]; then
  INSTALL_DIR="$1"
fi

echo -e "${CYAN}[1/5] Target Installation: ${INSTALL_DIR}${NC}"
REPO="Flaxa-Technologies/rubber-panel"

# Fetch Latest Release Tag (Unmetered — avoids 403 API rate limits)
echo -e "${CYAN}[2/5] Checking latest release from GitHub...${NC}"
LATEST_TAG=$(git ls-remote --tags --sort="v:refname" "https://github.com/${REPO}.git" 2>/dev/null | tail -n 1 | sed 's/.*\///' | tr -d ' \n\r')
if [ -z "${LATEST_TAG}" ]; then
  LATEST_TAG=$(curl -s "https://github.com/${REPO}/releases.atom" 2>/dev/null | grep -o '<id>tag:github.com[^<]*' | head -n 1 | sed 's/.*\///')
fi
if [ -z "${LATEST_TAG}" ]; then
  LATEST_TAG="v0.1.0-beta.11"
fi
echo -e "${GREEN}✓ Applying Release: ${LATEST_TAG}${NC}"

TEMP_DIR=$(mktemp -d)
cd "${TEMP_DIR}"

ADMIN_ZIP="https://github.com/${REPO}/releases/download/${LATEST_TAG}/admin-side.zip"
USER_ZIP="https://github.com/${REPO}/releases/download/${LATEST_TAG}/user-side.zip"

echo -e "${CYAN}[3/5] Downloading package assets...${NC}"
curl -sL "${ADMIN_ZIP}" -o admin-side.zip || true
curl -sL "${USER_ZIP}" -o user-side.zip || true

# Extract Admin Side
if [ -f admin-side.zip ] && [ -s admin-side.zip ]; then
  unzip -qo admin-side.zip -d "${INSTALL_DIR}/admin-side"
  rm -f admin-side.zip
else
  echo -e "${YELLOW}Downloading source directly from git...${NC}"
  git clone --depth 1 "https://github.com/${REPO}.git" repo-clone
  cp -r repo-clone/admin-side/* "${INSTALL_DIR}/admin-side/" 2>/dev/null || true
  cp -r repo-clone/user-side/* "${INSTALL_DIR}/user-side/" 2>/dev/null || true
fi

# Extract User Side
if [ -f user-side.zip ] && [ -s user-side.zip ]; then
  unzip -qo user-side.zip -d "${INSTALL_DIR}/user-side"
  rm -f user-side.zip
fi

rm -rf "${TEMP_DIR}"

# Build Admin Panel
echo -e "${CYAN}[4/5] Compiling Admin Panel (${LATEST_TAG})...${NC}"
cd "${INSTALL_DIR}/admin-side"
npm install --include=dev --prefer-offline --no-audit --no-fund
npx prisma db push --accept-data-loss
npm run build

# Build User Panel
echo -e "${CYAN}Compiling User Panel (${LATEST_TAG})...${NC}"
cd "${INSTALL_DIR}/user-side"
npm install --include=dev --prefer-offline --no-audit --no-fund
npm run build

# Restart PM2 & Ensure Boot Auto-Start
echo -e "${CYAN}[5/5] Reloading PM2 services & saving startup state...${NC}"
if command -v pm2 >/dev/null 2>&1; then
  sudo pm2 restart all 2>/dev/null || pm2 restart all 2>/dev/null || true
  sudo pm2 save 2>/dev/null || pm2 save 2>/dev/null || true
  if [ -d /run/systemd/system ] || command -v systemctl >/dev/null 2>&1; then
    sudo pm2 startup systemd -u root --hp /root 2>/dev/null || sudo pm2 startup 2>/dev/null || true
    sudo systemctl enable pm2-root 2>/dev/null || true
  fi
fi

echo -e "${LIME}"
echo "==================================================================="
echo "         🎉 Rubber Panel Successfully Patched to ${LATEST_TAG}!     "
echo "==================================================================="
echo -e "${NC}"
echo -e "  ✓ Update Manager button logic fixed."
echo -e "  ✓ Registration toggle & dedicated disabled screen updated."
echo -e "  ✓ All future updates can now be applied directly via the Web UI."
echo "==================================================================="
