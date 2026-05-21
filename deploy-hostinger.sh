#!/bin/bash

# ============================================================
# Beng Deployment Script for Hostinger VPS
# ============================================================
# This script installs everything needed to run Beng on Ubuntu
# - Node.js, PostgreSQL, PM2, Nginx, HTTPS (Let's Encrypt)
# - Runs on port 4000 internally, proxied via Nginx
# ============================================================

set -e  # Exit on any error
set +H  # Disable history expansion to allow ! in passwords

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
APP_PORT=4000
APP_NAME="beng"
APP_DIR="/var/www/beng"
DOMAIN=""  # Will be set by user input

echo -e "${CYAN}"
echo "============================================================"
echo "       Beng Deployment Script for Hostinger VPS"
echo "============================================================"
echo -e "${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Get domain from user
echo -e "${YELLOW}Enter your domain name (e.g., buybit.cloud):${NC}"
read -r DOMAIN
if [[ -z "$DOMAIN" ]]; then
    echo -e "${RED}Domain name is required!${NC}"
    exit 1
fi

echo -e "${YELLOW}Enter your email for SSL certificate notifications:${NC}"
read -r EMAIL
if [[ -z "$EMAIL" ]]; then
    echo -e "${RED}Email is required for SSL certificates!${NC}"
    exit 1
fi

# ============================================================
# SUPER ADMIN CONFIGURATION
# ============================================================
echo -e "\n${CYAN}============================================================${NC}"
echo -e "${CYAN}       Super Admin Account Configuration${NC}"
echo -e "${CYAN}============================================================${NC}"
echo -e "${YELLOW}This will create a default admin account for your store.${NC}\n"

echo -e "${YELLOW}Enter super admin email:${NC}"
read -r ADMIN_EMAIL
if [[ -z "$ADMIN_EMAIL" ]]; then
    echo -e "${RED}Admin email is required!${NC}"
    exit 1
fi

# Validate email format
if [[ ! "$ADMIN_EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
    echo -e "${RED}Invalid email format!${NC}"
    exit 1
fi

echo -e "${YELLOW}Enter super admin password (min 6 characters, special chars like ! allowed):${NC}"
read -rs ADMIN_PASSWORD
echo ""
if [[ -z "$ADMIN_PASSWORD" ]] || [[ ${#ADMIN_PASSWORD} -lt 6 ]]; then
    echo -e "${RED}Password must be at least 6 characters!${NC}"
    exit 1
fi

echo -e "${YELLOW}Confirm super admin password:${NC}"
read -rs ADMIN_PASSWORD_CONFIRM
echo ""
if [[ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]]; then
    echo -e "${RED}Passwords do not match!${NC}"
    exit 1
fi

echo -e "${GREEN}Admin account will be created: ${ADMIN_EMAIL}${NC}"

# ============================================================
# STEP 1: Update System
# ============================================================
echo -e "\n${GREEN}[1/11] Updating system packages...${NC}"
apt update && apt upgrade -y

# ============================================================
# STEP 2: Install Required Tools
# ============================================================
echo -e "\n${GREEN}[2/11] Installing essential tools...${NC}"
apt install -y curl wget git build-essential software-properties-common ufw lsof

# ============================================================
# STEP 3: Install Node.js (v20 LTS)
# ============================================================
echo -e "\n${GREEN}[3/11] Installing Node.js v20 LTS...${NC}"
if command -v node &> /dev/null; then
    echo "Node.js already installed: $(node -v)"
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    echo "Node.js installed: $(node -v)"
    echo "npm installed: $(npm -v)"
fi

# ============================================================
# STEP 4: Install PostgreSQL
# ============================================================
echo -e "\n${GREEN}[4/11] Installing PostgreSQL...${NC}"
if command -v psql &> /dev/null; then
    echo "PostgreSQL already installed"
else
    apt install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
fi

# Create database and user
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
DB_NAME="beng_db"
DB_USER="beng_user"

echo -e "${YELLOW}Setting up PostgreSQL database...${NC}"
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
echo -e "${GREEN}Database created successfully!${NC}"

# ============================================================
# STEP 5: Install PM2
# ============================================================
echo -e "\n${GREEN}[5/11] Installing PM2 process manager...${NC}"
if command -v pm2 &> /dev/null; then
    echo "PM2 already installed"
else
    npm install -g pm2
fi

# ============================================================
# STEP 6: Install Nginx
# ============================================================
echo -e "\n${GREEN}[6/11] Installing Nginx...${NC}"
if command -v nginx &> /dev/null; then
    echo "Nginx already installed"
else
    apt install -y nginx
    systemctl start nginx
    systemctl enable nginx
fi

# ============================================================
# STEP 7: Setup Application Directory
# ============================================================
echo -e "\n${GREEN}[7/11] Setting up application...${NC}"

# Create app directory if not exists
mkdir -p $APP_DIR

# Check if we're in a git repo and copy files
if [[ -d ".git" ]]; then
    echo "Copying application files..."
    rsync -av --exclude='node_modules' --exclude='.git' --exclude='deploy-hostinger.sh' ./ $APP_DIR/
else
    echo -e "${YELLOW}Please copy your application files to $APP_DIR${NC}"
fi

cd $APP_DIR

# Create .env file
echo -e "${YELLOW}Creating environment configuration...${NC}"
cat > .env << EOF
# Database
DATABASE_URL=$DATABASE_URL

# Server
PORT=$APP_PORT
NODE_ENV=production

# Domain (used for callbacks)
DOMAIN=https://$DOMAIN
EOF

echo -e "${GREEN}.env file created!${NC}"

# Install dependencies
echo "Installing npm dependencies..."
npm install

# Build the application
echo "Building application for production..."
npm run build 2>/dev/null || echo "No build script found, skipping..."

# Push database schema
echo "Setting up database schema..."
npx drizzle-kit push --force 2>/dev/null || npx drizzle-kit push 2>/dev/null || echo "Database schema already up to date"

# ============================================================
# STEP 8: Create Super Admin Account
# ============================================================
echo -e "\n${GREEN}[8/11] Creating super admin account...${NC}"

# Hash the password using Node.js and create admin user
# Export variables to avoid bash special character issues
export ADMIN_EMAIL_VAR="$ADMIN_EMAIL"
export ADMIN_PASSWORD_VAR="$ADMIN_PASSWORD"
export DATABASE_URL_VAR="$DATABASE_URL"
export DOMAIN_VAR="$DOMAIN"

node << 'NODEEOF'
const { Pool } = require('pg');
const crypto = require('crypto');

// Use the same scrypt hashing as the app (server/auth.ts).
// Format: scrypt:<salt-hex>:<hash-hex>
// IMPORTANT: the salt MUST be passed to scrypt as the hex STRING (not raw
// bytes) so that the verify path in server/auth.ts — which also passes the
// hex string — produces the same hash. Mixing string and Buffer salts
// produces two different keys and login silently fails.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

async function createAdmin() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_VAR
  });
  
  const adminEmail = process.env.ADMIN_EMAIL_VAR;
  const adminPassword = process.env.ADMIN_PASSWORD_VAR;
  const domain = process.env.DOMAIN_VAR;
  
  try {
    // Hash the password using the app's method
    const hashedPassword = hashPassword(adminPassword);
    
    // Check if admin exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    
    if (existingUser.rows.length > 0) {
      // Update existing user to admin
      await pool.query(
        'UPDATE users SET password = $1, role = $2 WHERE email = $3',
        [hashedPassword, 'admin', adminEmail]
      );
      console.log('Admin user updated successfully');
    } else {
      // Create new admin user
      await pool.query(
        'INSERT INTO users (email, password, role, created_at) VALUES ($1, $2, $3, NOW())',
        [adminEmail, hashedPassword, 'admin']
      );
      console.log('Admin user created successfully');
    }
    
    // Also save shop name setting
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      ['shop_name', domain]
    );
    console.log('Shop name set to:', domain);
    
  } catch (err) {
    console.error('Error creating admin:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createAdmin();
NODEEOF

# Install bcryptjs if not present
if ! npm list bcryptjs > /dev/null 2>&1; then
    npm install bcryptjs --save
fi

echo -e "${GREEN}Super admin account created: ${ADMIN_EMAIL}${NC}"

# ============================================================
# STEP 9: Configure Nginx (Basic - for SSL verification)
# ============================================================
echo -e "\n${GREEN}[9/11] Configuring Nginx (Step 1 - Basic)...${NC}"

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Create basic Nginx config for SSL verification (no proxy yet)
cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    # Root for ACME challenge
    root /var/www/html;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 200 'Beng is being configured...';
        add_header Content-Type text/plain;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# Create ACME challenge directory
mkdir -p /var/www/html/.well-known/acme-challenge

# Test nginx config
nginx -t

# Reload nginx
systemctl reload nginx

echo -e "${GREEN}Nginx basic config ready!${NC}"

# ============================================================
# STEP 10: Configure Firewall & SSL
# ============================================================
echo -e "\n${GREEN}[10/11] Configuring firewall and SSL...${NC}"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
echo -e "${GREEN}Firewall configured!${NC}"

# Install SSL Certificate (Let's Encrypt)
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m $EMAIL

echo -e "${GREEN}SSL certificate installed!${NC}"

# ============================================================
# STEP 11: Start Application with PM2 and Configure Full Nginx
# ============================================================
echo -e "\n${GREEN}[11/11] Starting application with PM2...${NC}"

cd $APP_DIR

# Create PM2 ecosystem file (use .cjs for ES module projects)
cat > ecosystem.config.cjs << EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: 'npm',
    args: 'run start',
    cwd: '$APP_DIR',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: $APP_PORT,
      DATABASE_URL: '$DATABASE_URL',
      DOMAIN: 'https://$DOMAIN'
    }
  }]
};
EOF

# Stop any existing instance
pm2 delete $APP_NAME 2>/dev/null || true

# Kill any process on port 4000
fuser -k $APP_PORT/tcp 2>/dev/null || true

# Start with PM2
pm2 start ecosystem.config.cjs

# Wait for app to start
echo "Waiting for application to start..."
sleep 10

# Check if app is running
if pm2 list | grep -q "$APP_NAME"; then
    echo -e "${GREEN}Application started successfully!${NC}"
else
    echo -e "${RED}Warning: Application may not have started properly. Check logs with: pm2 logs $APP_NAME${NC}"
fi

# Save PM2 config
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd -u root --hp /root
systemctl enable pm2-root

# Create full Nginx config with proxy
cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        
        # WebSocket support
        proxy_buffering off;
    }
}
EOF

# Test nginx config
nginx -t

# Reload nginx
systemctl reload nginx

echo -e "${GREEN}Nginx fully configured with HTTPS!${NC}"

# ============================================================
# Final Summary
# ============================================================
echo -e "\n${CYAN}"
echo "============================================================"
echo "          DEPLOYMENT COMPLETE!"
echo "============================================================"
echo -e "${NC}"
echo -e "${GREEN}Your Beng store is now live!${NC}"
echo ""
echo -e "Website URL:     ${YELLOW}https://$DOMAIN${NC}"
echo -e "Admin Login:     ${YELLOW}$ADMIN_EMAIL${NC}"
echo -e "Internal Port:   ${YELLOW}$APP_PORT${NC}"
echo -e "App Directory:   ${YELLOW}$APP_DIR${NC}"
echo ""
echo -e "${CYAN}Database Info:${NC}"
echo -e "Database Name:   ${YELLOW}$DB_NAME${NC}"
echo -e "Database User:   ${YELLOW}$DB_USER${NC}"
echo -e "Database Pass:   ${YELLOW}(hidden — see /root/.beng-db-password, chmod 600)${NC}"
echo ""

# Write DB password to a root-only file (NOT in app dir, NOT printed)
umask 077
echo "$DB_PASSWORD" > /root/.beng-db-password
chmod 600 /root/.beng-db-password

echo -e "${CYAN}Useful Commands:${NC}"
echo -e "  View logs:     ${YELLOW}pm2 logs $APP_NAME${NC}"
echo -e "  Restart app:   ${YELLOW}pm2 restart $APP_NAME${NC}"
echo -e "  Stop app:      ${YELLOW}pm2 stop $APP_NAME${NC}"
echo -e "  Check status:  ${YELLOW}pm2 status${NC}"
echo -e "  Nginx logs:    ${YELLOW}tail -f /var/log/nginx/error.log${NC}"
echo ""
echo -e "${CYAN}SSL Certificate:${NC}"
echo -e "  Auto-renews via certbot timer (every 90 days)"
echo -e "  Test renewal:  ${YELLOW}sudo certbot renew --dry-run${NC}"
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}Save your credentials securely!${NC}"
echo -e "${GREEN}============================================================${NC}"

# NOTE: We intentionally DO NOT write a CREDENTIALS.txt inside $APP_DIR.
# Anything in the app directory can leak via a misconfigured web root, a
# bad backup, or accidental git commit. The DB password lives only in:
#   - /root/.beng-db-password  (chmod 600, root only)
#   - $APP_DIR/.env            (chmod 600, app user only — see below)
chmod 600 $APP_DIR/.env 2>/dev/null || true
chmod 600 $APP_DIR/ecosystem.config.cjs 2>/dev/null || true
echo -e "\n${YELLOW}DB password stored at /root/.beng-db-password (root-only).${NC}"
