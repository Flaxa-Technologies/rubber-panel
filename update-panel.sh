#!/usr/bin/env bash
# ==============================================================================
#  Rubber Panel — 1-Click Update & Hotfix Patch Script
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

if [ "$EUID" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    if [ -f "$0" ] && [ "$0" != "bash" ] && [ "$0" != "-bash" ] && [ "$0" != "sh" ]; then
      exec sudo bash "$0" "$@"
    else
      echo -e "${YELLOW}[Notice] Root privileges required to update files in /var/www/rubber-panel.${NC}"
      echo -e "${GREEN}Please run with sudo:${NC}"
      echo -e "  ${CYAN}curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/update-panel.sh | sudo bash${NC}\n"
      exit 1
    fi
  else
    echo -e "${RED}[Error] Please run this script as root or with sudo.${NC}"
    exit 1
  fi
fi

# Check if running on a standalone node compute machine
if [ ! -d "/var/www/rubber-panel/admin-side" ] && [ ! -d "./admin-side" ] && [ ! -d "/workspaces/rubber-panel/admin-side" ]; then
  if [ -d "/var/rubber-panel/node-daemon" ] || [ -d "/workspaces/rubber-panel/node-side" ] || [ -d "./node-side" ]; then
    echo -e "${CYAN}Detected Node Compute installation. Delegating to node update...${NC}"
    curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/update-node.sh | sudo bash
    exit 0
  fi
fi

INSTALL_DIR="/var/www/rubber-panel"
if [ ! -d "${INSTALL_DIR}/admin-side" ]; then
  if [ -d "./admin-side" ]; then
    INSTALL_DIR="$(pwd)"
  elif [ -d "/workspaces/rubber-panel/admin-side" ]; then
    INSTALL_DIR="/workspaces/rubber-panel"
  else
    echo -e "${RED}[Error] Could not locate rubber-panel installation.${NC}"
    exit 1
  fi
fi

if [ -n "$1" ] && [ -d "$1/admin-side" ]; then
  INSTALL_DIR="$1"
fi

echo -e "${CYAN}[1/5] Target Installation: ${INSTALL_DIR}${NC}"
REPO="Flaxa-Technologies/rubber-panel"

LATEST_TAG=$(git ls-remote --tags --sort="v:refname" "https://github.com/${REPO}.git" 2>/dev/null | tail -n 1 | sed 's/.*\///' | tr -d ' \n\r')
if [ -z "${LATEST_TAG}" ]; then
  LATEST_TAG=$(curl -s "https://github.com/${REPO}/releases.atom" 2>/dev/null | grep -o '<id>tag:github.com[^<]*' | head -n 1 | sed 's/.*\///')
fi
if [ -z "${LATEST_TAG}" ]; then
  LATEST_TAG="v0.1.0-beta.61"
fi
echo -e "${GREEN}✓ Applying Release: ${LATEST_TAG}${NC}"

ADMIN_ENV_BAK=""
USER_ENV_BAK=""
if [ -f "${INSTALL_DIR}/admin-side/.env" ]; then
  ADMIN_ENV_BAK=$(cat "${INSTALL_DIR}/admin-side/.env")
fi
if [ -f "${INSTALL_DIR}/user-side/.env" ]; then
  USER_ENV_BAK=$(cat "${INSTALL_DIR}/user-side/.env")
fi

TEMP_DIR=$(mktemp -d)
cd "${TEMP_DIR}"

ADMIN_ZIP="https://github.com/${REPO}/releases/download/${LATEST_TAG}/admin-side.zip"
USER_ZIP="https://github.com/${REPO}/releases/download/${LATEST_TAG}/user-side.zip"

echo -e "${CYAN}[2/5] Downloading package assets...${NC}"
curl -sL "${ADMIN_ZIP}" -o admin-side.zip || true
curl -sL "${USER_ZIP}" -o user-side.zip || true

if [ -f admin-side.zip ] && [ -s admin-side.zip ]; then
  unzip -qo admin-side.zip -d "${INSTALL_DIR}/admin-side"
  rm -f admin-side.zip
else
  git clone --depth 1 "https://github.com/${REPO}.git" repo-clone
  cp -r repo-clone/admin-side/* "${INSTALL_DIR}/admin-side/" 2>/dev/null || true
  cp -r repo-clone/user-side/* "${INSTALL_DIR}/user-side/" 2>/dev/null || true
fi

if [ -f user-side.zip ] && [ -s user-side.zip ]; then
  unzip -qo user-side.zip -d "${INSTALL_DIR}/user-side"
  rm -f user-side.zip
fi

# Restore production .env files so credentials, tokens, and database paths are 100% preserved
if [ -n "${ADMIN_ENV_BAK}" ]; then
  echo "${ADMIN_ENV_BAK}" > "${INSTALL_DIR}/admin-side/.env"
fi
if [ -n "${USER_ENV_BAK}" ]; then
  echo "${USER_ENV_BAK}" > "${INSTALL_DIR}/user-side/.env"
fi

rm -rf "${TEMP_DIR}"

echo -e "${CYAN}[3/5] Compiling Admin Panel...${NC}"
cd "${INSTALL_DIR}/admin-side"
npm install --include=dev --prefer-offline --no-audit --no-fund
npx prisma generate
npx prisma db push --skip-generate
rm -rf .next
npm run build

echo -e "${CYAN}[4/5] Compiling User Panel...${NC}"
cd "${INSTALL_DIR}/user-side"
npm install --include=dev --prefer-offline --no-audit --no-fund
rm -rf .next
npm run build

echo -e "${CYAN}[5/5] Reloading PM2 processes...${NC}"
if command -v pm2 >/dev/null 2>&1; then
  sudo pm2 restart all 2>/dev/null || pm2 restart all 2>/dev/null || true
fi

echo -e "${LIME}"
echo "==================================================================="
echo "         🎉 Rubber Panel Successfully Patched to ${LATEST_TAG}!     "
echo "==================================================================="
echo -e "${NC}"
