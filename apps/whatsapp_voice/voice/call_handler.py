"""
voice/call_handler.py — Inbound voice call handler using Twilio Voice + TwiML.

Flow:
  1. Farmer calls the Twilio number.
  2. Twilio hits /voice/incoming → Aranya greets in Hindi.
  3. Twilio records farmer's speech (or uses <Gather> for real-time STT).
  4. Twilio hits /voice/respond with the transcription.
  5. Aranya generates AI response → converted to MP3 via gTTS.
  6. Twilio plays the audio → farmer hears Aranya's voice.
  7. Loop continues until farmer hangs up.
"""
import os
import logging

from flask import request, url_for
from twilio.twiml.voice_response import VoiceResponse, Gather

from core.engine import generate_response
from tts.tts import text_to_audio, clean_for_speech
from config import PUBLIC_URL

logger = logging.getLogger(__name__)

# Greeting Aranya says when farmer calls
GREETING = (
    "Namaste! Main Aranya hoon, aapka khet ka saathi. "
    "Batao, aaj khet mein kya chal raha hai? Main poori baat sununga."
)


def handle_incoming_call():
    """
    Called when farmer first dials the Twilio number.
    Returns TwiML that greets the farmer and starts listening.
    """
    resp = VoiceResponse()

    # Generate and serve greeting audio
    greeting_clean = clean_for_speech(GREETING)
    audio_file = text_to_audio(greeting_clean, lang="hi")

    gather = Gather(
        input="speech",
        action=f"{PUBLIC_URL}/voice/respond",
        method="POST",
        language="hi-IN",          # Hindi speech recognition
        speech_timeout="auto",
        speech_model="phone_call",
        timeout=5,
    )

    if audio_file:
        gather.play(f"{PUBLIC_URL}/audio/{audio_file}")
    else:
        gather.say(GREETING, language="hi-IN", voice="Polly.Aditi")

    resp.append(gather)

    # If farmer doesn't say anything
    resp.say("Koi jawab nahi mila. Phir call karein. Dhanyavaad!", language="hi-IN")
    return str(resp)


def handle_voice_response():
    """
    Called after Twilio captures the farmer's speech.
    Generates an AI response, converts to audio, and plays it back.
    Then gathers the next farmer input — creating a full conversation loop.
    """
    caller     = request.form.get("From", "unknown").strip()
    speech     = request.form.get("SpeechResult", "").strip()
    confidence = float(request.form.get("Confidence", 0))

    logger.info(f"Call from {caller} | Speech: '{speech}' | Confidence: {confidence:.2f}")

    resp = VoiceResponse()

    # ── Could not understand
    if not speech or confidence < 0.3:
        gather = Gather(
            input="speech",
            action=f"{PUBLIC_URL}/voice/respond",
            method="POST",
            language="hi-IN",
            speech_timeout="auto",
            timeout=5,
        )
        gather.say("Samajh nahi aaya, ek baar phir bolein.", language="hi-IN", voice="Polly.Aditi")
        resp.append(gather)
        return str(resp)

    # ── Generate AI response
    ai_text = generate_response(
        phone_id=caller,
        user_text=speech,
        msg_type="voice",
        voice_mode=True,
    )
    logger.info(f"AI response for call: {ai_text[:80]}...")

    speech_text = clean_for_speech(ai_text)
    audio_file = text_to_audio(speech_text, lang="hi")

    # ── Play response and gather next input
    gather = Gather(
        input="speech",
        action=f"{PUBLIC_URL}/voice/respond",
        method="POST",
        language="hi-IN",
        speech_timeout="auto",
        speech_model="phone_call",
        timeout=6,
    )

    if audio_file:
        gather.play(f"{PUBLIC_URL}/audio/{audio_file}")
    else:
        gather.say(speech_text, language="hi-IN", voice="Polly.Aditi")

    resp.append(gather)

    # Fallback if no response
    resp.say(
        "Aapne kuch nahi bola. Call khatam kar raha hoon. Phir milenge!",
        language="hi-IN",
        voice="Polly.Aditi",
    )
    resp.hangup()

    return str(resp)


def handle_call_status():
    """Called by Twilio when call status changes (optional logging)."""
    call_sid = request.form.get("CallSid")
    status   = request.form.get("CallStatus")
    caller   = request.form.get("From", "")
    logger.info(f"Call {call_sid} from {caller}: status={status}")
    return ("", 204)
