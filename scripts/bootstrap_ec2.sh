#!/bin/bash
# =============================================================================
# Aranya.ai — AWS EC2 Bootstrap Script
# Run this ONCE on a fresh Ubuntu 22.04 EC2 instance after SSH'ing in.
# Usage: bash bootstrap.sh
# =============================================================================
set -e

echo ""
echo "======================================================"
echo "  Aranya.ai — AWS EC2 Setup"
echo "======================================================"

# ── System update ─────────────────────────────────────────────────────────────
echo "[1/8] Updating system..."
apt-get update -y && apt-get upgrade -y

# ── Install dependencies ──────────────────────────────────────────────────────
echo "[2/8] Installing Python 3.11, Nginx, Certbot..."
apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
    git \
    nginx \
    certbot \
    python3-certbot-nginx \
    ffmpeg \
    curl \
    unzip

# ── Create app user ───────────────────────────────────────────────────────────
echo "[3/8] Creating aranya system user..."
id -u aranya &>/dev/null || useradd -m -s /bin/bash aranya

# ── Clone or pull repo ────────────────────────────────────────────────────────
echo "[4/8] Setting up application directory..."
mkdir -p /opt/aranya
chown aranya:aranya /opt/aranya

if [ -d "/opt/aranya/.git" ]; then
    echo "  Repo exists — pulling latest..."
    cd /opt/aranya && git pull origin main
else
    echo "  Cloning repo..."
    # Replace with your actual GitHub URL
    git clone https://github.com/YOUR_USERNAME/Aranya.ai.git /opt/aranya
fi

cd /opt/aranya/whatsapp_voice

# ── Python environment ────────────────────────────────────────────────────────
echo "[5/8] Setting up Python virtual environment..."
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# ── Directories ───────────────────────────────────────────────────────────────
echo "[6/8] Creating required directories..."
mkdir -p /opt/aranya/whatsapp_voice/audio_cache
mkdir -p /opt/aranya/whatsapp_voice/logs
chown -R aranya:aranya /opt/aranya

# ── Systemd service ───────────────────────────────────────────────────────────
echo "[7/8] Installing systemd service..."
cat > /etc/systemd/system/aranya.service << 'EOF'
[Unit]
Description=Aranya.ai WhatsApp + Voice Server
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=aranya
WorkingDirectory=/opt/aranya/whatsapp_voice
EnvironmentFile=/opt/aranya/whatsapp_voice/.env
ExecStart=/opt/aranya/whatsapp_voice/venv/bin/waitress-serve --host=127.0.0.1 --port=5000 --threads=8 server:app
Restart=always
RestartSec=5
StandardOutput=append:/opt/aranya/whatsapp_voice/logs/aranya.log
StandardError=append:/opt/aranya/whatsapp_voice/logs/aranya_error.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable aranya

# ── Nginx config ──────────────────────────────────────────────────────────────
echo "[8/8] Configuring Nginx..."
cat > /etc/nginx/sites-available/aranya << 'NGINX'
server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;

    # Pass Twilio signature header through
    proxy_set_header X-Twilio-Signature $http_x_twilio_signature;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    # Serve audio files directly (bypass Python for speed)
    location /audio/ {
        alias /opt/aranya/whatsapp_voice/audio_cache/;
        add_header Cache-Control "public, max-age=3600";
    }

    location /health {
        proxy_pass http://127.0.0.1:5000;
        access_log off;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/aranya /etc/nginx/sites-enabled/aranya
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

echo ""
echo "======================================================"
echo "  Setup complete!"
echo ""
echo "  NEXT STEPS:"
echo "  1. Create your .env file:"
echo "     nano /opt/aranya/whatsapp_voice/.env"
echo ""
echo "  2. Start Aranya:"
echo "     systemctl start aranya"
echo "     systemctl status aranya"
echo ""
echo "  3. Add SSL (replace with your domain):"
echo "     certbot --nginx -d yourdomain.com"
echo ""
echo "  4. Check logs:"
echo "     tail -f /opt/aranya/whatsapp_voice/logs/aranya.log"
echo "======================================================"
