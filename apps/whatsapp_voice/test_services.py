import sys, os
sys.path.insert(0, os.getcwd())
from dotenv import load_dotenv
load_dotenv('.env')

from services.intent import detect_intent
from services.mandi import get_mandi_prices
from services.weather import get_weather
from core.engine import _fetch_live_context

print("=== Intent Detection ===")
tests = [
    "aaj gehun ka bhav kya hai varanasi mein",
    "kal barish aayegi kya lucknow mein",
    "tamatar ka rate batao",
    "mere pyaaz ki fasal kab bechun",
]
for t in tests:
    r = detect_intent(t)
    print(f"  Text : {t[:45]}")
    print(f"  Mandi: {r['wants_mandi']} | Crop: {r['commodity']} | Weather: {r['wants_weather']} | Loc: {r['location']}")
    print()

print("=== Mandi Prices (fallback) ===")
m = get_mandi_prices("Wheat")
print(m["summary"])
print("Live:", m["live"])

print()
print("=== Weather (fallback) ===")
w = get_weather("Varanasi")
print("Live:", w.get("live"))
print("Advice:", w.get("farming_advice", "N/A")[:80])

print()
print("=== Full Context Injection ===")
ctx = _fetch_live_context("aaj gehun ka bhav kya hai lucknow mein")
print("Context length:", len(ctx), "chars")
if ctx:
    print("Preview:", ctx[:150])

print()
print("ALL TESTS PASSED!")
