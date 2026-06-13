"""
voice/outbound.py — Outbound calling: Aranya calls the farmer.

Use cases:
  - Send a weather alert call: "Kal tez barish aane wali hai, fasal sambhalo!"
  - Send a mandi price alert: "Aaj pyaaz ka bhav ₹1200 ho gaya, bechne ka sahi waqt!"
  - Follow up with the farmer proactively.

Usage:
  from voice.outbound import call_farmer
  call_farmer(
      to="+919876543210",
      message="Namaste Ramesh bhai! Kal tez barish aane wali hai UP mein. Apni fasal ko dhak lo aaj raat. Take care!"
  )
"""
import logging
import os

from twilio.rest import Client as TwilioClient
from tts.tts import text_to_audio, clean_for_speech
from config import TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, PUBLIC_URL

logger = logging.getLogger(__name__)
twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


def call_farmer(to: str, message: str):
    """
    Place an outbound call to a farmer and play a message.
    After the message, Aranya listens for a response — so farmer can ask a follow-up question.

    to      : farmer's phone number with country code e.g. "+919876543210"
    message : the message Aranya will speak when farmer picks up
    """
    clean_msg = clean_for_speech(message)
    audio_file = text_to_audio(clean_msg, lang="hi")

    if audio_file:
        twiml_url = f"{PUBLIC_URL}/voice/play-message?file={audio_file}"
    else:
        # Fallback: TwiML with Say
        encoded = message.replace("&", "and").replace("<", "").replace(">", "")
        twiml_url = f"{PUBLIC_URL}/voice/say-message?text={encoded}"

    try:
        call = twilio_client.calls.create(
            to=to,
            from_=TWILIO_PHONE_NUMBER,
            url=twiml_url,
            status_callback=f"{PUBLIC_URL}/voice/status",
            status_callback_method="POST",
        )
        logger.info(f"Outbound call placed to {to}: SID={call.sid}")
        return call.sid
    except Exception as e:
        logger.error(f"Outbound call error to {to}: {e}")
        return None


def alert_all(phone_numbers: list, message: str):
    """
    Broadcast an alert call to multiple farmers.
    Example: weather alert, pest outbreak warning, mandi crash alert.
    """
    results = []
    for number in phone_numbers:
        sid = call_farmer(number, message)
        results.append({"number": number, "sid": sid, "success": sid is not None})
    return results
