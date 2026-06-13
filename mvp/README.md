# Aranya.ai — Telegram MVP

Your personal AI farming companion for Indian farmers.
Talk like a friend. Ask anything. Send photos of sick crops. Use voice messages.

---

## Setup (5 minutes)

### Step 1 — Get your Telegram Bot Token

1. Open Telegram on your phone
2. Search for **@BotFather**
3. Send `/newbot`
4. Give it a name: e.g. `Aranya Farm AI`
5. Give it a username: e.g. `aranya_farm_bot`
6. Copy the token it gives you (looks like `123456:ABCdef...`)

### Step 2 — Get your Gemini API Key

1. Go to: https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key

### Step 3 — Set up the .env file

1. In the `mvp/` folder, copy `.env.example` to `.env`
2. Edit `.env` and fill in both keys:

```
TELEGRAM_BOT_TOKEN=123456:ABCdefGhijklmNOP...
GEMINI_API_KEY=AIzaSy...
```

### Step 4 — Run the bot

Open PowerShell in the `mvp/` folder and run:

```powershell
# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Start Aranya
python main.py
```

You will see:
```
=======================================================
  Aranya.ai is LIVE on Telegram!
  Open Telegram, find your bot, and say Namaste!
  Press Ctrl+C to stop.
=======================================================
```

### Step 5 — Talk to your bot!

Open Telegram, find your bot by its username, and send:
- Any text message in Hindi or English
- A photo of your crop/plants (it will diagnose diseases!)
- A voice message (it will transcribe and respond)
- `/reset` to clear conversation history
- `/start` to see the welcome message again

---

## What Aranya can do

| Feature | How to use |
|---|---|
| Crop advice | "Gehun mein kaunsa khad dalun?" |
| Disease diagnosis | Send a photo of the sick plant |
| Mandi prices | "Aaj pyaaz ka bhav kya hai?" |
| Weather advice | "Kal barish hai toh kya karun?" |
| Govt schemes | "PM KISAN ka paisa kab aata hai?" |
| Voice messages | Just record and send |
| Hindi/English | Automatically detects and replies in same language |

---

## Project Structure

```
mvp/
├── main.py           # Bot entry point
├── requirements.txt  # Python dependencies
├── .env              # Your API keys (create this from .env.example)
├── .env.example      # Template
├── bot/
│   └── handlers.py   # Telegram message routing
├── core/
│   └── engine.py     # Gemini AI engine + conversation memory
└── db/
    └── database.py   # SQLite schema (Users + Messages)
```

Database is stored at: `aranya_mvp.db` (in the repo root)
