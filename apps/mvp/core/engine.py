import os
import logging
from google import genai
from google.genai import types
from db.database import get_session, User, Message

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Gemini client (initialized lazily so .env is loaded first)
# ─────────────────────────────────────────────────────────────────────────────
_client = None

def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        _client = genai.Client(api_key=api_key)
    return _client


# ─────────────────────────────────────────────────────────────────────────────
# Master System Prompt — Aranya's "soul"
# ─────────────────────────────────────────────────────────────────────────────
ARANYA_SOUL = """
Tum Aranya ho — ek bahut hi samajhdar, dosti wala aur bharosemand khet ka saathi.
Tu ek AI hai jo Indian farmers ka best friend hai.

=== TERI PERSONALITY ===
- Tu ek dost ki tarah baat karta hai, tutor ya customer support agent ki tarah NAHI.
- Tu kabhi boring, formal ya robotic nahi lagta.
- Tu genuinely curious hai farmer ki zindagi ke baare mein.
- Tu har jawab ke saath ek follow-up question poochha karta hai.
- Tu emojis use karta hai — par overdone nahi.
- Tu kabhi judgment nahi karta — galti ho toh bhi pyaar se batata hai.

=== TU KYA JAANTA HAI ===
You have deep expertise in:
1. 🌾 CROP SCIENCE: Kharif & Rabi crops, seed selection, sowing timings, fertilizer schedules, irrigation.
2. 🐛 DISEASE & PEST: Symptom-based diagnosis, organic & chemical treatment, prevention.
3. 🌦️ WEATHER: Seasonal patterns, rain prediction impact, frost alerts, heatwave advice.
4. 💰 MANDI & MARKETS: Typical price ranges per quintal for common crops (wheat, rice, cotton, sugarcane, onion, potato), MSP updates, when to sell vs hold.
5. 🏛️ GOVERNMENT SCHEMES: PM-KISAN, Kisan Credit Card, Fasal Bima Yojana, soil health cards.
6. 🌱 SOIL HEALTH: pH, NPK ratios, organic matter, soil testing advice.
7. 💧 WATER: Drip irrigation, groundwater levels, water conservation.

=== LANGUAGE RULES ===
- Agar farmer Hindi mein baat kare → tu Hindi-Hinglish mein reply kar (natural Indian style).
- Agar farmer English mein baat kare → simple, clear English use kar.
- Never switch language mid-conversation unless farmer switches.
- Use Indian number formats: "₹2,400 per quintal" not "$2400".

=== RESPONSE STYLE ===
- Keep responses SHORT and ACTIONABLE — 3 to 5 sentences max unless asked for detail.
- Don't give a list of 10 bullet points. Talk naturally.
- After answering, ALWAYS ask one relevant follow-up question.
- If you don't know exact current data (like today's live mandi price), give a realistic range from your knowledge and say "for exact today's price, check your local mandi app."

=== EXAMPLES OF HOW YOU TALK ===

Farmer: "Bhai mere gehun ki patti peeli ho rahi hai"
Aranya: "Arre yaar! Patti peeli hone ke do main karan hote hain — ya toh nitrogen ki kami hai, ya phir pani zyada ho gaya. 🌿 Patti agar neeche wali hain toh nitrogen dedo — ek bag urea per bigha kafi hoga. Agar upar wali patti peeli hai toh zinc ki kami lag rahi hai, zinc sulphate chidak do. Batao — pani kitni baar de rahe ho khet mein?"

Farmer: "What's the price of onion right now?"
Aranya: "Onion prices are a bit wild right now! 🧅 In most UP & Maharashtra mandis, they're hovering around ₹800–1,200 per quintal. If you have storage, holding for another 3–4 weeks could be smart as the lean season approaches. Where are you selling — local mandi or through an FPC?"
"""


# ─────────────────────────────────────────────────────────────────────────────
# Core functions
# ─────────────────────────────────────────────────────────────────────────────

def get_or_create_user(db, telegram_id: str, first_name: str = None) -> User:
    user = db.query(User).filter(User.telegram_id == str(telegram_id)).first()
    if not user:
        user = User(telegram_id=str(telegram_id), first_name=first_name)
        db.add(user)
        db.commit()
        db.refresh(user)
    elif first_name and not user.first_name:
        user.first_name = first_name
        db.commit()
    return user


def get_chat_history(db, user_id: int, limit: int = 12):
    """Get last N messages in chronological order."""
    msgs = (
        db.query(Message)
        .filter(Message.user_id == user_id)
        .order_by(Message.timestamp.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(msgs))


def save_message(db, user_id: int, role: str, content: str, msg_type: str = "text"):
    msg = Message(user_id=user_id, role=role, content=content, msg_type=msg_type)
    db.add(msg)
    db.commit()


def build_user_context(user: User) -> str:
    """Build a small context string about the farmer to prepend."""
    parts = []
    if user.first_name:
        parts.append(f"Farmer's name: {user.first_name}")
    if user.location:
        parts.append(f"Location: {user.location}")
    if user.crops:
        parts.append(f"Crops they grow: {user.crops}")
    if parts:
        return "=== FARMER PROFILE ===\n" + "\n".join(parts) + "\n=== END PROFILE ==="
    return ""


def generate_response(
    telegram_id: str,
    user_text: str,
    first_name: str = None,
    msg_type: str = "text",
    image_bytes: bytes = None,
    image_mime: str = "image/jpeg",
) -> str:
    """
    Core AI response function.
    Maintains full conversational memory. Supports text, voice transcript, and image.
    """
    client = _get_client()
    db = get_session()

    try:
        # 1. Get/create user
        user = get_or_create_user(db, telegram_id, first_name)

        # 2. Save the incoming user message
        save_message(db, user.id, "user", user_text, msg_type)

        # 3. Build history for Gemini
        history_rows = get_chat_history(db, user.id, limit=14)
        # Exclude the message we just saved (last item) — we'll pass it as current turn
        history_rows = history_rows[:-1]

        contents = []
        for row in history_rows:
            role = "user" if row.role == "user" else "model"
            contents.append(
                types.Content(role=role, parts=[types.Part.from_text(text=row.content)])
            )

        # 4. Build current turn — may include image
        current_parts = []
        if image_bytes:
            current_parts.append(
                types.Part.from_bytes(data=image_bytes, mime_type=image_mime)
            )
        if user_text:
            current_parts.append(types.Part.from_text(text=user_text))
        
        contents.append(types.Content(role="user", parts=current_parts))

        # 5. Build full system prompt (with farmer profile context)
        farmer_ctx = build_user_context(user)
        full_system = ARANYA_SOUL
        if farmer_ctx:
            full_system = farmer_ctx + "\n\n" + ARANYA_SOUL

        # 6. Call Gemini 2.5 Flash
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=full_system,
                temperature=0.75,
                max_output_tokens=600,
            ),
        )
        ai_text = response.text

        # 7. Save AI response
        save_message(db, user.id, "model", ai_text, "text")

        return ai_text

    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        return (
            "Yaar, mujhe abhi kuch technical issue aa raha hai. 😅 "
            "Ek minute ruko aur phir se message karo — sab theek ho jaayega!"
        )
    finally:
        db.close()


def reset_user_history(telegram_id: str) -> bool:
    """Delete all messages for a user (fresh start)."""
    db = get_session()
    try:
        user = db.query(User).filter(User.telegram_id == str(telegram_id)).first()
        if user:
            db.query(Message).filter(Message.user_id == user.id).delete()
            db.commit()
            return True
        return False
    except Exception as e:
        logger.error(f"Reset error: {e}")
        return False
    finally:
        db.close()
