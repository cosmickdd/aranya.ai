"""
services/intent.py — Lightweight intent + entity detector.

Detects whether a farmer's message is asking about:
  - mandi prices (and which commodity)
  - weather (and which location)

Does NOT use an LLM — pure keyword matching for speed and zero cost.
Runs before the Gemini call to decide whether to inject live data.
"""
import re

# ── Mandi price intent keywords ───────────────────────────────────────────────
MANDI_KEYWORDS = [
    "bhav", "rate", "price", "mandi", "bazar", "market",
    "quintal", "kharido", "becho", "bikri", "kab bechun",
    "kab bechu", "aaj ka bhav", "today price", "cost",
    "kitne mein", "kitna mil raha", "kya chal raha",
]

# ── Weather intent keywords ───────────────────────────────────────────────────
WEATHER_KEYWORDS = [
    "mausam", "weather", "barish", "rain", "baarish", "aandhee",
    "tufan", "garmi", "thand", "sardi", "temperature", "tapman",
    "hawa", "wind", "humidity", "fog", "dhund", "kal ka mausam",
    "aaj mausam", "spray kar sakta", "sinchai", "paani dena",
    "pesticide", "dawai dalna",
]

# ── Commodity names (for entity extraction) ───────────────────────────────────
COMMODITY_PATTERNS = {
    "Wheat":     r"\b(wheat|gehun|gehu|gehun)\b",
    "Rice":      r"\b(rice|chawal|dhan|paddy)\b",
    "Onion":     r"\b(onion|pyaaz|pyaz|kanda)\b",
    "Potato":    r"\b(potato|aloo|alu)\b",
    "Tomato":    r"\b(tomato|tamatar)\b",
    "Maize":     r"\b(maize|corn|makka|makkai|bhutta)\b",
    "Soybean":   r"\b(soybean|soya|soyabean)\b",
    "Cotton":    r"\b(cotton|kapas|rui)\b",
    "Mustard":   r"\b(mustard|sarson|rai)\b",
    "Sugarcane": r"\b(sugarcane|ganna|eikh)\b",
    "Garlic":    r"\b(garlic|lahsun)\b",
    "Ginger":    r"\b(ginger|adrak)\b",
    "Banana":    r"\b(banana|kela)\b",
    "Mango":     r"\b(mango|aam)\b",
    "Turmeric":  r"\b(turmeric|haldi)\b",
    "Chilli":    r"\b(chilli|mirch|lal mirch)\b",
    "Gram":      r"\b(gram|chana|chickpea)\b",
    "Lentil":    r"\b(lentil|masoor|dal)\b",
    "Groundnut": r"\b(groundnut|peanut|moongfali|mungfali)\b",
    "Arhar":     r"\b(arhar|tur|toor)\b",
}

# ── Known Indian cities/districts for location extraction ─────────────────────
KNOWN_LOCATIONS = [
    "varanasi", "lucknow", "patna", "jaipur", "bhopal", "nagpur",
    "pune", "ahmedabad", "ludhiana", "amritsar", "chandigarh", "delhi",
    "hyderabad", "indore", "agra", "kanpur", "gorakhpur", "meerut",
    "nashik", "aurangabad", "rajkot", "surat", "coimbatore", "madurai",
    "mysore", "hubli", "bangalore", "mumbai", "kolkata", "chennai",
    "up", "mp", "maharashtra", "punjab", "haryana", "rajasthan",
    "gujarat", "bihar", "bengal", "karnataka", "andhra",
]


def detect_intent(text: str) -> dict:
    """
    Analyse farmer's message for actionable intents.

    Returns:
    {
        "wants_mandi":   bool,
        "commodity":     str or None,
        "wants_weather": bool,
        "location":      str or None,
    }
    """
    text_lower = text.lower()

    # ── Check mandi intent
    wants_mandi = any(kw in text_lower for kw in MANDI_KEYWORDS)
    commodity = None
    if wants_mandi or True:  # also scan even without mandi keyword
        for name, pattern in COMMODITY_PATTERNS.items():
            if re.search(pattern, text_lower):
                commodity = name
                wants_mandi = True
                break

    # ── Check weather intent
    wants_weather = any(kw in text_lower for kw in WEATHER_KEYWORDS)

    # ── Extract location
    location = None
    for loc in KNOWN_LOCATIONS:
        if loc in text_lower:
            location = loc
            break

    return {
        "wants_mandi":   wants_mandi,
        "commodity":     commodity,
        "wants_weather": wants_weather,
        "location":      location,
    }
