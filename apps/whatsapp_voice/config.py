"""
config.py — Centralised environment configuration for Aranya WhatsApp + Voice service.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Twilio
TWILIO_ACCOUNT_SID     = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN      = os.getenv("TWILIO_AUTH_TOKEN",  "")
TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
TWILIO_PHONE_NUMBER    = os.getenv("TWILIO_PHONE_NUMBER", "")

# Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Public URL for Twilio webhooks
PUBLIC_URL = os.getenv("PUBLIC_URL", "").rstrip("/")

# Optional live data APIs
DATA_GOV_API_KEY   = os.getenv("DATA_GOV_API_KEY", "")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")

# Audio files served to Twilio during calls
AUDIO_DIR = os.path.join(os.path.dirname(__file__), "audio_cache")
os.makedirs(AUDIO_DIR, exist_ok=True)
