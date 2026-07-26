<div align="center">

# 🌿 अरण्य · Aranya.ai

### *The AI Friend Every Indian Farmer Deserves*

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=for-the-badge)](LICENSE)
[![Built with Gemini](https://img.shields.io/badge/Powered%20By-Gemini%202.5-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20WhatsApp%20%7C%20Web-10b981?style=for-the-badge&logo=android&logoColor=white)](https://expo.dev)
[![Backend](https://img.shields.io/badge/Backend-Flask%20%2B%20Python-f59e0b?style=for-the-badge&logo=python&logoColor=white)](https://flask.palletsprojects.com)
[![CI](https://img.shields.io/github/actions/workflow/status/cosmickdd/aranya.ai/build-deploy.yml?style=for-the-badge&label=Build%20%26%20CI&logo=github)](https://github.com/cosmickdd/aranya.ai/actions)
[![EAS](https://img.shields.io/badge/EAS%20Build-Preview-6366f1?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)

<br/>

> **"Farmers don't want AI. They want a friend who knows farming."**
>
> Aranya speaks Hindi. Aranya remembers you. Aranya works on WhatsApp.
> *It's not a chatbot. It's a companion.*

<br/>

---

</div>

## ✨ What Is Aranya?

**Aranya.ai** is a multilingual AI farming companion built for the 600 million farmers of India. Instead of complex dashboards and English interfaces, Aranya works exactly where farmers already are — **WhatsApp, voice calls, and a native mobile app** — in their own language.

It's powered by **Google Gemini 2.5 Flash**, speaks Hindi/Hinglish naturally, and provides real-time crop disease diagnosis, live mandi prices, weather-based farming advice, and government scheme guidance — all through a single conversation.

<br/>

---

## 🔥 Core Features

<table>
<tr>
<td width="50%">

### 🎤 Voice-First AI
Talk to Aranya in Hindi using your natural voice. It understands your accent, your dialect, and your farming context — powered by **Sarvam AI** speech-to-text and text-to-speech.

</td>
<td width="50%">

### 📸 Crop Disease Detection
Take a photo of your crop. Aranya diagnoses the disease, explains the cause in Hindi, and gives you step-by-step remedies — no agronomist needed.

</td>
</tr>
<tr>
<td width="50%">

### 📈 Live Mandi Prices
Get today's live wholesale prices for 30+ crops from nearby mandis via AGMARKNET. Know when to sell and when to hold.

</td>
<td width="50%">

### 🌦️ Weather + Farming Advice
Real-time weather forecasts combined with smart farming advice — "Don't irrigate today, it will rain tomorrow" — in your local district.

</td>
</tr>
<tr>
<td width="50%">

### 🧠 Persistent Memory
Aranya remembers your farm, your crops, your soil type, and past conversations. Every interaction builds context — just like a real friend.

</td>
<td width="50%">

### 📱 Native Mobile App
A beautiful React Native app (Android + iOS) with real-time voice chat, push notifications, and offline capabilities built with Expo.

</td>
</tr>
</table>

<br/>

---

## 🌐 Channels

| Channel | Features |
|---|---|
| 📱 **Mobile App** (Android/iOS) | Voice chat, text, crop photos, history, offline support |
| 💬 **WhatsApp** | Text, voice notes, photos, mandi prices, weather |
| 📞 **Voice Calls** | Full Hindi voice conversations (inbound + outbound) |

<br/>

---

## 🏗️ System Architecture

```
                        ┌──────────────────────────────────────┐
                        │           Indian Farmer               │
                        └──────┬──────────┬──────────┬─────────┘
                               │          │          │
                    ┌──────────▼─┐  ┌─────▼────┐  ┌─▼────────┐
                    │ Mobile App │  │ WhatsApp │  │  Phone   │
                    │ (React     │  │ (Twilio) │  │  Call    │
                    │  Native)   │  └─────┬────┘  │ (Twilio) │
                    └──────┬─────┘        │        └─────┬────┘
                           │              │              │
                           └──────────────▼──────────────┘
                                          │
                              ┌───────────▼──────────────┐
                              │      Aranya Engine        │
                              │   (Gemini 2.5 Flash)     │
                              │   Flask · Python 3.11    │
                              └──┬───────┬───────┬───────┘
                                 │       │       │
                    ┌────────────▼─┐ ┌───▼───┐ ┌─▼──────────────┐
                    │  Sarvam AI   │ │SQLite │ │  External APIs  │
                    │ (STT + TTS)  │ │Memory │ │ Mandi · Weather │
                    └──────────────┘ └───────┘ └────────────────┘
```

All channels share the **same conversation memory** — a farmer can start on WhatsApp and continue on a voice call seamlessly.

<br/>

---

## 📁 Project Structure

```
Aranya.ai/
├── 📱 apps/
│   └── mobile-client/              # React Native + Expo app
│       ├── src/app/
│       │   ├── dashboard.tsx       # Main voice/chat interface
│       │   ├── sign-in.tsx         # Firebase auth (Google + Phone)
│       │   └── index.tsx           # Entry + onboarding
│       └── app.json                # Expo config
│
├── 🐍 apps/whatsapp_voice/         # Backend (Flask)
│   ├── server.py                   # Flask app entry point
│   ├── core/engine.py              # Gemini AI engine
│   ├── services/
│   │   ├── sarvam.py               # STT + TTS (Hindi voice)
│   │   ├── mandi.py                # Live mandi prices
│   │   └── weather.py              # Live weather + advice
│   ├── whatsapp/handler.py         # WhatsApp webhook
│   ├── voice/call_handler.py       # Voice call conversation
│   └── db/database.py              # SQLite conversation memory
│
├── 🔧 scripts/
│   └── validate-deployment.sh     # CI/CD health checks
│
├── ☁️ .github/workflows/
│   ├── build-deploy.yml            # CI: lint, test, validate
│   └── deploy-aws.yml              # CD: EC2 deploy (optional)
│
├── 🐳 Dockerfile                   # Production container
├── 🎛️ render.yaml                   # Render.com deployment config
└── 📋 azure.yaml                    # Azure deployment config
```

<br/>

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+**
- **Node.js 18+** (for mobile app)
- [Twilio account](https://twilio.com) — free trial works
- [Google AI Studio key](https://aistudio.google.com/app/apikey) — free
- [Sarvam AI key](https://sarvam.ai) — for Hindi voice
- [ngrok](https://ngrok.com/download) — for local webhook testing

---

### 1. Clone & Set Up Backend

```bash
git clone https://github.com/cosmickdd/aranya.ai.git
cd Aranya.ai

# Create a virtual environment
python -m venv .venv
source .venv/bin/activate        # Linux/Mac
# OR
.venv\Scripts\Activate.ps1       # Windows PowerShell

pip install -r apps/whatsapp_voice/requirements.txt
```

### 2. Configure Environment Variables

```bash
cp .env.example apps/whatsapp_voice/.env
```

Edit `apps/whatsapp_voice/.env`:

```env
# 🔑 Required
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
GEMINI_API_KEY=your_gemini_key
SARVAM_API_KEY=your_sarvam_key
PUBLIC_URL=https://your-ngrok-url.ngrok-free.app

# 🌐 Optional (enhances responses)
OPENWEATHER_API_KEY=your_owm_key
DATA_GOV_API_KEY=your_data_gov_key
```

### 3. Run the Backend

```bash
# Expose locally
ngrok http 5000

# Development server
cd apps/whatsapp_voice
python server.py

# Production (waitress)
USE_PRODUCTION_SERVER=true python server.py
```

### 4. Configure Twilio Webhooks

| Channel | Setting | URL |
|---|---|---|
| **WhatsApp** | When a message comes in | `https://your-url/whatsapp` (POST) |
| **Voice (inbound)** | A call comes in | `https://your-url/voice/incoming` (POST) |

---

### 5. Run the Mobile App

```bash
cd apps/mobile-client
npm install
npx expo start

# Android (physical device or emulator)
npx expo run:android

# Build a production APK
npx eas build -p android --profile preview
```

<br/>

---

## 📲 Try It Out

**WhatsApp test messages** — send these to the sandbox number:

```
"aaj gehun ka bhav kya hai varanasi mein?"   → 🌾 Live wheat mandi prices
"kal barish aayegi kya lucknow mein?"        → 🌦️ Weather + farming advice
"meri fasal mein kuch bimari lag gayi hai"   → 📸 Send a photo for diagnosis
[Send a voice note in Hindi]                 → 🎤 Transcribed + answered
```

<br/>

---

## ☁️ Deployment

Aranya is cloud-ready and production-tested:

| Platform | Config File | Status |
|---|---|---|
| **Render.com** | `render.yaml` | ✅ Primary (recommended) |
| **Docker** | `Dockerfile` | ✅ Containerized |
| **Azure** | `azure.yaml` + `infra/` | ✅ Bicep IaC ready |
| **AWS EC2** | `.github/workflows/deploy-aws.yml` | ✅ SSH deploy |

### One-Click Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

<br/>

---

## 🧪 Testing & CI

```bash
# Run deployment validation
bash scripts/validate-deployment.sh ci

# Health check
curl https://aranya-ai-6r0j.onrender.com/health

# Run backend tests
cd apps/whatsapp_voice && python -m pytest
```

CI runs automatically on every push via **GitHub Actions**:
- ✅ Python lint + dependency checks
- ✅ Docker image build validation
- ✅ Deployment environment validation

<br/>

---

## 🛣️ Roadmap

- [x] 🤖 Gemini-powered Hindi conversational AI
- [x] 💬 WhatsApp text + photos + voice notes
- [x] 📞 Inbound + outbound voice calls
- [x] 📈 Live mandi prices (AGMARKNET)
- [x] 🌦️ Live weather + farming advice
- [x] 📱 React Native mobile app (Android + iOS)
- [x] 🎤 Sarvam AI speech-to-text + text-to-speech
- [x] 🔒 Firebase authentication (Google + Phone OTP)
- [x] 🧠 Persistent conversation memory
- [x] 🐳 Docker + CI/CD pipeline
- [ ] 🗣️ Bhojpuri, Marathi, Punjabi, Tamil support
- [ ] 🌐 Farmer onboarding flow (location + crop detection)
- [ ] 💰 Agri-finance risk scoring engine
- [ ] 📡 Offline mode with sync

<br/>

---

## 🔒 Security

- **Twilio signature validation** — webhook requests are verified
- **No secrets in git** — `.env` is gitignored; use `.env.example` as template
- **Firebase Auth** — Google Sign-In + Phone OTP with JWT tokens
- **Rate limiting** — Flask-Limiter on all public endpoints
- **Test endpoints** — protected by `TEST_CALL_SECRET` header

<br/>

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

<br/>

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

Free to use, modify, and distribute. Attribution appreciated.

<br/>

---

<div align="center">

## 🌱 Built for India's Farmers

*"The goal is not a Q&A bot. The goal is a friend who happens to know everything about farming."*

<br/>

**Made with ❤️ in India**

[![GitHub](https://img.shields.io/badge/GitHub-cosmickdd-181717?style=for-the-badge&logo=github)](https://github.com/cosmickdd/aranya.ai)
[![Stars](https://img.shields.io/github/stars/cosmickdd/aranya.ai?style=for-the-badge&logo=github&color=f59e0b)](https://github.com/cosmickdd/aranya.ai/stargazers)

<br/>

*Aranya (अरण्य) — Sanskrit for "forest" — where life thrives in harmony.*

</div>
