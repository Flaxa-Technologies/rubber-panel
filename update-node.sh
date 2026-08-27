#!/usr/bin/env bash
# ==============================================================================
#  Rubber Panel — 1-Click Node Daemon Updater Script
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
echo "              Rubber Node Daemon — 1-Click Updater                 "
echo "==================================================================="
echo -e "${NC}"

INSTALL_DIR="/var/rubber-panel/node-daemon"
if [ ! -d "${INSTALL_DIR}" ]; then
  if [ -d "/workspaces/rubber-panel/node-side" ]; then
    INSTALL_DIR="/workspaces/rubber-panel/node-side"
  elif [ -d "./node-side" ]; then
    INSTALL_DIR="$(pwd)/node-side"
  elif [ -f "./package.json" ] && grep -q "node-side" package.json 2>/dev/null; then
    INSTALL_DIR="$(pwd)"
  else
    echo -e "${RED}[Error] Could not locate Node Daemon installation.${NC}"
    exit 1
  fi
fi

echo -e "${CYAN}[1/4] Target Node Directory: ${INSTALL_DIR}${NC}"
REPO="Flaxa-Technologies/rubber-panel"

LATEST_TAG=$(git ls-remote --tags --sort="v:refname" "https://github.com/${REPO}.git" 2>/dev/null | tail -n 1 | sed 's/.*\///' | tr -d ' \n\r')
if [ -z "${LATEST_TAG}" ]; then
  LATEST_TAG=$(curl -s "https://github.com/${REPO}/releases.atom" 2>/dev/null | grep -o '<id>tag:github.com[^<]*' | head -n 1 | sed 's/.*\///')
fi
if [ -z "${LATEST_TAG}" ]; then
  LATEST_TAG="v0.1.0-beta.21"
fi
echo -e "${GREEN}✓ Targeted Release: ${LATEST_TAG}${NC}"

TEMP_DIR=$(mktemp -d)
cd "${TEMP_DIR}"
NODE_ZIP="https://github.com/${REPO}/releases/download/${LATEST_TAG}/node-side.zip"

echo -e "${CYAN}[2/4] Downloading latest node daemon package...${NC}"
curl -sSL "${NODE_ZIP}" -o node-side.zip || true

if [ -f node-side.zip ] && [ -s node-side.zip ]; then
  unzip -qo node-side.zip -d "${INSTALL_DIR}"
  rm -f node-side.zip
else
  git clone --depth 1 "https://github.com/${REPO}.git" repo-clone
  cp -r repo-clone/node-side/* "${INSTALL_DIR}/" 2>/dev/null || true
fi

rm -rf "${TEMP_DIR}"

if command -v pm2 >/dev/null 2>&1; then
  sudo pm2 stop rubber-node 2>/dev/null || pm2 stop rubber-node 2>/dev/null || true
fi

echo -e "${CYAN}[3/4] Compiling and building Node Daemon...${NC}"
cd "${INSTALL_DIR}"
npm install --include=dev --prefer-offline --no-audit --no-fund
npm run build

echo -e "${CYAN}[4/4] Reloading Rubber Node process...${NC}"
if command -v pm2 >/dev/null 2>&1; then
  sudo pm2 start "${INSTALL_DIR}/ecosystem.config.js" 2>/dev/null || pm2 start "${INSTALL_DIR}/ecosystem.config.js" 2>/dev/null || (
    sudo pm2 restart rubber-node --update-env 2>/dev/null || pm2 restart rubber-node --update-env 2>/dev/null || true
  )
  sudo pm2 save 2>/dev/null || pm2 save 2>/dev/null || true
fi

echo -e "${LIME}"
echo "==================================================================="
echo "     🎉 Rubber Node Daemon Successfully Updated to ${LATEST_TAG}!   "
echo "==================================================================="
echo -e "${NC}"
