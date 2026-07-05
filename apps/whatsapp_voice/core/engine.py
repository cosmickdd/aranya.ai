"""
engine.py — Shared Gemini AI engine for WhatsApp + Voice.
Same conversational logic as the Telegram MVP — single SQLite DB, full memory.
"""
import os
import logging

from google import genai
from google.genai import types
from db.database import get_session, User, Message

logger = logging.getLogger(__name__)

_client = None

def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        _client = genai.Client(api_key=api_key)
    return _client


ARANYA_SOUL = """
Tum Aranya ho — ek bahut hi samajhdar, dosti wala aur bharosemand khet ka saathi.
Tu ek AI hai jo Indian farmers ka best friend hai.

=== TERI PERSONALITY ===
- Tu ek dost ki tarah baat karta hai, tutor ya customer support agent ki tarah NAHI.
- Tu kabhi boring, formal ya robotic nahi lagta.
- Tu genuinely curious hai farmer ki zindagi ke baare mein.
- Tu har jawab ke saath ek follow-up question poochha karta hai.
- Tu kabhi judgment nahi karta.

=== TU KYA JAANTA HAI ===
You have deep expertise in:
1. CROP SCIENCE: Kharif & Rabi crops, seed selection, sowing timings, fertilizer schedules, irrigation.
2. DISEASE & PEST: Symptom-based diagnosis, organic & chemical treatment, prevention.
3. WEATHER: Seasonal patterns, rain prediction impact, frost alerts, heatwave advice.
4. MANDI & MARKETS: Typical price ranges per quintal for common crops, MSP updates.
5. GOVERNMENT SCHEMES: PM-KISAN, Kisan Credit Card, Fasal Bima Yojana, soil health cards.
6. SOIL HEALTH: pH, NPK ratios, organic matter, soil testing advice.
7. WATER: Drip irrigation, groundwater levels, water conservation.

=== LANGUAGE RULES ===
- Agar farmer Hindi mein baat kare → tu Hindi-Hinglish mein reply kar.
- Agar farmer English mein baat kare → simple, clear English use kar.

=== FOR VOICE CALLS ===
- When responding to a voice call, keep your answer to 2-3 sentences max.
- Do NOT use bullet points, asterisks, or markdown — speak naturally.
- End with a clear question so the farmer can respond.
- Speak like you are on a phone call.

=== FOR WHATSAPP ===
- Keep responses SHORT and ACTIONABLE — 3 to 5 sentences max.
- Use emojis sparingly to make it warm.
- After answering, ALWAYS ask one relevant follow-up question.
"""


def _get_or_create_user(db, phone_id: str, name: str = None) -> User:
    user = db.query(User).filter(User.telegram_id == str(phone_id)).first()
    if not user:
        user = User(telegram_id=str(phone_id), first_name=name)
        db.add(user)
        db.commit()
        db.refresh(user)
    elif name and not user.first_name:
        user.first_name = name
        db.commit()
    return user


def _get_history(db, user_id: int, limit: int = 12):
    rows = (
        db.query(Message)
        .filter(Message.user_id == user_id)
        .order_by(Message.timestamp.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(rows))


def _save(db, user_id: int, role: str, content: str, msg_type: str = "text"):
    db.add(Message(user_id=user_id, role=role, content=content, msg_type=msg_type))
    db.commit()


def generate_response(
    phone_id: str,
    user_text: str,
    name: str = None,
    msg_type: str = "text",
    image_bytes: bytes = None,
    image_mime: str = "image/jpeg",
    voice_mode: bool = False,
    user_location: str = None,
) -> str:
    """
    Core response generator. Used by both WhatsApp and Voice handlers.
    phone_id     : unique identifier (WhatsApp number or caller phone number)
    voice_mode   : if True, response is optimised for spoken audio (no markdown)
    user_location: farmer's city/district for weather queries
    """
    client = _get_client()
    db = get_session()

    try:
        user = _get_or_create_user(db, phone_id, name)
        _save(db, user.id, "user", user_text, msg_type)

        history_rows = _get_history(db, user.id, limit=14)[:-1]

        contents = []
        for row in history_rows:
            role = "user" if row.role == "user" else "model"
            contents.append(
                types.Content(role=role, parts=[types.Part.from_text(text=row.content)])
            )

        # ── Detect intent and inject live data ──────────────────────────────
        live_data_context = _fetch_live_context(user_text, user_location or (user.location if user else None))

        current_parts = []
        if image_bytes:
            current_parts.append(
                types.Part.from_bytes(data=image_bytes, mime_type=image_mime)
            )

        # Inject live data as context alongside the user's message
        if live_data_context:
            enriched_text = (
                f"{user_text}\n\n"
                f"[LIVE DATA — use this in your response, do not mention it was injected]:\n"
                f"{live_data_context}"
            )
        else:
            enriched_text = user_text

        current_parts.append(types.Part.from_text(text=enriched_text))
        contents.append(types.Content(role="user", parts=current_parts))

        system = ARANYA_SOUL
        if voice_mode:
            system += "\n\nIMPORTANT: This is a voice call. Reply in 2-3 spoken sentences only. No lists, no symbols."

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=0.75,
                max_output_tokens=400 if voice_mode else 600,
            ),
        )
        ai_text = response.text
        _save(db, user.id, "model", ai_text, "voice" if voice_mode else "text")
        return ai_text

    except Exception as e:
        logger.error(f"Gemini error: {e}")
        fallback = (
            "Yaar, mujhe abhi thodi takleef ho rahi hai. Ek baar phir try karo."
            if not voice_mode
            else "Main abhi thoda busy hoon. Dobara call karo please."
        )
        return fallback
    finally:
        db.close()


def _fetch_live_context(user_text: str, location: str = None) -> str:
    """
    Detect what the farmer needs and fetch live data to inject into the prompt.
    Returns a context string or empty string if no live data needed.
    """
    try:
        from services.intent import detect_intent
        from services.mandi import get_mandi_prices
        from services.weather import get_weather

        intent = detect_intent(user_text)
        parts = []

        if intent["wants_mandi"] and intent["commodity"]:
            mandi = get_mandi_prices(intent["commodity"])
            parts.append(f"MANDI PRICE DATA:\n{mandi['summary']}")
            if not mandi["live"]:
                parts.append("(Note: This is estimated data. Live API key not set.)")

        if intent["wants_weather"]:
            loc = intent["location"] or location or "Delhi"
            weather = get_weather(loc)
            parts.append(f"WEATHER DATA:\n{weather['summary']}\nFARMING ADVICE: {weather['farming_advice']}")

        return "\n\n".join(parts)

    except Exception as e:
        logger.warning(f"Live data fetch error: {e}")
        return ""


def reset_history(phone_id: str):
    db = get_session()
    try:
        user = db.query(User).filter(User.telegram_id == str(phone_id)).first()
        if user:
            db.query(Message).filter(Message.user_id == user.id).delete()
            db.commit()
    finally:
        db.close()
