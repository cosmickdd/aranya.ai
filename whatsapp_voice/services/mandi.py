"""
services/mandi.py — Live mandi price fetcher from data.gov.in (AGMARKNET)

Free API from Government of India. No quota limits for basic use.
Get your API key at: https://data.gov.in/user/register (free, instant)

Covers 3000+ mandis across India with daily price updates.
"""
import os
import logging
import requests
from datetime import datetime, timedelta
from functools import lru_cache

logger = logging.getLogger(__name__)

DATA_GOV_API_KEY = os.getenv("DATA_GOV_API_KEY", "")

# Commodity name normalisation — farmers say many things for the same crop
COMMODITY_ALIASES = {
    "wheat":       ["wheat", "gehun", "gehun", "gehu"],
    "rice":        ["rice", "chawal", "dhan", "paddy"],
    "onion":       ["onion", "pyaaz", "pyaz", "kanda"],
    "potato":      ["potato", "aloo", "alu"],
    "tomato":      ["tomato", "tamatar"],
    "maize":       ["maize", "corn", "makka", "makkai", "bhutta"],
    "soybean":     ["soybean", "soya", "soyabean"],
    "cotton":      ["cotton", "kapas", "rui"],
    "sugarcane":   ["sugarcane", "ganna", "eikh"],
    "mustard":     ["mustard", "sarson", "rai"],
    "garlic":      ["garlic", "lahsun"],
    "ginger":      ["ginger", "adrak"],
    "banana":      ["banana", "kela"],
    "mango":       ["mango", "aam"],
    "turmeric":    ["turmeric", "haldi"],
    "chilli":      ["chilli", "mirch", "lal mirch"],
    "gram":        ["gram", "chana", "chickpea"],
    "lentil":      ["lentil", "masoor", "dal"],
    "groundnut":   ["groundnut", "peanut", "moongfali", "mungfali"],
    "arhar":       ["arhar", "tur", "toor", "pigeon pea"],
}


def _normalize_commodity(name: str) -> str:
    """Map farmer's word to standard commodity name."""
    name_lower = name.lower().strip()
    for standard, aliases in COMMODITY_ALIASES.items():
        if name_lower in aliases or name_lower == standard:
            return standard.title()
    return name.title()


def get_mandi_prices(commodity: str, state: str = None, limit: int = 8) -> dict:
    """
    Fetch live mandi prices from data.gov.in AGMARKNET API.

    Returns dict with:
      - commodity: name
      - prices: list of {mandi, district, state, min_price, max_price, modal_price, date}
      - summary: human-readable summary string
    """
    commodity_normalized = _normalize_commodity(commodity)

    if not DATA_GOV_API_KEY:
        return _fallback_prices(commodity_normalized)

    try:
        params = {
            "api-key":  DATA_GOV_API_KEY,
            "format":   "json",
            "filters[commodity]": commodity_normalized,
            "limit":    limit * 2,  # fetch more, filter later
        }
        if state:
            params["filters[state]"] = state

        resp = requests.get(
            "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070",
            params=params,
            timeout=8,
        )
        resp.raise_for_status()
        data = resp.json()

        records = data.get("records", [])
        if not records:
            return _fallback_prices(commodity_normalized)

        prices = []
        for r in records[:limit]:
            prices.append({
                "mandi":       r.get("market", ""),
                "district":    r.get("district", ""),
                "state":       r.get("state", ""),
                "min_price":   r.get("min_price", "N/A"),
                "max_price":   r.get("max_price", "N/A"),
                "modal_price": r.get("modal_price", "N/A"),
                "date":        r.get("arrival_date", ""),
            })

        summary = _build_price_summary(commodity_normalized, prices)
        return {"commodity": commodity_normalized, "prices": prices, "summary": summary, "live": True}

    except Exception as e:
        logger.warning(f"Mandi API error: {e}. Using fallback.")
        return _fallback_prices(commodity_normalized)


def _build_price_summary(commodity: str, prices: list) -> str:
    """Build a natural-language summary of prices."""
    if not prices:
        return f"Aaj {commodity} ke bhav nahi mile."

    modal_prices = []
    for p in prices:
        try:
            modal_prices.append(float(str(p["modal_price"]).replace(",", "")))
        except:
            pass

    if not modal_prices:
        return f"{commodity} ke bhav available nahi hain abhi."

    avg   = sum(modal_prices) / len(modal_prices)
    low   = min(modal_prices)
    high  = max(modal_prices)
    top   = prices[0]

    summary = (
        f"Aaj {commodity} ka bhav:\n"
        f"  {top['mandi']} ({top['state']}): Rs.{top['modal_price']}/quintal\n"
        f"  Range: Rs.{int(low)} - Rs.{int(high)}/quintal\n"
        f"  Average: Rs.{int(avg)}/quintal"
    )
    return summary


def _fallback_prices(commodity: str) -> dict:
    """
    Static fallback prices when API key is not set or API is down.
    Based on typical 2024-25 Indian market prices.
    """
    FALLBACK = {
        "Wheat":      (2300, 2500, 2400),
        "Rice":       (2100, 2400, 2250),
        "Onion":      (800,  1500, 1100),
        "Potato":     (600,  1200, 900),
        "Tomato":     (500,  2000, 1200),
        "Maize":      (1800, 2200, 2000),
        "Soybean":    (3800, 4500, 4200),
        "Cotton":     (6000, 7500, 6800),
        "Mustard":    (4800, 5500, 5200),
        "Garlic":     (3000, 8000, 5000),
        "Ginger":     (4000, 10000, 7000),
        "Gram":       (4500, 5500, 5000),
        "Groundnut":  (5000, 6500, 5800),
        "Arhar":      (5500, 7000, 6200),
        "Turmeric":   (8000, 15000, 12000),
        "Sugarcane":  (320,  380,   350),
    }
    low, high, modal = FALLBACK.get(commodity, (1000, 3000, 2000))
    summary = (
        f"{commodity} ka typical bhav (estimated):\n"
        f"  Range: Rs.{low} - Rs.{high}/quintal\n"
        f"  Modal price: Rs.{modal}/quintal\n"
        f"  Note: Exact aaj ka bhav ke liye apni local mandi app check karo."
    )
    return {
        "commodity": commodity,
        "prices": [{"mandi": "Estimated", "modal_price": modal, "min_price": low, "max_price": high}],
        "summary": summary,
        "live": False,
    }
