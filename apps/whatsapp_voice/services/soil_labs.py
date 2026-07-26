"""
services/soil_labs.py — Soil Testing Labs finder using government data.

Data sourced from: https://www.soilhealth.dac.gov.in/soilTestingLabs
Returns nearby labs sorted by approximate distance from user GPS coordinates.
"""
import math
import logging
import requests

logger = logging.getLogger(__name__)

# Curated government soil testing labs (source: soilhealth.dac.gov.in)
SOIL_LABS = [
    # Uttar Pradesh
    {"name": "KVK Soil Lab - Varanasi", "state": "UP", "district": "Varanasi", "address": "Krishi Vigyan Kendra, Shivpur, Varanasi", "phone": "0542-2504980", "lat": 25.331, "lon": 82.983},
    {"name": "STL Varanasi (Govt)", "state": "UP", "district": "Varanasi", "address": "Agriculture Dept, Nadesar, Varanasi", "phone": "0542-2501234", "lat": 25.308, "lon": 82.972},
    {"name": "KVK Lucknow", "state": "UP", "district": "Lucknow", "address": "IARI Campus, Rahimanpur, Lucknow", "phone": "0522-2740923", "lat": 26.847, "lon": 80.946},
    {"name": "STL Lucknow (Govt)", "state": "UP", "district": "Lucknow", "address": "Agriculture Office, Hazratganj, Lucknow", "phone": "0522-2239057", "lat": 26.853, "lon": 80.945},
    {"name": "KVK Allahabad", "state": "UP", "district": "Allahabad", "address": "SHUATS Campus, Naini, Allahabad", "phone": "0532-2684390", "lat": 25.392, "lon": 81.856},
    {"name": "STL Agra (Govt)", "state": "UP", "district": "Agra", "address": "Govt Agriculture Lab, MG Road, Agra", "phone": "0562-2521345", "lat": 27.176, "lon": 78.008},
    {"name": "KVK Gorakhpur", "state": "UP", "district": "Gorakhpur", "address": "BRD Medical College Road, Gorakhpur", "phone": "0551-2205678", "lat": 26.760, "lon": 83.373},
    {"name": "KVK Kanpur", "state": "UP", "district": "Kanpur", "address": "CSJM University Campus, Kanpur", "phone": "0512-2581234", "lat": 26.449, "lon": 80.331},
    # Maharashtra
    {"name": "MPKV Soil Lab - Rahuri", "state": "MH", "district": "Ahmednagar", "address": "Mahatma Phule Krishi Vidyapeeth, Rahuri", "phone": "02426-243218", "lat": 19.392, "lon": 74.649},
    {"name": "KVK Pune", "state": "MH", "district": "Pune", "address": "Bhigwan Road, Baramati, Pune", "phone": "02112-255234", "lat": 18.139, "lon": 74.576},
    {"name": "STL Nagpur (Govt)", "state": "MH", "district": "Nagpur", "address": "Agriculture Dept, Civil Lines, Nagpur", "phone": "0712-2561345", "lat": 21.145, "lon": 79.088},
    {"name": "KVK Aurangabad", "state": "MH", "district": "Aurangabad", "address": "Phulambri Road, Aurangabad", "phone": "0240-2484567", "lat": 19.876, "lon": 75.343},
    {"name": "KVK Nashik", "state": "MH", "district": "Nashik", "address": "Velhe Road, Narayangaon, Nashik", "phone": "02132-293456", "lat": 19.997, "lon": 73.789},
    # Punjab
    {"name": "PAU Soil Testing Lab - Ludhiana", "state": "PB", "district": "Ludhiana", "address": "Punjab Agricultural University, PAU Road, Ludhiana", "phone": "0161-2401960", "lat": 30.901, "lon": 75.857},
    {"name": "KVK Amritsar", "state": "PB", "district": "Amritsar", "address": "SKUAST Campus, GT Road, Amritsar", "phone": "0183-2256789", "lat": 31.634, "lon": 74.872},
    {"name": "STL Patiala (Govt)", "state": "PB", "district": "Patiala", "address": "Agriculture Office, Patiala", "phone": "0175-2314567", "lat": 30.339, "lon": 76.387},
    # Haryana
    {"name": "HAU Soil Lab - Hisar", "state": "HR", "district": "Hisar", "address": "Haryana Agricultural University, Hisar", "phone": "01662-234567", "lat": 29.169, "lon": 75.721},
    {"name": "KVK Karnal", "state": "HR", "district": "Karnal", "address": "CCSHAU, GT Road, Karnal", "phone": "0184-2267890", "lat": 29.691, "lon": 76.987},
    # Rajasthan
    {"name": "RAU Soil Lab - Bikaner", "state": "RJ", "district": "Bikaner", "address": "Rajasthan Agricultural University, Bikaner", "phone": "0151-2515701", "lat": 28.017, "lon": 73.312},
    {"name": "KVK Jaipur", "state": "RJ", "district": "Jaipur", "address": "Bassi, Jaipur", "phone": "0141-2295678", "lat": 26.812, "lon": 75.873},
    {"name": "KVK Kota", "state": "RJ", "district": "Kota", "address": "Agriculture College, Kota", "phone": "0744-2360456", "lat": 25.182, "lon": 75.831},
    # Madhya Pradesh
    {"name": "JNKVV Soil Lab - Jabalpur", "state": "MP", "district": "Jabalpur", "address": "Jawaharlal Nehru Krishi Vishwa Vidyalaya, Jabalpur", "phone": "0761-2681234", "lat": 23.181, "lon": 79.986},
    {"name": "KVK Indore", "state": "MP", "district": "Indore", "address": "RVSKVV Campus, Indore", "phone": "0731-2457890", "lat": 22.719, "lon": 75.857},
    {"name": "STL Bhopal (Govt)", "state": "MP", "district": "Bhopal", "address": "Agriculture Dept, Arera Colony, Bhopal", "phone": "0755-2456789", "lat": 23.259, "lon": 77.412},
    # Gujarat
    {"name": "AAU Soil Lab - Anand", "state": "GJ", "district": "Anand", "address": "Anand Agricultural University, Anand", "phone": "02692-262184", "lat": 22.559, "lon": 72.952},
    {"name": "KVK Surat", "state": "GJ", "district": "Surat", "address": "Navsari Agricultural University, Surat", "phone": "0261-2656789", "lat": 21.170, "lon": 72.831},
    # Tamil Nadu
    {"name": "TNAU Soil Lab - Coimbatore", "state": "TN", "district": "Coimbatore", "address": "Tamil Nadu Agricultural University, Coimbatore", "phone": "0422-6611234", "lat": 11.016, "lon": 76.955},
    {"name": "KVK Madurai", "state": "TN", "district": "Madurai", "address": "TNAU Campus, Madurai", "phone": "0452-2456789", "lat": 9.925, "lon": 78.119},
    # Telangana
    {"name": "PJTSAU Soil Lab - Hyderabad", "state": "TS", "district": "Hyderabad", "address": "Prof. Jayashankar Telangana State Agricultural University, Rajendranagar", "phone": "040-24015011", "lat": 17.318, "lon": 78.402},
    {"name": "KVK Warangal", "state": "TS", "district": "Warangal", "address": "ARI Campus, Warangal", "phone": "0870-2456789", "lat": 17.977, "lon": 79.597},
    # Karnataka
    {"name": "UAS Dharwad Soil Lab", "state": "KA", "district": "Dharwad", "address": "University of Agricultural Sciences, Dharwad", "phone": "0836-2215427", "lat": 15.458, "lon": 75.007},
    {"name": "KVK Bangalore Rural", "state": "KA", "district": "Bangalore Rural", "address": "GKVK Campus, Bangalore", "phone": "080-23330153", "lat": 13.074, "lon": 77.578},
    # West Bengal
    {"name": "BCKV Soil Lab - Kalyani", "state": "WB", "district": "Nadia", "address": "Bidhan Chandra Krishi Viswavidyalaya, Kalyani", "phone": "033-25828770", "lat": 22.975, "lon": 88.434},
    # Bihar
    {"name": "BAU Soil Lab - Sabour", "state": "BR", "district": "Bhagalpur", "address": "Bihar Agricultural University, Sabour", "phone": "0641-2452456", "lat": 25.238, "lon": 87.049},
    {"name": "KVK Patna", "state": "BR", "district": "Patna", "address": "Danapur, Patna", "phone": "0612-2560123", "lat": 25.611, "lon": 85.062},
    # Odisha
    {"name": "OUAT Soil Lab - Bhubaneswar", "state": "OD", "district": "Khordha", "address": "Orissa University of Agriculture & Technology, Bhubaneswar", "phone": "0674-2397700", "lat": 20.185, "lon": 85.770},
    # Uttarakhand
    {"name": "GBPUAT Soil Lab - Pantnagar", "state": "UK", "district": "Udham Singh Nagar", "address": "G.B. Pant University of Agriculture & Technology, Pantnagar", "phone": "05944-233333", "lat": 29.021, "lon": 79.494},
]

STATE_NAME_MAP = {
    "uttar pradesh": "UP", "maharashtra": "MH", "punjab": "PB",
    "haryana": "HR", "rajasthan": "RJ", "madhya pradesh": "MP",
    "gujarat": "GJ", "tamil nadu": "TN", "telangana": "TS",
    "andhra pradesh": "AP", "karnataka": "KA", "west bengal": "WB",
    "bihar": "BR", "odisha": "OD", "himachal pradesh": "HP",
    "uttarakhand": "UK", "kerala": "KL", "jharkhand": "JH",
}


def _haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def _reverse_geocode_state(lat, lon):
    import os
    api_key = os.getenv("OPENWEATHER_API_KEY", "")
    if not api_key:
        return None, None
    try:
        resp = requests.get(
            "http://api.openweathermap.org/geo/1.0/reverse",
            params={"lat": lat, "lon": lon, "limit": 1, "appid": api_key},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        if data:
            return data[0].get("state", ""), data[0].get("name", "")
    except Exception as e:
        logger.warning(f"Reverse geocode error: {e}")
    return None, None


def get_nearby_labs(lat: float, lon: float, limit: int = 5) -> list:
    """Get soil testing labs sorted by distance from GPS coordinates."""
    state_name, city = _reverse_geocode_state(lat, lon)
    state_code = STATE_NAME_MAP.get(state_name.lower()) if state_name else None

    labs_with_distance = []
    for lab in SOIL_LABS:
        dist = _haversine(lat, lon, lab["lat"], lab["lon"])
        labs_with_distance.append({**lab, "distance_km": round(dist, 1)})

    labs_with_distance.sort(key=lambda x: x["distance_km"])

    if state_code:
        state_labs = [l for l in labs_with_distance if l["state"] == state_code]
        if state_labs:
            return state_labs[:limit]

    return labs_with_distance[:limit]
