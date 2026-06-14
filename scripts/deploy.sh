#!/bin/bash
# =============================================================================
# Aranya.ai — Zero-Downtime Deploy Script
# Run this locally to push updates to EC2.
# Usage: bash scripts/deploy.sh
# =============================================================================
set -e

# ── Config — edit these ───────────────────────────────────────────────────────
EC2_HOST="${EC2_HOST:-your-ec2-ip-or-domain}"
EC2_USER="${EC2_USER:-ubuntu}"
SSH_KEY="${SSH_KEY:-~/.ssh/aranya_key.pem}"
APP_DIR="/opt/aranya"

echo ""
echo "======================================================"
echo "  Aranya.ai — Deploying to AWS EC2"
echo "  Host: $EC2_HOST"
echo "======================================================"

# Push latest code to GitHub first
git push origin main

# SSH into EC2 and deploy
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" << 'REMOTE'
set -e
echo "[1/4] Pulling latest code..."
cd /opt/aranya
git pull origin main

echo "[2/4] Installing dependencies..."
cd whatsapp_voice
source venv/bin/activate
pip install -r requirements.txt --quiet

echo "[3/4] Restarting Aranya service..."
systemctl restart aranya

echo "[4/4] Checking health..."
sleep 3
curl -sf http://localhost:5000/health && echo " OK" || echo " FAILED"

echo "Deploy complete!"
REMOTE
