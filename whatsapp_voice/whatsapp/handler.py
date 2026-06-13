"""
whatsapp/handler.py — Twilio WhatsApp webhook handler.

Handles incoming WhatsApp messages (text, images, voice notes).
Uses the shared Aranya AI engine to generate responses.
"""
import os
import logging
import requests
import tempfile

from flask import request
from twilio.rest import Client as TwilioClient
from twilio.request_validator import RequestValidator

from core.engine import generate_response, reset_history
from config import TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER

logger = logging.getLogger(__name__)
twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


def _send_whatsapp(to: str, body: str):
    """Send a WhatsApp text message via Twilio."""
    try:
        twilio_client.messages.create(
            from_=TWILIO_WHATSAPP_NUMBER,
            to=f"whatsapp:{to}" if not to.startswith("whatsapp:") else to,
            body=body,
        )
    except Exception as e:
        logger.error(f"WhatsApp send error: {e}")


def _download_media(media_url: str) -> bytes:
    """Download media (image/voice) from Twilio's servers."""
    try:
        resp = requests.get(
            media_url,
            auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
            timeout=15,
        )
        return resp.content
    except Exception as e:
        logger.error(f"Media download error: {e}")
        return None


def handle_whatsapp_message():
    """
    Main webhook handler for all incoming WhatsApp messages.
    Called by Flask route: POST /whatsapp
    """
    # Extract core fields
    from_number  = request.form.get("From", "")      # e.g. whatsapp:+919876543210
    body         = request.form.get("Body", "").strip()
    num_media    = int(request.form.get("NumMedia", 0))
    media_url    = request.form.get("MediaUrl0", "")
    media_type   = request.form.get("MediaContentType0", "")
    profile_name = request.form.get("ProfileName", "")

    # Normalise phone ID (strip whatsapp: prefix for DB storage)
    phone_id = from_number.replace("whatsapp:", "").strip()

    logger.info(f"WhatsApp from {phone_id}: '{body}' | media={num_media} type={media_type}")

    # ── Reset command
    if body.lower() in ("/reset", "reset", "naya shuru", "start over"):
        reset_history(phone_id)
        _send_whatsapp(phone_id, "Theek hai! Fresh start karte hain. Batao, aaj kya help chahiye? 🌱")
        return

    # ── Voice note (audio)
    if num_media > 0 and "audio" in media_type:
        audio_bytes = _download_media(media_url)
        if audio_bytes:
            # Transcribe via Gemini
            from google import genai as genai_lib
            from google.genai import types as gtypes
            client = genai_lib.Client(api_key=os.getenv("GEMINI_API_KEY"))
            try:
                transcription = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=[
                        gtypes.Content(
                            role="user",
                            parts=[
                                gtypes.Part.from_bytes(data=audio_bytes, mime_type=media_type),
                                gtypes.Part.from_text(
                                    "Transcribe exactly what is said. Return only the transcription."
                                ),
                            ],
                        )
                    ],
                )
                spoken_text = transcription.text.strip()
                logger.info(f"Voice transcription: {spoken_text}")
                body = spoken_text
                msg_type = "voice"
            except Exception as e:
                logger.error(f"Transcription error: {e}")
                body = "[Voice message could not be transcribed]"
                msg_type = "voice"
        else:
            body = "[Could not download voice note]"
            msg_type = "voice"

    # ── Image (crop disease diagnosis)
    elif num_media > 0 and "image" in media_type:
        image_bytes = _download_media(media_url)
        caption = body or "[Farmer sent a crop photo]"
        prompt = f"[WhatsApp photo received. Caption: '{caption}']. Please analyze this crop image."

        ai_reply = generate_response(
            phone_id=phone_id,
            user_text=prompt,
            name=profile_name,
            msg_type="photo",
            image_bytes=image_bytes,
            image_mime=media_type,
        )
        _send_whatsapp(phone_id, ai_reply)
        return

    # ── Text message (or transcribed voice)
    if not body:
        _send_whatsapp(phone_id, "Kuch message nahi mila. Kuch poochho dost! 😊")
        return

    ai_reply = generate_response(
        phone_id=phone_id,
        user_text=body,
        name=profile_name,
        msg_type=msg_type if "msg_type" in dir() else "text",
    )
    _send_whatsapp(phone_id, ai_reply)
