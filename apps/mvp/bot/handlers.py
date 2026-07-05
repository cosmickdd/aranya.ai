import os
import logging
import tempfile

from telegram import Update
from telegram.ext import ContextTypes
from core.engine import generate_response, reset_user_history

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# /start — Onboarding
# ─────────────────────────────────────────────────────────────────────────────
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    first_name = user.first_name or "Dost"

    welcome = (
        f"Namaste {first_name}! 🙏🌾\n\n"
        f"Main hoon *Aranya* — tumhara personal khet ka saathi.\n\n"
        f"Mujhse kuch bhi poochho:\n"
        f"• 🌾 Fasal ke baare mein\n"
        f"• 🐛 Bimari ya kide\n"
        f"• 🌦️ Mausam ki salah\n"
        f"• 💰 Mandi ke bhav\n"
        f"• 🏛️ Sarkari yojanaein\n\n"
        f"📸 Photo bhejo fasal ki — main dekh ke bataunga kya ho raha hai.\n"
        f"🎤 Voice message bhi bhej sakte ho!\n\n"
        f"Batao, aaj khet mein kya chal raha hai? 😊"
    )

    await update.message.reply_text(welcome, parse_mode="Markdown")


# ─────────────────────────────────────────────────────────────────────────────
# /reset — Fresh start
# ─────────────────────────────────────────────────────────────────────────────
async def handle_reset(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    telegram_id = str(user.id)
    reset_user_history(telegram_id)
    await update.message.reply_text(
        "✅ Theek hai! Hamari purani baat delete ho gayi. Fresh start karte hain! 🌱\n"
        "Batao, aaj kya help chahiye?"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Text messages
# ─────────────────────────────────────────────────────────────────────────────
async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    text = update.message.text

    await context.bot.send_chat_action(
        chat_id=update.effective_chat.id, action="typing"
    )

    response = generate_response(
        telegram_id=str(user.id),
        user_text=text,
        first_name=user.first_name,
        msg_type="text",
    )

    await update.message.reply_text(response)


# ─────────────────────────────────────────────────────────────────────────────
# Photo messages — crop disease diagnosis
# ─────────────────────────────────────────────────────────────────────────────
async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    caption = update.message.caption or ""

    await context.bot.send_chat_action(
        chat_id=update.effective_chat.id, action="typing"
    )

    try:
        # Get highest resolution photo
        photo = update.message.photo[-1]
        file = await photo.get_file()

        # Download to temp file
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            await file.download_to_drive(tmp.name)
            with open(tmp.name, "rb") as f:
                image_bytes = f.read()

        # Build prompt
        if caption:
            prompt = f"[Farmer sent a photo of their crop/field. Caption: '{caption}']\nPlease analyze this image and give actionable advice."
        else:
            prompt = "[Farmer sent a photo. Please analyze this image — it's likely their crop, plant, soil, or farm — and give helpful observations and advice.]"

        response = generate_response(
            telegram_id=str(user.id),
            user_text=prompt,
            first_name=user.first_name,
            msg_type="photo",
            image_bytes=image_bytes,
            image_mime="image/jpeg",
        )

    except Exception as e:
        logger.error(f"Photo handling error: {e}")
        response = (
            "Photo mila! 📸 Par mujhe isse process karne mein thodi dikkat aayi. "
            "Kya aap describe kar sakte ho kya problem dikh rahi hai patte/fasal mein?"
        )

    await update.message.reply_text(response)


# ─────────────────────────────────────────────────────────────────────────────
# Voice messages — transcribe then respond
# ─────────────────────────────────────────────────────────────────────────────
async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user

    await context.bot.send_chat_action(
        chat_id=update.effective_chat.id, action="typing"
    )

    try:
        voice = update.message.voice
        file = await voice.get_file()

        # Download voice file
        with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as tmp:
            await file.download_to_drive(tmp.name)
            voice_path = tmp.name

        # Transcribe using Gemini's native audio understanding
        with open(voice_path, "rb") as f:
            audio_bytes = f.read()

        from google import genai as genai_lib
        from google.genai import types as gtypes
        import os

        client = genai_lib.Client(api_key=os.getenv("GEMINI_API_KEY"))

        # Ask Gemini to transcribe
        transcription_response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                gtypes.Content(
                    role="user",
                    parts=[
                        gtypes.Part.from_bytes(data=audio_bytes, mime_type="audio/ogg"),
                        gtypes.Part.from_text(
                            text="Please transcribe exactly what is said in this voice message. "
                                 "Return only the transcription text, nothing else."
                        ),
                    ],
                )
            ],
        )
        transcribed_text = transcription_response.text.strip()
        logger.info(f"Voice transcription for {user.id}: {transcribed_text}")

        # Now generate the actual farming response
        response = generate_response(
            telegram_id=str(user.id),
            user_text=transcribed_text,
            first_name=user.first_name,
            msg_type="voice",
        )

        # Show transcription + response
        await update.message.reply_text(
            f'🎤 *Maine suna:* _"{transcribed_text}"_\n\n{response}',
            parse_mode="Markdown",
        )

    except Exception as e:
        logger.error(f"Voice handling error: {e}")
        await update.message.reply_text(
            "Voice message mila! 🎤 Par main abhi voice samajh nahi paya. "
            "Text mein likhoge toh better hoga — ya thodi der baad try karo. 😊"
        )
