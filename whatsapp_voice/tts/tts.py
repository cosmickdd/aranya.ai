"""
tts.py — Text-to-Speech using gTTS (Google TTS).
Converts Aranya's text response into an MP3 file that Twilio plays during calls.
"""
import os
import hashlib
import logging
from gtts import gTTS
from config import AUDIO_DIR

logger = logging.getLogger(__name__)


def text_to_audio(text: str, lang: str = "hi") -> str:
    """
    Convert text to speech and save as an MP3 file.
    Returns the filename (not the full path) so it can be served via Flask.
    Uses a hash of the text as the filename to avoid regenerating duplicates.
    """
    # Detect language: if mostly ASCII, use English
    ascii_ratio = sum(1 for c in text if ord(c) < 128) / max(len(text), 1)
    if ascii_ratio > 0.85:
        lang = "en"
    else:
        lang = "hi"

    text_hash = hashlib.md5(text.encode()).hexdigest()
    filename = f"{text_hash}.mp3"
    filepath = os.path.join(AUDIO_DIR, filename)

    if not os.path.exists(filepath):
        try:
            tts = gTTS(text=text, lang=lang, slow=False)
            tts.save(filepath)
            logger.info(f"TTS generated: {filename} ({lang})")
        except Exception as e:
            logger.error(f"TTS error: {e}")
            return None

    return filename


def clean_for_speech(text: str) -> str:
    """
    Remove markdown and symbols that sound bad when read aloud.
    """
    import re
    text = re.sub(r"\*{1,2}(.*?)\*{1,2}", r"\1", text)   # bold/italic
    text = re.sub(r"_{1,2}(.*?)_{1,2}", r"\1", text)       # underscore
    text = re.sub(r"`{1,3}(.*?)`{1,3}", r"\1", text)       # code
    text = re.sub(r"#{1,6}\s*", "", text)                   # headers
    text = re.sub(r"•|◦|▸|→|–|—", ",", text)              # bullets
    text = re.sub(r"\n+", ". ", text)                       # newlines to pauses
    text = re.sub(r"\s+", " ", text).strip()
    return text
