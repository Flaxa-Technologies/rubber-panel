#!/usr/bin/env bash
# ==============================================================================
# Rubber Panel — 1-Click MySQL / MariaDB Database Engine Setup & Repair
# ==============================================================================
set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Please run this script with sudo or as root.${NC}"
  exit 1
fi

echo -e "${CYAN}===================================================================${NC}"
echo -e "${CYAN}        Rubber Panel — MySQL / MariaDB Server Setup & Repair       ${NC}"
echo -e "${CYAN}===================================================================${NC}"
echo ""

# 1. Install MariaDB Server
echo -e "${CYAN}[1/4] Checking and installing MariaDB server...${NC}"
apt-get update -qq
apt-get install -y -qq mariadb-server mariadb-client

# 2. Fix Directory Permissions & Sockets
echo -e "${CYAN}[2/4] Initializing socket directories and file permissions...${NC}"
mkdir -p /var/run/mysqld
chown -R mysql:mysql /var/run/mysqld /var/lib/mysql
chmod 777 /var/run/mysqld

# 3. Configure MariaDB to listen on all interfaces (bind-address = 0.0.0.0)
echo -e "${CYAN}[3/4] Configuring network listening on port 3306...${NC}"
for cnf in /etc/mysql/mariadb.conf.d/50-server.cnf /etc/mysql/my.cnf /etc/mysql/mysql.conf.d/mysqld.cnf; do
  if [ -f "$cnf" ]; then
    sed -i 's/^bind-address\s*=.*/bind-address = 0.0.0.0/' "$cnf" 2>/dev/null || true
  fi
done

# Restart MariaDB
systemctl daemon-reload
systemctl enable --now mariadb
systemctl restart mariadb

# 4. Provision Dedicated Rubber Admin User
echo -e "${CYAN}[4/4] Provisioning Rubber Panel database administrative user...${NC}"

# Generate secure 20-character password
MYSQL_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 20)

mysql -u root <<EOF
CREATE USER IF NOT EXISTS 'rubber'@'%' IDENTIFIED BY '${MYSQL_PASS}';
ALTER USER 'rubber'@'%' IDENTIFIED BY '${MYSQL_PASS}';
GRANT ALL PRIVILEGES ON *.* TO 'rubber'@'%' WITH GRANT OPTION;

CREATE USER IF NOT EXISTS 'rubber'@'localhost' IDENTIFIED BY '${MYSQL_PASS}';
ALTER USER 'rubber'@'localhost' IDENTIFIED BY '${MYSQL_PASS}';
GRANT ALL PRIVILEGES ON *.* TO 'rubber'@'localhost' WITH GRANT OPTION;

-- Also repair root access for local tools
ALTER USER 'root'@'localhost' IDENTIFIED VIA mysql_native_password USING PASSWORD('${MYSQL_PASS}');
GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost' WITH GRANT OPTION;

FLUSH PRIVILEGES;
EOF

# Allow port 3306 in UFW if firewall is active
if command -v ufw >/dev/null 2>&1; then
  ufw allow 3306/tcp >/dev/null 2>&1 || true
fi

SERVER_IP=$(curl -s -4 ifconfig.me || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}===================================================================${NC}"
echo -e "${GREEN}     MySQL / MariaDB Server Ready for Rubber Panel!                ${NC}"
echo -e "${GREEN}===================================================================${NC}"
echo -e "Host Endpoint : ${CYAN}${SERVER_IP}${NC} (or ${CYAN}127.0.0.1${NC} if Panel is on this VPS)"
echo -e "Port          : ${CYAN}3306${NC}"
echo -e "Username      : ${CYAN}rubber${NC}"
echo -e "Password      : ${GREEN}${MYSQL_PASS}${NC}"
echo ""
echo -e "Copy these credentials into ${CYAN}Admin Panel > Databases${NC} to immediately"
echo -e "enable one-click MySQL provisioning for all Minecraft and game servers!"
echo -e "${GREEN}===================================================================${NC}"
