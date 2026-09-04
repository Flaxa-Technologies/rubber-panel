#!/usr/bin/env bash
# ==============================================================================
#  Rubber Panel — Compute Node Daemon Uninstaller
#  Completely stops and removes the node daemon from the VPS.
# ==============================================================================

set -e

RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
CYAN="\033[0;36m"
NC="\033[0m"

echo -e "${RED}"
echo "==================================================================="
echo "           Rubber Panel — Node Daemon Uninstaller                  "
echo "==================================================================="
echo -e "${NC}"

if [ "$(id -u)" -ne 0 ]; then
  echo -e "${RED}[Error] This script must be run as root (sudo bash uninstall-node.sh)${NC}"
  exit 1
fi

echo -e "${CYAN}[1/5] Stopping and removing rubber-node from PM2...${NC}"
if command -v pm2 >/dev/null 2>&1; then
  pm2 stop rubber-node 2>/dev/null || true
  pm2 delete rubber-node 2>/dev/null || true
  pm2 save --force 2>/dev/null || true
fi

echo -e "${CYAN}[2/5] Cleaning up PM2 logs...${NC}"
rm -f /root/.pm2/logs/rubber-node* ~/.pm2/logs/rubber-node* 2>/dev/null || true

echo -e "${CYAN}[3/5] Terminating any remaining daemon processes on port 3001 and SFTP 2022...${NC}"
if command -v fuser >/dev/null 2>&1; then
  fuser -k 3001/tcp 2>/dev/null || true
  fuser -k 2022/tcp 2>/dev/null || true
fi

echo -e "${CYAN}[4/5] Removing daemon files at /var/rubber-panel/node-daemon...${NC}"
rm -rf /var/rubber-panel/node-daemon

# Check if user passed --purge-all to also delete all server worlds and data
if [ "$1" == "--purge-all" ] || [ "$1" == "--all" ]; then
  echo -e "${YELLOW}[Notice] Purging all server containers and /var/rubber-panel/servers...${NC}"
  if command -v docker >/dev/null 2>&1; then
    docker ps -q --filter "name=rp_" | xargs -r docker stop 2>/dev/null || true
    docker ps -aq --filter "name=rp_" | xargs -r docker rm -f 2>/dev/null || true
  fi
  rm -rf /var/rubber-panel
  echo -e "${GREEN}✓ All server data purged.${NC}"
else
  echo -e "${YELLOW}Preserved /var/rubber-panel/servers (use --purge-all flag if you also want to wipe server files).${NC}"
fi

echo -e "${GREEN}"
echo "==================================================================="
echo "         ✓ Rubber Node Daemon has been completely uninstalled!      "
echo "==================================================================="
echo -e "${NC}"
