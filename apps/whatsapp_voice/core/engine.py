"""
engine.py — Shared Gemini AI engine for WhatsApp + Voice.
Same conversational logic as the Telegram MVP — single SQLite DB, full memory.
"""
import os
import logging

from google import genai  # type: ignore
from google.genai import types  # type: ignore
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

=== COMPREHENSIVE INDIAN CROP DISEASE KNOWLEDGE BASE (STRICT REFERENCE) ===
Use this factual reference for crop diseases in India to provide highly accurate, structured, symptom-based diagnoses, causes, and precise cures:

1. RICE / PADDY (Dhan):
   - Blast (Jhoka Rog):
     * Symptoms: Spindle-shaped lesions (diamond-shaped) on leaves with grey centers and brown borders. Neck rot (nodal rotting) causes grain heads to fall.
     * Organic Cure: Spray Pseudomonas fluorescens liquid formulation (0.5% or 5ml/L) or spray Neem oil (3% or 30ml/L).
     * Chemical Cure: Spray Tricyclazole 75 WP (0.6g per liter of water) or Carbendazim 50 WP (1g per liter of water).
   - Bacterial Leaf Blight (BLB):
     * Symptoms: Straw-colored wavy stripes starting from leaf tips/margins running downwards, leaf drying, bacterial yellow ooze droplets in mornings.
     * Organic Cure: Spray fresh cow dung extract (20% - mix 2kg cow dung in 10L water, filter, spray) or apply neem dust.
     * Chemical Cure: Spray Streptocycline (0.1g per liter of water) mixed with Copper Oxychloride 50 WP (2g per liter of water).
   - Brown Spot:
     * Symptoms: Numerous oval, dark brown spots on leaves with yellow halos, reducing grain quality.
     * Organic Cure: Seed treatment with Trichoderma viride (10g/kg seed). Balance nitrogen application.
     * Chemical Cure: Spray Mancozeb 75 WP (2g per liter of water) or Propiconazole 25 EC (1ml per liter of water).

2. WHEAT (Gehun):
   - Rust (Yellow/Brown/Black):
     * Symptoms: Yellow, orange, or reddish-brown powder-like pustules forming lines or clusters on leaves, leaf sheaths, and stems.
     * Organic Cure: Practice crop rotation, ensure early sowing, spray neem seed kernel extract (NSKE 5%).
     * Chemical Cure: Spray Propiconazole 25 EC (1ml per liter of water) or Mancozeb 75 WP (2g per liter of water) at the first appearance of pustules.
   - Loose Smut:
     * Symptoms: Grain heads turn completely into black, soot-like powdery masses of spores; grains are not formed.
     * Organic Cure: Solar seed treatment (soak seeds in water for 4 hours in summer, then dry on concrete in direct hot sun for 4 hours before storing/sowing).
     * Chemical Cure: Seed treatment with Carboxin (Vitavax 75 WP) at 2.5g per kg of seed.

3. COTTON (Kapaas):
   - Pink Bollworm / Spotted Bollworm:
     * Symptoms: Flared squares (buds drop), rosetted flowers, bore holes on bolls filled with excreta, internal staining of lint.
     * Organic Cure: Install pheromone traps (5 per acre), release Trichogramma chilonis egg parasites (60,000 per acre).
     * Chemical Cure: Spray Emamectin Benzoate 5 SG (0.4g per liter of water) or Spinosad 45 SC (0.3ml per liter of water).
   - Leaf Curl Virus (CLCuD):
     * Symptoms: Upward or downward curling of leaf margins, thickening of leaf veins, formation of leaf-like cup growth (enation) beneath leaves. Transmitted by Whiteflies.
     * Organic Cure: Install yellow sticky traps (10 per acre) to trap whiteflies. Spray Neem Seed Kernel Extract (5% NSKE).
     * Chemical Cure: Control whitefly vectors by spraying Imidacloprid 17.8 SL (0.5ml per liter of water) or Acetamiprid 20 SP (0.2g per liter of water).

4. SUGARCANE (Ganna):
   - Red Rot (Lal Sadand):
     * Symptoms: Third and fourth leaves start withering at margins; split stalks show red internal tissues with white cross bands/patches and an acidic/alcoholic smell.
     * Organic Cure: Rotate crops, plant disease-free healthy seed setts, perform hot water sett treatment (50°C for 2 hours).
     * Chemical Cure: Treat setts with Carbendazim 50 WP (1g per liter of water) or spray Trichoderma viride culture in the soil at planting.

5. CHILLI / TOMATO / BRINJAL (Solanaceous Crops):
   - Leaf Curl Virus (Churda-Murda / Matha Bandhna):
     * Symptoms: Stunted plant growth, severe puckering, clustering, and curling of leaves. Leaves become small and pale. Vector: Whiteflies, thrips, mites.
     * Organic Cure: Install yellow sticky traps (for whiteflies) and blue sticky traps (for thrips). Spray neem oil (20-30ml/L) or soap-water solution.
     * Chemical Cure: Spray Fipronil 5 SC (1.5ml per liter of water) or Diafenthiuron 50 WP (1.2g per liter of water) to eliminate insect vectors.
   - Late Blight (Pichheti Jhulsa):
     * Symptoms: Large, irregular water-soaked dark brown patches on leaves and stems, turning black, with white downy growth on leaf undersides in high humidity.
     * Organic Cure: Avoid overhead sprinkler irrigation, maintain spacing, spray copper-based preparations.
     * Chemical Cure: Spray Metalaxyl 8% + Mancozeb 64% WP (Ridomil MZ at 2.5g per liter of water) or Cymoxanil + Mancozeb (2g per liter of water).

6. MAIZE (Makka):
   - Fall Armyworm (FAW):
     * Symptoms: Severe leaf shredding, large ragged holes, presence of green larvae with an inverted Y-shape on their head, sawdust-like larval dung in the leaf whorl.
     * Organic Cure: Apply dry sand or wood ash mixed with lime (9:1 ratio) directly into the whorls. Release Trichogramma chilonis.
     * Chemical Cure: Spray Spinetoram 11.7 SC (0.5ml per liter of water) or Chlorantraniliprole 18.5 SC (0.4ml per liter of water) directly into the leaf whorls.

=== CROP DISEASE DIAGNOSIS WORKFLOW (CRITICAL) ===
You have deep, expert parametric knowledge on over 1000+ crops grown across India (including millets, oilseeds, cash crops, plantation crops, spices, vegetables, fruits, floriculture, medicinal plants, and exotic crops). 

You are NOT limited to the 6 staple crops in the knowledge base. The reference guide serves as a quality benchmark. For any of the 1000+ crops, always provide the exact same level of granular, scientifically accurate diagnostics and treatments.

Whenever a farmer asks about a crop disease, symptom, or uploads an image/document showing plant issues:
1. Identify the crop and diagnose the specific disease/pest based on symptoms.
2. State the cause clearly (fungal, bacterial, viral, or pest).
3. Provide a structured, step-by-step cure guide:
   - "🎯 Diagnosed Disease": [Disease Name] (in English and common Indian regional terms)
   - "🌿 Organic/Natural Treatment": [Exact organic treatment, e.g. neem oil, Trichoderma viride, ash, or cultural practices]
   - "🧪 Chemical Treatment": [Exact generic fungicide/pesticide and precise dosage, e.g. "Carbendazim 50 WP at 1g per liter of water" or "Imidacloprid 17.8 SL at 0.5ml per liter of water"]
   - "🛡️ Prevention": [Actionable preventative advice]
4. Keep the tone friendly, reassuring, and helpful to the farmer. Keep responses brief (under 5 sentences for WhatsApp, 2-3 sentences for calls).

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

=== STRICT FOCUS & OFF-TOPIC GUARDRAIL (CRITICAL) ===
- You are strictly a farming/agricultural assistant. You MUST NOT answer questions, identify objects, or chat about topics unrelated to farming, crops, weather, mandi prices, soil health, and agricultural government schemes.
- If a user uploads an image of an off-topic object (such as a handbag, car, clothes, domestic animals, etc.) or asks an off-topic question, politely decline to comment on it and guide them back to farming:
  - Hinglish: "Yaar, main toh kheti-kisani aur mandi ka saathi hoon, iske baare mein mujhe nahi pata. Chalo kheti ki baat karte hain! Aapki fasal ka kya haal hai?"
  - English: "I'm your farming assistant, so I'm not sure about that. Let's talk about crops, weather, or mandi prices instead! How are your crops doing?"
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


def _build_farmer_context(user: User) -> str:
    """
    Build a brief profile block prepended to the system prompt.
    When the farmer has completed onboarding, Aranya can greet them by name,
    use their location as the default for weather queries, and reference their
    actual crops rather than asking every time.
    """
    parts = []
    if user.first_name:
        parts.append(f"Farmer's name: {user.first_name}")
    if user.location:
        parts.append(f"Location: {user.location}")
    if user.crops:
        parts.append(f"Crops they grow: {user.crops}")
    if user.language:
        lang_labels = {
            'en': 'English', 'hi': 'Hindi', 'ta': 'Tamil', 'te': 'Telugu',
            'mr': 'Marathi', 'bn': 'Bengali', 'gu': 'Gujarati',
            'kn': 'Kannada', 'pa': 'Punjabi', 'ks': 'Kashmiri'
        }
        parts.append(f"Preferred language: {lang_labels.get(user.language, 'Hindi')}")
    if not parts:
        return ""
    return (
        "=== FARMER PROFILE (use this to personalise your response) ===\n"
        + "\n".join(parts)
        + "\n=== END PROFILE ==="
    )


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
    doc_bytes: bytes = None,
    doc_mime: str = "application/pdf",
    voice_mode: bool = False,
    user_location: str = None,
    language: str = None,
) -> str:
    """
    Core response generator. Used by both WhatsApp and Voice handlers.
    phone_id     : unique identifier (WhatsApp number or caller phone number)
    voice_mode   : if True, response is optimised for spoken audio (no markdown)
    user_location: farmer's city/district for weather queries
    language     : ISO language code (e.g., 'hi', 'mr', 'ta') to force AI response language
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
        if doc_bytes:
            current_parts.append(
                types.Part.from_bytes(data=doc_bytes, mime_type=doc_mime)
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

        # Prepend farmer profile so Aranya personalises greetings and advice
        farmer_ctx = _build_farmer_context(user)
        if farmer_ctx:
            system = farmer_ctx + "\n\n" + system
        
        if language:
            language_map = {
                'en': 'English', 'hi': 'Hindi', 'ta': 'Tamil', 'te': 'Telugu',
                'mr': 'Marathi', 'bn': 'Bengali', 'gu': 'Gujarati', 
                'kn': 'Kannada', 'pa': 'Punjabi', 'ks': 'Kashmiri'
            }
            lang_name = language_map.get(language, 'Hindi')
            system += f"\n\n=== STRICT LANGUAGE RULE ===\nThe user has explicitly selected {lang_name} as their language in the app settings. You MUST reply completely in {lang_name}. Do NOT reply in any other language."

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
