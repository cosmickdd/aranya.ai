"""
wsgi_production.py — Production-grade WSGI configuration with security & monitoring
"""
import os
import sys
import logging

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

# Load environment (required for production)
from dotenv import load_dotenv
env_file = os.path.join(BASE_DIR, ".env")
if os.path.exists(env_file):
    load_dotenv(env_file)
else:
    # All env vars must be set in deployment environment (Key Vault, App Settings)
    pass

# Configure logging
logging.basicConfig(
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

# Validate critical environment variables
REQUIRED_VARS = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
    "GEMINI_API_KEY",
    "PUBLIC_URL",
]

missing = [v for v in REQUIRED_VARS if not os.getenv(v)]
if missing:
    logger.error(f"Missing required environment variables: {', '.join(missing)}")
    raise ValueError(f"Deployment failed: Missing environment variables: {', '.join(missing)}")

logger.info("Environment validation passed. Initializing database...")

# Initialize database
from db.database import init_db
try:
    init_db()
    logger.info("Database initialized successfully")
except Exception as e:
    logger.error(f"Database initialization failed: {e}")
    raise

# Import and configure Flask app
from server import app

# Apply production security headers
@app.after_request
def set_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Disable debug mode
app.config["DEBUG"] = False

logger.info("Aranya.ai production server initialized successfully")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
