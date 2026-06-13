"""
services/weather.py — Live weather fetcher using OpenWeatherMap API

Free tier: 1000 calls/day, current weather + 5-day forecast.
Get your free API key at: https://openweathermap.org/api (instant, no credit card)

Converts raw weather data into farming-relevant advice in Hindi/English.
"""
import os
import logging
import requests

logger = logging.getLogger(__name__)

OWM_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
OWM_BASE    = "https://api.openweathermap.org/data/2.5"

# Major Indian agricultural districts mapped to coordinates for better accuracy
LOCATION_CACHE = {
    "varanasi":     (25.3176, 82.9739),
    "lucknow":      (26.8467, 80.9462),
    "patna":        (25.5941, 85.1376),
    "jaipur":       (26.9124, 75.7873),
    "bhopal":       (23.2599, 77.4126),
    "nagpur":       (21.1458, 79.0882),
    "pune":         (18.5204, 73.8567),
    "ahmedabad":    (23.0225, 72.5714),
    "ludhiana":     (30.9010, 75.8573),
    "amritsar":     (31.6340, 74.8723),
    "chandigarh":   (30.7333, 76.7794),
    "delhi":        (28.6139, 77.2090),
    "hyderabad":    (17.3850, 78.4867),
    "indore":       (22.7196, 75.8577),
    "agra":         (27.1767, 78.0081),
    "kanpur":       (26.4499, 80.3319),
    "gorakhpur":    (26.7606, 83.3732),
    "meerut":       (28.9845, 77.7064),
    "nashik":       (19.9975, 73.7898),
    "aurangabad":   (19.8762, 75.3433),
    "rajkot":       (22.3039, 70.8022),
    "surat":        (21.1702, 72.8311),
    "coimbatore":   (11.0168, 76.9558),
    "madurai":      (9.9252,  78.1198),
    "mysore":       (12.2958, 76.6394),
    "hubli":        (15.3647, 75.1240),
}


def get_weather(location: str) -> dict:
    """
    Get current weather + 3-day forecast for a location.
    Returns a dict with weather data and a farming-advice summary.
    """
    if not OWM_API_KEY:
        return _fallback_weather(location)

    try:
        # Try to resolve location to lat/lon first for accuracy
        lat, lon = _resolve_location(location)

        # Current weather
        current_resp = requests.get(
            f"{OWM_BASE}/weather",
            params={"lat": lat, "lon": lon, "appid": OWM_API_KEY, "units": "metric"},
            timeout=6,
        )
        current_resp.raise_for_status()
        current = current_resp.json()

        # 5-day forecast (3-hour intervals)
        forecast_resp = requests.get(
            f"{OWM_BASE}/forecast",
            params={"lat": lat, "lon": lon, "appid": OWM_API_KEY, "units": "metric", "cnt": 8},
            timeout=6,
        )
        forecast_resp.raise_for_status()
        forecast_data = forecast_resp.json()

        weather = {
            "location":    location.title(),
            "temp":        current["main"]["temp"],
            "feels_like":  current["main"]["feels_like"],
            "humidity":    current["main"]["humidity"],
            "condition":   current["weather"][0]["description"],
            "wind_speed":  current["wind"]["speed"],
            "rain_1h":     current.get("rain", {}).get("1h", 0),
            "forecast":    _parse_forecast(forecast_data),
            "live":        True,
        }

        weather["summary"] = _build_weather_summary(weather)
        weather["farming_advice"] = _farming_advice(weather)
        return weather

    except Exception as e:
        logger.warning(f"Weather API error for '{location}': {e}. Using fallback.")
        return _fallback_weather(location)


def _resolve_location(location: str):
    """Get lat/lon for a location using geocoding or our cache."""
    loc_lower = location.lower().strip()

    # Check local cache first
    for key, coords in LOCATION_CACHE.items():
        if key in loc_lower or loc_lower in key:
            return coords

    # Use OWM geocoding API
    geo_resp = requests.get(
        "http://api.openweathermap.org/geo/1.0/direct",
        params={"q": f"{location},IN", "limit": 1, "appid": OWM_API_KEY},
        timeout=5,
    )
    geo_resp.raise_for_status()
    geo = geo_resp.json()
    if geo:
        return geo[0]["lat"], geo[0]["lon"]

    # Default: Delhi
    return 28.6139, 77.2090


def _parse_forecast(forecast_data: dict) -> list:
    """Extract next 24h forecast in 3-hour intervals."""
    forecasts = []
    for item in forecast_data.get("list", [])[:8]:
        forecasts.append({
            "time":      item["dt_txt"],
            "temp":      item["main"]["temp"],
            "condition": item["weather"][0]["description"],
            "rain_prob": item.get("pop", 0) * 100,  # probability of precipitation
            "rain_mm":   item.get("rain", {}).get("3h", 0),
        })
    return forecasts


def _build_weather_summary(w: dict) -> str:
    """Build a concise weather summary."""
    rain_info = ""
    if w["rain_1h"] > 0:
        rain_info = f", pichle 1 ghante mein {w['rain_1h']}mm barish"

    # Check forecast for upcoming rain
    upcoming_rain = [f for f in w["forecast"] if f["rain_prob"] > 50]
    rain_forecast = ""
    if upcoming_rain:
        rain_forecast = f"\n• Agle 24 ghante mein barish ki sambhavna: {int(upcoming_rain[0]['rain_prob'])}%"

    return (
        f"{w['location']} ka mausam:\n"
        f"• Abhi: {w['condition'].title()}, {w['temp']:.0f}°C (feels like {w['feels_like']:.0f}°C){rain_info}\n"
        f"• Humidity: {w['humidity']}% | Wind: {w['wind_speed']:.1f} m/s"
        f"{rain_forecast}"
    )


def _farming_advice(w: dict) -> str:
    """Convert weather data into actionable farming advice."""
    advices = []
    temp = w["temp"]
    humidity = w["humidity"]
    upcoming_rain = [f for f in w["forecast"] if f["rain_prob"] > 60]

    # Temperature advice
    if temp > 40:
        advices.append("Bahut tez garmi hai — is waqt khet mein kaam karna avoid karo, subah ya shaam karo.")
    elif temp < 5:
        advices.append("Thand bahut zyada hai — palle fasal ke liye frost protection karo aaj raat.")

    # Rain advice
    if upcoming_rain:
        rain_prob = int(upcoming_rain[0]["rain_prob"])
        advices.append(f"Agle 24 ghante mein barish ({rain_prob}% chance) — pesticide/fertilizer ABHI mat dalo, barish mein beh jaayega.")
    else:
        if humidity < 40:
            advices.append("Humidity kam hai — fasal ko paani ki zaroorat hai, sinchai karo.")

    # Wind advice
    if w["wind_speed"] > 8:
        advices.append("Tez hawa chal rahi hai — spray karne ka sahi time nahi hai.")

    if not advices:
        advices.append("Mausam theek hai — khet ka kaam aaram se kar sakte ho.")

    return " | ".join(advices)


def _fallback_weather(location: str) -> dict:
    """Return seasonal average when API is not available."""
    return {
        "location": location.title(),
        "summary": (
            f"{location.title()} ka live mausam abhi available nahi hai.\n"
            "Weather API key set karo .env file mein (OPENWEATHER_API_KEY).\n"
            "Free key milegi: openweathermap.org/api"
        ),
        "farming_advice": "Live mausam ke liye apna local weather app dekho.",
        "live": False,
    }
