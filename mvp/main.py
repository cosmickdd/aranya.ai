import os
import sys
import logging
from dotenv import load_dotenv

# Load env first before anything else
load_dotenv()

from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters
from db.database import init_db
from bot.handlers import start_command, handle_text, handle_photo, handle_voice, handle_reset

# Configure logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
    handlers=[logging.StreamHandler(sys.stdout)]
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)


def main():
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    gemini_key = os.getenv("GEMINI_API_KEY")

    if not token or token == "your_telegram_bot_token_here":
        print("\n❌ ERROR: TELEGRAM_BOT_TOKEN not set in .env file!")
        print("   1. Open mvp/.env")
        print("   2. Set TELEGRAM_BOT_TOKEN=your_token_from_botfather\n")
        sys.exit(1)

    if not gemini_key or gemini_key == "your_gemini_api_key_here":
        print("\n❌ ERROR: GEMINI_API_KEY not set in .env file!")
        print("   1. Get your key at https://aistudio.google.com/app/apikey")
        print("   2. Open mvp/.env")
        print("   3. Set GEMINI_API_KEY=your_key\n")
        sys.exit(1)

    # Initialize database
    logger.info("🌱 Initializing Aranya.ai database...")
    init_db()

    # Build the bot application
    logger.info("🤖 Starting Aranya.ai Telegram bot...")
    app = Application.builder().token(token).build()

    # Register handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("reset", handle_reset))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))

    print("\n" + "="*55)
    print("  ✅  Aranya.ai is LIVE on Telegram!")
    print("  Open Telegram, find your bot, and say Namaste! 🙏")
    print("  Press Ctrl+C to stop.")
    print("="*55 + "\n")

    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
