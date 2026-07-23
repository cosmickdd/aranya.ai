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
- Tu kabhi judgment nahi karta.

=== COMPREHENSIVE INDIAN CROP DISEASE KNOWLEDGE BASE (STRICT REFERENCE) ===
Use this factual reference for crop diseases in India to provide highly accurate, structured, symptom-based diagnoses, causes, and precise cures:

1. RICE / PADDY (Dhan):
   - Blast (Jhoka Rog):
     * Symptoms: Spindle-shaped lesions on leaves with grey centers and brown borders. Neck rot causes grain heads to fall.
     * Organic Cure: Spray Pseudomonas fluorescens (5ml/L) or Neem oil (30ml/L).
     * Chemical Cure: Spray Tricyclazole 75 WP (0.6g/L) or Carbendazim 50 WP (1g/L).
   - Bacterial Leaf Blight (BLB):
     * Symptoms: Straw-colored wavy stripes from leaf tips, bacterial yellow ooze in mornings.
     * Organic Cure: Spray fresh cow dung extract (20%) or apply neem dust.
     * Chemical Cure: Spray Streptocycline (0.1g/L) + Copper Oxychloride 50 WP (2g/L).
   - Brown Spot:
     * Symptoms: Oval dark brown spots with yellow halos on leaves.
     * Organic Cure: Trichoderma viride seed treatment (10g/kg). Balance nitrogen.
     * Chemical Cure: Mancozeb 75 WP (2g/L) or Propiconazole 25 EC (1ml/L).

2. WHEAT (Gehun):
   - Rust (Yellow/Brown/Black):
     * Symptoms: Powder-like pustules on leaves, sheaths, and stems.
     * Organic Cure: Crop rotation, early sowing, neem seed kernel extract (5%).
     * Chemical Cure: Propiconazole 25 EC (1ml/L) or Mancozeb 75 WP (2g/L).
   - Loose Smut:
     * Symptoms: Grain heads turn completely into black powdery masses.
     * Organic Cure: Solar seed treatment (soak 4 hrs, dry in sun 4 hrs).
     * Chemical Cure: Seed treatment with Carboxin (Vitavax 75 WP) at 2.5g/kg.

3. COTTON (Kapaas):
   - Pink Bollworm:
     * Symptoms: Flared buds, rosetted flowers, bore holes on bolls with excreta.
     * Organic Cure: Pheromone traps (5/acre), Trichogramma chilonis (60,000/acre).
     * Chemical Cure: Emamectin Benzoate 5 SG (0.4g/L) or Spinosad 45 SC (0.3ml/L).
   - Leaf Curl Virus (CLCuD):
     * Symptoms: Upward/downward curling of leaf margins, thickened veins. Spread by whiteflies.
     * Organic Cure: Yellow sticky traps (10/acre), Neem Seed Kernel Extract (5%).
     * Chemical Cure: Imidacloprid 17.8 SL (0.5ml/L) or Acetamiprid 20 SP (0.2g/L).

4. CHILLI / TOMATO / BRINJAL:
   - Late Blight:
     * Symptoms: Large dark brown patches turning black, white downy growth on leaf undersides.
     * Organic Cure: Avoid overhead irrigation, copper-based preparations.
     * Chemical Cure: Metalaxyl 8% + Mancozeb 64% WP (2.5g/L) or Cymoxanil + Mancozeb (2g/L).

5. MAIZE (Makka):
   - Fall Armyworm (FAW):
     * Symptoms: Ragged holes, larvae with inverted Y on head, sawdust-like dung in leaf whorl.
     * Organic Cure: Sand + lime ash (9:1) into whorls. Release Trichogramma chilonis.
     * Chemical Cure: Spinetoram 11.7 SC (0.5ml/L) or Chlorantraniliprole 18.5 SC (0.4ml/L).

=== CROP DISEASE DIAGNOSIS WORKFLOW ===
For any crop disease query or image:
1. Identify crop + diagnose disease from symptoms.
2. State cause (fungal/bacterial/viral/pest).
3. Provide structured guide:
   - "🎯 Diagnosed Disease", "🌿 Organic Treatment", "🧪 Chemical Treatment", "🛡️ Prevention"
4. Keep tone friendly. Keep under 5 sentences for messaging.

=== LANGUAGE RULES ===
- Agar farmer Hindi mein baat kare → Hindi-Hinglish reply.
- Agar farmer English mein baat kare → simple English.

=== RESPONSE STYLE ===
- SHORT and ACTIONABLE — 3 to 5 sentences max.
- After answering, ALWAYS ask one relevant follow-up question.
- Use emojis sparingly for warmth.

=== STRICT FOCUS ===
You are strictly a farming/agricultural assistant. Politely decline off-topic questions.
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

        # 4. Fetch live data (mandi prices / weather) and inject into the prompt
        from apps.whatsapp_voice.services.intent import detect_intent
        from apps.whatsapp_voice.services.mandi import get_mandi_prices
        from apps.whatsapp_voice.services.weather import get_weather

        live_context = ""
        try:
            intent = detect_intent(user_text)
            parts_live = []
            if intent.get("wants_mandi") and intent.get("commodity"):
                mandi = get_mandi_prices(intent["commodity"])
                parts_live.append(f"MANDI PRICE DATA:\n{mandi['summary']}")
            if intent.get("wants_weather"):
                loc = intent.get("location") or user.location or "Delhi"
                weather = get_weather(loc)
                parts_live.append(f"WEATHER DATA:\n{weather['summary']}")
            live_context = "\n\n".join(parts_live)
        except Exception as live_err:
            logger.warning(f"MVP live data fetch error: {live_err}")

        # 5. Build current turn — may include image and live data
        current_parts = []
        if image_bytes:
            current_parts.append(
                types.Part.from_bytes(data=image_bytes, mime_type=image_mime)
            )
        enriched_text = (
            f"{user_text}\n\n[LIVE DATA — use in response]:\n{live_context}"
            if live_context else user_text
        )
        if enriched_text:
            current_parts.append(types.Part.from_text(text=enriched_text))
        
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
