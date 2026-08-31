#!/usr/bin/env bash
# ==============================================================================
#  Rubber Panel — 1-Click Automated Repair & Auto-Configurator
#  Automatically detects Host IP, fixes .env, repairs Prisma, & restarts PM2
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
echo "           Rubber Panel — 1-Click Automated Panel Repair           "
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

INSTALL_DIR="/var/www/rubber-panel"
if [ ! -d "${INSTALL_DIR}/admin-side" ]; then
  if [ -d "./admin-side" ]; then
    INSTALL_DIR="$(pwd)"
  elif [ -d "/workspaces/rubber-panel/admin-side" ]; then
    INSTALL_DIR="/workspaces/rubber-panel"
  else
    echo -e "${RED}[Error] Could not find Rubber Panel at /var/www/rubber-panel.${NC}"
    exit 1
  fi
fi

echo -e "${CYAN}[1/5] Detecting Server IP & Network Interfaces...${NC}"
SERVER_IP=""
if [ -n "$1" ]; then
  SERVER_IP="$1"
fi

if [ -z "${SERVER_IP}" ]; then
  # Try detecting local LAN IP first (e.g. 192.168.x.x, 10.x.x.x)
  SERVER_IP=$(ip -4 addr show scope global 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '^127\.' | head -n 1 || true)
fi

if [ -z "${SERVER_IP}" ]; then
  # Try public IP
  SERVER_IP=$(curl -s -4 --max-time 3 ifconfig.me 2>/dev/null || curl -s -4 --max-time 3 icanhazip.com 2>/dev/null || true)
fi

if [ -z "${SERVER_IP}" ]; then
  SERVER_IP="localhost"
fi

echo -e "${GREEN}✓ Auto-detected Server Address: ${CYAN}${SERVER_IP}${NC}"

# Read or Generate Secrets
ADMIN_ENV="${INSTALL_DIR}/admin-side/.env"
USER_ENV="${INSTALL_DIR}/user-side/.env"

SECRET=""
if [ -f "${ADMIN_ENV}" ]; then
  SECRET=$(grep '^NEXTAUTH_SECRET=' "${ADMIN_ENV}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' \r\n' || true)
fi
if [ -z "${SECRET}" ] || [ "${SECRET}" = "dev-nextauth-secret-change-in-production-123456789" ]; then
  SECRET=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
fi

INTERNAL_SECRET=""
if [ -f "${ADMIN_ENV}" ]; then
  INTERNAL_SECRET=$(grep '^INTERNAL_API_SECRET=' "${ADMIN_ENV}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' \r\n' || true)
fi
if [ -z "${INTERNAL_SECRET}" ] || [ "${INTERNAL_SECRET}" = "rubber-panel-internal-secret" ]; then
  INTERNAL_SECRET=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
fi

echo -e "${CYAN}[2/5] Repairing Environment Configurations (.env)...${NC}"

# Fix admin-side .env
cat <<EOF > "${ADMIN_ENV}"
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="${SECRET}"
NEXTAUTH_URL="http://${SERVER_IP}:3000"
NEXTAUTH_TRUST_HOST=true
AUTH_TRUST_HOST=true
NEXT_PUBLIC_APP_URL="http://${SERVER_IP}:3000"
NEXT_PUBLIC_APP_NAME="Rubber Panel"
NODE_WEBHOOK_SECRET="${SECRET}"
INTERNAL_API_SECRET="${INTERNAL_SECRET}"
GITHUB_REPO="Flaxa-Technologies/rubber-panel"
NODE_ENV="production"
PORT=3000
EOF
echo -e "${GREEN}✓ Admin environment configured (http://${SERVER_IP}:3000)${NC}"

# Fix user-side .env
cat <<EOF > "${USER_ENV}"
NEXTAUTH_SECRET="${SECRET}"
NEXTAUTH_URL="http://${SERVER_IP}:3002"
NEXTAUTH_TRUST_HOST=true
AUTH_TRUST_HOST=true
NEXT_PUBLIC_APP_URL="http://${SERVER_IP}:3002"
NEXT_PUBLIC_APP_NAME="Rubber Panel"
ADMIN_API_URL="http://localhost:3000"
INTERNAL_API_SECRET="${INTERNAL_SECRET}"
GITHUB_REPO="Flaxa-Technologies/rubber-panel"
NODE_ENV="production"
PORT=3002
EOF
echo -e "${GREEN}✓ User environment configured (http://${SERVER_IP}:3002)${NC}"

echo -e "${CYAN}[3/5] Synchronizing Prisma Database Engine...${NC}"
cd "${INSTALL_DIR}/admin-side"
npx prisma generate
npx prisma db push --skip-generate

echo -e "${CYAN}[4/5] Inspecting Database for Configured Nodes...${NC}"
FIRST_NODE_ID=$(node -e "
try {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  prisma.node.findFirst().then(n => {
    if (n) console.log(n.id + '|' + n.authToken + '|' + n.name);
    else console.log('NONE');
    process.exit(0);
  }).catch(() => { console.log('NONE'); process.exit(0); });
} catch { console.log('NONE'); }
" 2>/dev/null || echo "NONE")

if [ "${FIRST_NODE_ID}" != "NONE" ] && [ -n "${FIRST_NODE_ID}" ]; then
  NODE_ID_VAL=$(echo "${FIRST_NODE_ID}" | cut -d'|' -f1)
  NODE_TOK_VAL=$(echo "${FIRST_NODE_ID}" | cut -d'|' -f2)
  NODE_NAME_VAL=$(echo "${FIRST_NODE_ID}" | cut -d'|' -f3)
  echo -e "${GREEN}✓ Node Found in DB: ${CYAN}${NODE_NAME_VAL}${NC} (ID: ${NODE_ID_VAL})"

  # If node daemon is installed locally on the same VPS, repair its .env automatically!
  NODE_DAEMON_DIR="/var/rubber-panel/node-daemon"
  if [ -d "${NODE_DAEMON_DIR}" ]; then
    echo -e "${CYAN}Auto-configuring local Node Daemon at ${NODE_DAEMON_DIR}...${NC}"
    cat <<EOF > "${NODE_DAEMON_DIR}/.env"
NODE_TOKEN="${NODE_TOK_VAL}"
NODE_ID="${NODE_ID_VAL}"
ADMIN_API_URL="http://${SERVER_IP}:3000"
AGENT_PORT=3001
PORT=3001
HEARTBEAT_INTERVAL_SECONDS=30
SERVER_DATA_DIR="./server-data"
EOF
    echo -e "${GREEN}✓ Local Node Daemon .env automatically reconnected!${NC}"
    if command -v pm2 >/dev/null 2>&1; then
      pm2 restart rubber-node --update-env 2>/dev/null || true
    fi
  fi
fi

echo -e "${CYAN}[5/5] Compiling Next.js Production Builds...${NC}"
echo -e "${YELLOW}Building Admin Portal (this takes ~15-20 seconds)...${NC}"
cd "${INSTALL_DIR}/admin-side"
rm -rf .next
npm run build

echo -e "${YELLOW}Building User Portal (this takes ~15-20 seconds)...${NC}"
cd "${INSTALL_DIR}/user-side"
rm -rf .next
npm run build

echo -e "${CYAN}Reloading PM2 Services with updated environment...${NC}"
if command -v pm2 >/dev/null 2>&1; then
  sudo pm2 restart all --update-env 2>/dev/null || pm2 restart all --update-env 2>/dev/null || true
  sudo pm2 save 2>/dev/null || pm2 save 2>/dev/null || true
fi

echo -e "${LIME}"
echo "==================================================================="
echo "   🎉 Rubber Panel Successfully Repaired and Online!               "
echo "==================================================================="
echo -e "${NC}"
echo -e "  • Admin Portal: ${GREEN}http://${SERVER_IP}:3000${NC}"
echo -e "  • User Portal:  ${GREEN}http://${SERVER_IP}:3002${NC}"
if [ "${FIRST_NODE_ID}" != "NONE" ] && [ -n "${FIRST_NODE_ID}" ]; then
  echo -e "  • Node ID:      ${CYAN}${NODE_ID_VAL}${NC}"
  echo -e "  • Node Token:   ${CYAN}${NODE_TOK_VAL}${NC}"
fi
echo -e "===================================================================\n"
