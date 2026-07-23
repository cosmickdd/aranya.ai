"""
server.py — Production-ready Flask server for Aranya.ai WhatsApp + Voice service.

Routes:
  POST /whatsapp              <- Twilio WhatsApp webhook
  POST /voice/incoming        <- Twilio inbound call webhook
  POST /voice/respond         <- Twilio speech response webhook
  POST /voice/status          <- Twilio call status callback
  GET  /voice/play-message    <- TwiML for outbound alert calls
  GET  /audio/<filename>      <- Serves TTS audio files to Twilio
  GET  /health                <- Health check (also tests DB connectivity)
  POST /api/chat              <- Mobile app chat (rate-limited: 30/min)
  POST /api/voice-chat        <- Mobile app voice chat (rate-limited: 20/min)
  POST /api/profile           <- Save farmer profile (language, location, crops)

Run in production:
  waitress-serve --host=0.0.0.0 --port=5000 server:app
"""
import os
import sys
import logging
from datetime import datetime

from flask import Flask, request, jsonify, send_from_directory, abort
from twilio.twiml.voice_response import VoiceResponse
from twilio.request_validator import RequestValidator

# ── Path setup ────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# ── Load env ──────────────────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv(os.path.join(BASE_DIR, ".env"))

# ── Local imports ─────────────────────────────────────────────────────────────
from config import AUDIO_DIR, PUBLIC_URL, TWILIO_AUTH_TOKEN
from whatsapp.handler import handle_whatsapp_message
from voice.call_handler import handle_incoming_call, handle_voice_response, handle_call_status
from tts.tts import clean_for_speech, text_to_audio

# ── Init DB ───────────────────────────────────────────────────────────────────
from db.database import init_db
init_db()

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_DIR = os.path.join(BASE_DIR, "logs")
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
    level=logging.INFO,
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(LOG_DIR, f"aranya_{datetime.now().strftime('%Y%m%d')}.log")),
    ],
)
logger = logging.getLogger(__name__)
logging.getLogger("twilio").setLevel(logging.WARNING)
logging.getLogger("werkzeug").setLevel(logging.WARNING)

# ── Flask app ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB max upload

# ── Rate limiting (protects /api/* from bill abuse) ───────────────────────────
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=[],          # no global limit; only per-route
    storage_uri="memory://",
)

# ── Twilio signature validator ────────────────────────────────────────────────
_validator = RequestValidator(TWILIO_AUTH_TOKEN) if TWILIO_AUTH_TOKEN else None
_VALIDATE_TWILIO = os.getenv("VALIDATE_TWILIO_SIGNATURE", "false").lower() == "true"


def _validate_twilio_request():
    """
    Validate that the request is genuinely from Twilio.
    Only enforced when VALIDATE_TWILIO_SIGNATURE=true in .env.
    Enable this in production after confirming webhooks work.
    """
    if not _VALIDATE_TWILIO or not _validator:
        return True
    url = request.url
    post_data = request.form.to_dict()
    signature = request.headers.get("X-Twilio-Signature", "")
    return _validator.validate(url, post_data, signature)


# ─────────────────────────────────────────────────────────────────────────────
# WhatsApp Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/whatsapp", methods=["POST"])
def whatsapp_webhook():
    """Receives all incoming WhatsApp messages from Twilio."""
    if not _validate_twilio_request():
        logger.warning("Rejected unauthorized WhatsApp request")
        abort(403)
    handle_whatsapp_message()
    return ("", 204)


# ─────────────────────────────────────────────────────────────────────────────
# Voice Call Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/voice/incoming", methods=["POST"])
def voice_incoming():
    """Twilio calls this when someone dials the Twilio number."""
    if not _validate_twilio_request():
        abort(403)
    twiml = handle_incoming_call()
    return app.response_class(twiml, mimetype="text/xml")


@app.route("/voice/respond", methods=["POST"])
def voice_respond():
    """Twilio calls this after capturing the farmer's speech."""
    if not _validate_twilio_request():
        abort(403)
    twiml = handle_voice_response()
    return app.response_class(twiml, mimetype="text/xml")


@app.route("/voice/status", methods=["POST"])
def voice_status():
    """Twilio status callback — logs call events."""
    handle_call_status()
    return ("", 204)


@app.route("/voice/play-message", methods=["GET", "POST"])
def play_outbound_message():
    """TwiML endpoint for outbound alert calls."""
    audio_file = request.args.get("file", "")
    resp = VoiceResponse()
    from twilio.twiml.voice_response import Gather

    gather = Gather(
        input="speech",
        action=f"{PUBLIC_URL}/voice/respond",
        method="POST",
        language="hi-IN",
        speech_timeout="auto",
        timeout=6,
    )

    if audio_file:
        gather.play(f"{PUBLIC_URL}/audio/{audio_file}")
    else:
        gather.say("Namaste! Aranya se message hai. Koi sawaal ho toh boliye.", language="hi-IN")

    resp.append(gather)
    resp.hangup()
    return app.response_class(str(resp), mimetype="text/xml")


@app.route("/voice/say-message", methods=["GET", "POST"])
def say_outbound_message():
    """Fallback TwiML for outbound calls without pre-generated audio."""
    text = request.args.get("text", "Namaste! Aranya se ek zaroori sandesh hai.")
    resp = VoiceResponse()
    resp.say(text, language="hi-IN", voice="Polly.Aditi")
    resp.hangup()
    return app.response_class(str(resp), mimetype="text/xml")


# ─────────────────────────────────────────────────────────────────────────────
# Audio File Serving
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/audio/<path:filename>")
def serve_audio(filename):
    """Serves MP3 files generated by gTTS to Twilio during calls."""
    return send_from_directory(AUDIO_DIR, filename, mimetype="audio/mpeg")


# ─────────────────────────────────────────────────────────────────────────────
# Utility Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    """
    Health check — tests live DB connectivity in addition to server uptime.
    Returns HTTP 200 if healthy, 503 if DB is unreachable.
    """
    from db.database import ping_db
    db_ok = ping_db()
    payload = {
        "status": "ok" if db_ok else "degraded",
        "service": "Aranya.ai WhatsApp+Voice",
        "version": "0.2.0",
        "db": "ok" if db_ok else "error",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    return jsonify(payload), (200 if db_ok else 503)


@app.route("/")
def index():
    return jsonify({
        "name": "Aranya.ai",
        "version": "0.2.0",
        "description": "AI-powered agricultural companion for Indian farmers",
        "status": "running",
        "endpoints": ["/health", "/whatsapp", "/voice/incoming", "/api/chat", "/api/voice-chat", "/api/profile"],
    })


@app.route("/test-call", methods=["POST", "OPTIONS"])
def test_call():
    """
    Trigger an outbound alert call.
    POST /test-call  JSON: {"to": "+919876543210", "message": "Alert text"}
    Requires TEST_CALL_SECRET header for security.
    """
    if request.method == "OPTIONS":
        return ("", 204)
        
    # Basic auth for test endpoint
    secret = request.headers.get("X-Test-Secret", "")
    expected = os.getenv("TEST_CALL_SECRET", "")
    if expected and secret != expected:
        abort(403)

    data = request.get_json() or {}
    to = data.get("to")
    msg = data.get("message", "Namaste! Yeh Aranya ka test call hai.")

    if not to:
        return jsonify({"error": "Missing 'to' field"}), 400

    from voice.outbound import call_farmer
    sid = call_farmer(to, msg)

    if sid:
        return jsonify({"success": True, "call_sid": sid})
    return jsonify({"success": False, "error": "Call failed — check logs"}), 500


@app.route("/api/chat", methods=["POST", "OPTIONS"])
@limiter.limit("30 per minute", methods=["POST"])
def api_chat():
    """
    REST endpoint for the mobile app chat interface.
    POST /api/chat  JSON: {"message": "Hello", "user_id": "app_user_123", "language": "hi"}
    Returns: {"reply": "...", "audio_base64": "..."}
    """
    if request.method == "OPTIONS":
        return ("", 204)
        
    data = request.get_json() or {}
    msg = data.get("message", "")
    user_id = data.get("user_id", "anonymous_mobile_user")
    language = data.get("language", "en")
    image_base64 = data.get("image_base64", None)
    doc_base64 = data.get("doc_base64", None)
    doc_mime = data.get("doc_mime", "application/pdf")
    
    if not msg and not image_base64 and not doc_base64:
        return jsonify({"error": "Missing message, image, or document"}), 400
        
    import base64
    image_bytes = None
    image_mime = "image/jpeg"
    
    if image_base64:
        try:
            if "," in image_base64:
                header, image_base64 = image_base64.split(",", 1)
                if "png" in header:
                    image_mime = "image/png"
            image_bytes = base64.b64decode(image_base64)
        except Exception as e:
            logger.error(f"Base64 decode error: {e}")
            
    doc_bytes = None
    if doc_base64:
        try:
            if "," in doc_base64:
                _, doc_base64 = doc_base64.split(",", 1)
            doc_bytes = base64.b64decode(doc_base64)
        except Exception as e:
            logger.error(f"Doc base64 decode error: {e}")
            
    try:
        from core.engine import generate_response
        from services.sarvam import translate_text, text_to_speech
        
        # Extract API key if delegated by client
        api_key = request.headers.get("X-Sarvam-API-Key") or (request.json.get("sarvam_api_key") if request.is_json else None)

        # Inject direct system guardrail reminder to prevent LLM poisoning/leak on files
        gemini_input = msg or ("Analyze this image." if image_base64 else "What is in this document?")
        if image_base64 or doc_base64:
            gemini_input += " (Focus strictly on agriculture/farming. If this image or document is off-topic, decline to answer.)"
        
        # Step 2: Get AI response from Gemini directly in target language
        ai_text = generate_response(
            phone_id=user_id, 
            user_text=gemini_input, 
            voice_mode=False, 
            language=language,
            image_bytes=image_bytes,
            image_mime=image_mime,
            doc_bytes=doc_bytes,
            doc_mime=doc_mime
        )
        
        # Step 3: Generate TTS audio of the response via Sarvam
        audio_b64 = text_to_speech(ai_text, language=language, api_key=api_key)
        
        return jsonify({
            "reply": ai_text,
            "audio_base64": audio_b64,
        })
    except Exception as e:
        logger.error(f"/api/chat error: {e}")
        return jsonify({"error": "Failed to generate response"}), 500


@app.route("/api/voice-chat", methods=["POST", "OPTIONS"])
@limiter.limit("20 per minute", methods=["POST"])
def api_voice_chat():
    """
    Voice chat endpoint — accepts audio file from mic recording.
    Uses Sarvam STT to transcribe, Gemini to respond, Sarvam TTS for audio reply.
    POST /api/voice-chat  multipart/form-data: audio file + language + user_id
    Returns: {"transcript": "...", "reply": "...", "audio_base64": "..."}
    """
    if request.method == "OPTIONS":
        return ("", 204)

    language = request.form.get("language", "hi")
    user_id = request.form.get("user_id", "anonymous_voice_user")

    # Extract API key if delegated by client
    api_key = request.headers.get("X-Sarvam-API-Key") or request.form.get("sarvam_api_key")

    audio_file = request.files.get("audio")
    if not audio_file:
        return jsonify({"error": "No audio file provided"}), 400

    try:
        audio_bytes = audio_file.read()
        mime_type = audio_file.content_type or "audio/webm"
        logger.info(f"Voice chat: received {len(audio_bytes)} bytes, mime={mime_type}")

        from services.sarvam import speech_to_text, translate_text, text_to_speech
        from core.engine import generate_response

        # Step 1: Speech-to-Text (handles webm transcoding automatically)
        transcript = speech_to_text(audio_bytes, language=language, mime_type=mime_type, api_key=api_key)
        if not transcript:
            return jsonify({"error": f"Could not understand audio. (WAV size: {len(audio_bytes)} bytes). Please speak clearly or check microphone."}), 400
        logger.info(f"STT transcript: {transcript}")

        # Step 2: Gemini AI response directly in target language (bypassing input translation)
        ai_text = generate_response(
            phone_id=user_id,
            user_text=transcript,
            voice_mode=True,
            language=language,
        )

        # Step 3: Sarvam TTS (direct response from Gemini)
        audio_b64 = text_to_speech(ai_text, language=language, api_key=api_key)

        return jsonify({
            "transcript": transcript,
            "reply": ai_text,
            "audio_base64": audio_b64,
        })


    except Exception as e:
        logger.error(f"/api/voice-chat error: {e}")
        return jsonify({"error": "Voice processing failed"}), 500

@app.route("/api/profile", methods=["POST", "OPTIONS"])
def api_profile():
    """
    Save or update the farmer's profile — language, location, and crops.
    Called by the mobile app after onboarding or language selection.

    POST /api/profile  JSON:
    {
      "user_id": "firebase_uid_or_anonymous",
      "language": "hi",           # optional ISO code
      "location": "Varanasi",     # optional city/district
      "crops": "Wheat, Onion"     # optional comma-separated crop list
    }
    Returns: {"success": true, "updated": ["language", "location", "crops"]}
    """
    if request.method == "OPTIONS":
        return ("", 204)

    data = request.get_json() or {}
    user_id = data.get("user_id", "").strip()
    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    from db.database import get_session, User
    db = get_session()
    try:
        user = db.query(User).filter(User.telegram_id == user_id).first()
        if not user:
            # Create user row if first visit from mobile
            user = User(telegram_id=user_id)
            db.add(user)

        updated = []
        if "language" in data and data["language"]:
            user.language = data["language"]
            updated.append("language")
        if "location" in data and data["location"]:
            user.location = data["location"]
            updated.append("location")
        if "crops" in data and data["crops"]:
            user.crops = data["crops"]
            updated.append("crops")

        db.commit()
        logger.info(f"Profile updated for {user_id}: {updated}")
        return jsonify({"success": True, "updated": updated})
    except Exception as e:
        logger.error(f"/api/profile error: {e}")
        return jsonify({"error": "Profile update failed"}), 500
    finally:
        db.close()


@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    return response

# ─────────────────────────────────────────────────────────────────────────────
# Error Handlers
# ─────────────────────────────────────────────────────────────────────────────

@app.errorhandler(403)
def forbidden(e):
    return jsonify({"error": "Forbidden"}), 403

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def server_error(e):
    logger.error(f"Internal server error: {e}")
    return jsonify({"error": "Internal server error"}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    use_production = os.getenv("USE_PRODUCTION_SERVER", "false").lower() == "true"

    print("\n" + "=" * 60)
    print("  Aranya.ai — WhatsApp + Voice Server")
    print(f"  Public URL   : {PUBLIC_URL or 'NOT SET'}")
    print(f"  Local        : http://0.0.0.0:{port}")
    print(f"  Server       : {'waitress (production)' if use_production else 'Flask dev'}")
    print("  WhatsApp     : POST /whatsapp")
    print("  Call hook    : POST /voice/incoming")
    print("  Health check : GET  /health")
    print("=" * 60 + "\n")

    if use_production:
        from waitress import serve
        logger.info(f"Starting waitress production server on port {port}")
        serve(app, host="0.0.0.0", port=port, threads=8)
    else:
        app.run(host="0.0.0.0", port=port, debug=False)
