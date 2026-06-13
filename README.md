# 🌾 Aranya.ai — AI Farming Companion for Indian Farmers

> **"Farmers don't want AI. They want a friend who knows farming."**

Aranya is a conversational AI companion that talks to Indian farmers like a trusted friend — over WhatsApp, phone calls, and Telegram. It speaks Hindi/Hinglish, understands farming deeply, remembers your situation, and gives practical advice on crops, weather, mandi prices, diseases, and government schemes.

---

## ✨ What Aranya Can Do

| Feature | Channels |
|---|---|
| 💬 Chat in Hindi/Hinglish | WhatsApp, Telegram |
| 📸 Diagnose crop diseases from photos | WhatsApp, Telegram |
| 🎤 Understand voice notes | WhatsApp, Telegram |
| 📞 Full voice conversations (farmer calls AI) | Phone call |
| 📣 Proactive outbound alerts (weather, mandi) | Phone call |
| 🌦️ Live weather + farming advice | All |
| 📈 Live mandi prices (30+ crops) | All |
| 🧠 Persistent memory across sessions | All |

---

## 🏗️ Architecture

```
Farmer
  │
  ├── WhatsApp ──► Twilio ──────────────┐
  ├── Phone Call ► Twilio TwiML ────────┤
  └── Telegram ──► Telegram Bot API ────┤
                                        ▼
                              ┌─────────────────┐
                              │  Aranya Engine  │
                              │  (Gemini 2.5)   │
                              └────────┬────────┘
                                       │
                        ┌──────────────┼──────────────┐
                        ▼              ▼              ▼
                   SQLite DB     Mandi API       Weather API
                  (memory)    (data.gov.in)  (OpenWeatherMap)
```

All channels share the **same conversation memory** — a farmer can start on WhatsApp and continue on a call seamlessly.

---

## 📁 Project Structure

```
Aranya.ai/
├── mvp/                        # Telegram bot (Phase 1 MVP)
│   ├── bot/handlers.py         # Telegram message handlers
│   ├── core/engine.py          # Gemini AI engine
│   ├── db/database.py          # SQLite schema
│   └── main.py                 # Bot entry point
│
└── whatsapp_voice/             # WhatsApp + Voice (Phase 2)
    ├── server.py               # Flask app (production-ready)
    ├── config.py               # Environment variables
    ├── requirements.txt
    ├── core/engine.py          # Shared AI engine
    ├── db/database.py          # Shared SQLite DB
    ├── whatsapp/handler.py     # WhatsApp webhook handler
    ├── voice/
    │   ├── call_handler.py     # Inbound call conversation loop
    │   └── outbound.py        # Outbound alert calls
    ├── tts/tts.py              # Hindi text-to-speech
    └── services/
        ├── mandi.py            # Live mandi price fetcher
        ├── weather.py          # Live weather + farming advice
        └── intent.py           # Zero-cost intent detector
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- [Twilio account](https://twilio.com) (free trial works)
- [Google AI Studio API key](https://aistudio.google.com/app/apikey) (free)
- [ngrok](https://ngrok.com/download) for local testing

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/Aranya.ai.git
cd Aranya.ai/whatsapp_voice

python -m venv venv
# Windows:
.\venv\Scripts\Activate.ps1
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
GEMINI_API_KEY=your_gemini_key
PUBLIC_URL=https://your-ngrok-url.ngrok-free.app

# Optional: enables live mandi prices
DATA_GOV_API_KEY=your_data_gov_key

# Optional: enables live weather
OPENWEATHER_API_KEY=your_owm_key
```

### 3. Expose Locally with ngrok

```bash
ngrok http 5000
# Copy the https URL to PUBLIC_URL in .env
```

### 4. Start the Server

```bash
# Development
python server.py

# Production
USE_PRODUCTION_SERVER=true python server.py
# or directly:
waitress-serve --host=0.0.0.0 --port=5000 server:app
```

### 5. Configure Twilio Webhooks

**WhatsApp** → Twilio Console → Messaging → Sandbox Settings:
- When a message comes in: `https://your-url/whatsapp` (POST)

**Voice** → Phone Numbers → Your Number → Voice:
- A call comes in: `https://your-url/voice/incoming` (POST)

**Join WhatsApp Sandbox**: Send `join <keyword>` to `+1 415 523 8886`

---

## 🧪 Testing

```bash
# Health check
curl https://your-url/health

# Test mandi + weather intent detection
python test_services.py
```

**WhatsApp test messages:**
- `"aaj gehun ka bhav kya hai varanasi mein?"` → Live wheat prices
- `"kal barish aayegi kya lucknow mein?"` → Weather + farming advice
- Send a plant photo → Crop disease diagnosis
- Send a voice note → Transcribed and answered

---

## 🔑 Optional API Keys (Free Tier)

| Service | What it unlocks | Get key |
|---|---|---|
| OpenWeatherMap | Live weather for any Indian district | [openweathermap.org/api](https://openweathermap.org/api) |
| data.gov.in | Live daily mandi prices (AGMARKNET) | [data.gov.in/user/register](https://data.gov.in/user/register) |

Without these keys, Aranya uses smart fallback estimates and still works great.

---

## 🌱 Telegram MVP (Phase 1)

The original Telegram bot is in `mvp/`. Run it separately:

```bash
cd mvp
pip install -r requirements.txt
# Add TELEGRAM_BOT_TOKEN and GEMINI_API_KEY to mvp/.env
python main.py
```

---

## 🛣️ Roadmap

- [x] Telegram conversational bot
- [x] WhatsApp text + photo + voice notes
- [x] Inbound + outbound voice calls in Hindi
- [x] Live mandi price integration
- [x] Live weather + farming advice
- [ ] React Native mobile app
- [ ] Farmer onboarding flow (location + crop detection)
- [ ] Multi-language: Bhojpuri, Marathi, Punjabi, Tamil
- [ ] Agri-finance risk scoring engine

---

## 🔒 Security

- Twilio webhook signature validation (enable with `VALIDATE_TWILIO_SIGNATURE=true`)
- No credentials committed to git (`.env` is gitignored)
- Test endpoint protected by `TEST_CALL_SECRET` header

---

## 📄 License

MIT License — see [LICENSE](LICENSE)

---

## 🙏 Built for Indian farmers

*"The goal is not a Q&A bot. The goal is a friend who happens to know everything about farming."*
