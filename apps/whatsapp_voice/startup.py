#!/usr/bin/env python3
"""
startup.py — Production startup script with health checks, dependency validation,
and audio cache cleanup.
"""
import os
import sys
import glob
import time
import logging
from pathlib import Path

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def check_environment():
    """Validate all required environment variables are set."""
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
        logger.error("Missing required environment variables:\n  - " + "\n  - ".join(missing))
        raise ValueError("Environment validation failed")

    logger.info("✓ All required environment variables are set")


def check_dependencies():
    """Verify all required Python packages are installed."""
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
    """Ensure database is initialized and reachable."""
    try:
        from db.database import init_db
        init_db()
        logger.info("✓ Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise


def cleanup_audio_cache(max_age_seconds: int = 3600):
    """
    Remove TTS MP3 files older than `max_age_seconds` from audio_cache/.

    Each inbound call turn generates one MP3 file; without cleanup the directory
    grows unboundedly. Default TTL is 1 hour — safe for any call that could
    realistically still be in progress.
    """
    audio_dir = os.path.join(os.path.dirname(__file__), "audio_cache")
    if not os.path.isdir(audio_dir):
        logger.info("audio_cache/ not found — skipping cleanup")
        return

    now = time.time()
    removed = 0
    errors = 0
    for mp3_path in glob.glob(os.path.join(audio_dir, "*.mp3")):
        try:
            if now - os.path.getmtime(mp3_path) > max_age_seconds:
                os.remove(mp3_path)
                removed += 1
        except OSError as exc:
            logger.warning(f"Could not remove {mp3_path}: {exc}")
            errors += 1

    logger.info(
        f"✓ Audio cache cleanup: removed {removed} file(s)"
        + (f" ({errors} error(s))" if errors else "")
    )


def main():
    """Run all startup checks."""
    logger.info("=" * 60)
    logger.info("Aranya.ai Production Startup")
    logger.info("=" * 60)

    try:
        logger.info("\n[1/4] Checking environment variables...")
        check_environment()

        logger.info("\n[2/4] Checking dependencies...")
        check_dependencies()

        logger.info("\n[3/4] Initializing database...")
        check_database()

        logger.info("\n[4/4] Cleaning up audio cache...")
        cleanup_audio_cache()

        logger.info("\n" + "=" * 60)
        logger.info("✓ All startup checks passed!")
        logger.info("=" * 60)
        return 0

    except Exception as e:
        logger.error(f"\n✗ Startup failed: {e}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
