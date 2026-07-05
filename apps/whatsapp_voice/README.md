# Aranya.ai — WhatsApp + Voice Calling

Full conversational AI for Indian farmers over WhatsApp + phone calls.

---

## Architecture

```
Farmer ──WhatsApp──► Twilio ──► /whatsapp ──► Aranya AI ──► Twilio ──► Farmer
Farmer ──Call──────► Twilio ──► /voice/incoming ──► Aranya AI (TTS) ──► Farmer's ear
Aranya ──OutboundCall──► Twilio ──► Farmer's phone (weather/mandi alerts)
```

All channels share the SAME SQLite database and conversation memory.

---

## Setup Guide

### Step 1 — Twilio Setup

1. Login to https://www.twilio.com/console
2. Copy your **Account SID** and **Auth Token** from the dashboard.
3. Go to **Phone Numbers** → Buy a number (choose one with Voice capability).
4. For WhatsApp testing → Go to **Messaging → Try it out → Send a WhatsApp message**
   - You'll get a sandbox number: `+1 415 523 8886`
   - Send `join <your-sandbox-word>` from your WhatsApp to activate the sandbox.

### Step 2 — Configure .env

Copy `.env.example` to `.env` and fill in:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
GEMINI_API_KEY=AIzaSy...
PUBLIC_URL=https://xxxx-xxxx.ngrok-free.app
```

### Step 3 — Run ngrok (expose localhost to internet)

Download ngrok from https://ngrok.com/download, then run:

```powershell
ngrok http 5000
```

Copy the `https://xxxx.ngrok-free.app` URL and put it in `.env` as `PUBLIC_URL`.

### Step 4 — Set Twilio Webhooks

In Twilio Console:

**WhatsApp Sandbox:**
- Messaging → Sandbox → "When a message comes in":
  `https://xxxx.ngrok-free.app/whatsapp` (HTTP POST)

**Voice (Inbound Calls):**
- Phone Numbers → Your number → Voice → "A call comes in":
  `https://xxxx.ngrok-free.app/voice/incoming` (HTTP POST)
- "Call status changes":
  `https://xxxx.ngrok-free.app/voice/status` (HTTP POST)

### Step 5 — Activate venv and Run

```powershell
cd c:\Users\ASUS\OneDrive\Desktop\repo\Aranya.ai\whatsapp_voice
.\venv\Scripts\Activate.ps1
python server.py
```

---

## Testing

### WhatsApp Test
1. Open WhatsApp on your phone
2. Message the sandbox number: `+1 415 523 8886`
3. Send any farming question in Hindi or English
4. Send a photo of your plant — Aranya will diagnose it
5. Send a voice note — Aranya will transcribe and reply

### Voice Call Test
1. Dial your Twilio phone number
2. Aranya answers in Hindi
3. Ask your question — e.g., "Bhai mere gehun ki patti peeli ho rahi hai"
4. Aranya responds in Hindi audio

### Outbound Alert Test (from code)
```python
from voice.outbound import call_farmer
call_farmer(
    to="+919876543210",
    message="Namaste! Kal tez barish aane wali hai. Apni fasal dhak lo aaj raat!"
)
```

Or via HTTP:
```
POST /test-call
{"to": "+919876543210", "message": "Test alert from Aranya!"}
```

---

## File Structure

```
whatsapp_voice/
├── server.py              # Flask app — all routes
├── config.py              # Env vars
├── requirements.txt
├── .env                   # Your credentials (create from .env.example)
├── .env.example
├── core/
│   └── engine.py          # Gemini AI — shared with Telegram
├── whatsapp/
│   └── handler.py         # WhatsApp text/image/voice note handler
├── voice/
│   ├── call_handler.py    # Inbound call + conversation loop
│   └── outbound.py        # Outbound alert calls to farmers
└── tts/
    └── tts.py             # gTTS text-to-speech for phone calls
```
