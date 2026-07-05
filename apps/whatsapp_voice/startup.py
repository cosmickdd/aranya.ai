#!/usr/bin/env python3
"""
startup.py — Production startup script with health checks and dependency validation
"""
import os
import sys
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def check_environment():
    """Validate all required environment variables are set"""
    required = {
        'TWILIO_ACCOUNT_SID': 'Twilio Account SID',
        'TWILIO_AUTH_TOKEN': 'Twilio Auth Token',
        'TWILIO_PHONE_NUMBER': 'Twilio Phone Number',
        'GEMINI_API_KEY': 'Google Gemini API Key',
        'PUBLIC_URL': 'Public URL for webhooks',
    }
    
    missing = []
    for var, desc in required.items():
        if not os.getenv(var):
            missing.append(f"{var} ({desc})")
    
    if missing:
        logger.error(f"Missing required environment variables:\n  - " + "\n  - ".join(missing))
        raise ValueError("Environment validation failed")
    
    logger.info("✓ All required environment variables are set")

def check_dependencies():
    """Verify all required Python packages are installed"""
    required_modules = [
        'flask',
        'twilio',
        'google.genai',
        'dotenv',
        'sqlalchemy',
        'gtts',
    ]
    
    missing = []
    for module in required_modules:
        try:
            __import__(module)
        except ImportError:
            missing.append(module)
    
    if missing:
        logger.error(f"Missing required Python packages: {', '.join(missing)}")
        raise ImportError("Dependency check failed")
    
    logger.info("✓ All required Python packages are installed")

def check_database():
    """Ensure database is initialized"""
    try:
        from db.database import init_db
        init_db()
        logger.info("✓ Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise

def main():
    """Run all startup checks"""
    logger.info("=" * 60)
    logger.info("Aranya.ai Production Startup")
    logger.info("=" * 60)
    
    try:
        logger.info("\n[1/3] Checking environment variables...")
        check_environment()
        
        logger.info("\n[2/3] Checking dependencies...")
        check_dependencies()
        
        logger.info("\n[3/3] Initializing database...")
        check_database()
        
        logger.info("\n" + "=" * 60)
        logger.info("✓ All startup checks passed!")
        logger.info("=" * 60)
        return 0
        
    except Exception as e:
        logger.error(f"\n✗ Startup failed: {e}")
        return 1

if __name__ == '__main__':
    sys.exit(main())
