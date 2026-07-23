"""
sarvam.py — Sarvam AI integration for Indic translation and Text-to-Speech.
https://docs.sarvam.ai/
"""
import os
import logging
import requests

logger = logging.getLogger(__name__)

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_BASE = "https://api.sarvam.ai"

# Map short locale codes to Sarvam language codes
LANG_MAP = {
    "en": "en-IN",
    "hi": "hi-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "mr": "mr-IN",
    "bn": "bn-IN",
    "gu": "gu-IN",
    "kn": "kn-IN",
    "pa": "pa-IN",
    "ml": "ml-IN",
    "od": "od-IN",
    "ks": "hi-IN",  # Kashmiri fallback to Hindi
}

# Sarvam TTS speaker voices per language
SPEAKER_MAP = {
    "hi-IN": "ritu",
    "en-IN": "ritu",
    "ta-IN": "ritu",
    "te-IN": "ritu",
    "mr-IN": "ritu",
    "bn-IN": "ritu",
    "gu-IN": "ritu",
    "kn-IN": "ritu",
    "pa-IN": "ritu",
    "ml-IN": "ritu",
    "od-IN": "ritu",
}


def _headers(api_key=None):
    key = api_key or os.getenv("SARVAM_API_KEY", "")
    return {
        "api-subscription-key": key,
        "Content-Type": "application/json",
    }


def translate_text(text: str, source_lang: str = "auto", target_lang: str = "hi", api_key: str = None) -> str:
    """
    Translate text using Sarvam Translate API.
    source_lang/target_lang: short code like 'en', 'hi', 'mr', etc.
    Returns translated text or original text on failure.
    """
    key = api_key or os.getenv("SARVAM_API_KEY", "")
    if not key:
        logger.warning("SARVAM_API_KEY not set, skipping translation")
        return text

    target_code = LANG_MAP.get(target_lang, "hi-IN")
    source_code = "auto" if source_lang == "auto" else LANG_MAP.get(source_lang, "en-IN")

    # Don't translate if source == target
    if source_code == target_code and source_code != "auto":
        return text

    try:
        resp = requests.post(
            f"{SARVAM_BASE}/translate",
            headers=_headers(api_key=key),
            json={
                "input": text[:2000],  # Sarvam limit
                "source_language_code": source_code,
                "target_language_code": target_code,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        translated = data.get("translated_text", text)
        logger.info(f"Sarvam translate: {source_code} → {target_code} OK")
        return translated
    except Exception as e:
        logger.error(f"Sarvam translate error: {e}")
        return text


def text_to_speech(text: str, language: str = "hi", api_key: str = None) -> str:
    """
    Convert text to speech using Sarvam TTS API (bulbul:v3).
    Returns base64-encoded WAV audio string, or empty string on failure.
    """
    key = api_key or os.getenv("SARVAM_API_KEY", "")
    if not key:
        logger.warning("SARVAM_API_KEY not set, skipping TTS")
        return ""

    lang_code = LANG_MAP.get(language, "hi-IN")
    speaker = SPEAKER_MAP.get(lang_code, "meera")

    try:
        # Chunk text to 2500 chars (Sarvam limit)
        chunk = text[:2500]
        resp = requests.post(
            f"{SARVAM_BASE}/text-to-speech",
            headers=_headers(api_key=key),
            json={
                "inputs": [chunk],
                "target_language_code": lang_code,
                "model": "bulbul:v3",
                "speaker": speaker,
                "pace": 1.0,
                "enable_preprocessing": True,
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        # The API returns {"audios": ["base64..."]}
        audios = data.get("audios", [])
        if audios:
            logger.info(f"Sarvam TTS OK: {lang_code}, {len(audios[0])} chars audio")
            return audios[0]
        return ""
    except Exception as e:
        logger.error(f"Sarvam TTS error: {e}")
        return ""


def speech_to_text(audio_bytes: bytes, language: str = "hi", mime_type: str = "audio/webm", api_key: str = None) -> str:
    """
    Transcribe audio using Sarvam STT API (saaras:v2).
    audio_bytes : raw bytes of the audio file
    language    : short language code
    mime_type   : MIME type of the audio
    Returns transcribed text or empty string on failure.
    """
    key = api_key or os.getenv("SARVAM_API_KEY", "")
    if not key:
        logger.warning("SARVAM_API_KEY not set, skipping STT")
        return ""

    lang_code = LANG_MAP.get(language, "hi-IN")

    try:
        import io
        import subprocess

        # If input is webm, convert it to wav using ffmpeg (which is pre-installed)
        if "webm" in mime_type or mime_type == "audio/webm":
            logger.info("Converting webm audio to wav format using ffmpeg file-transcoding...")
            import tempfile
            temp_in_name = None
            temp_out_name = None
            try:
                # Write to temp file to make it seekable for ffmpeg
                with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_in:
                    temp_in.write(audio_bytes)
                    temp_in_name = temp_in.name
                
                temp_out_name = temp_in_name + ".wav"
                
                # Run ffmpeg reading from file and writing to file (single-threaded for memory safety)
                cmd = ["ffmpeg", "-y", "-i", temp_in_name, "-f", "wav", "-ar", "16000", "-ac", "1", "-vn", temp_out_name]
                process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                
                if process.returncode == 0 and os.path.exists(temp_out_name):
                    with open(temp_out_name, "rb") as f:
                        audio_bytes = f.read()
                    mime_type = "audio/wav"
                    logger.info(f"Transcoding successful: converted to WAV ({len(audio_bytes)} bytes)")
                else:
                    err_msg = process.stderr.decode('utf-8', errors='ignore')
                    logger.error(f"ffmpeg conversion failed: {err_msg}")
            except Exception as ffmpeg_err:
                logger.error(f"Failed to transcode webm using ffmpeg: {ffmpeg_err}")
            finally:
                # Clean up temporary files
                if temp_in_name and os.path.exists(temp_in_name):
                    try:
                        os.remove(temp_in_name)
                    except Exception:
                        pass
                if temp_out_name and os.path.exists(temp_out_name):
                    try:
                        os.remove(temp_out_name)
                    except Exception:
                        pass

        if "webm" in mime_type:
            ext = "webm"
        elif "m4a" in mime_type or "mp4" in mime_type:
            ext = "m4a"
        elif "caf" in mime_type:
            ext = "caf"
        else:
            ext = "wav"
            
        files = {
            "file": (f"audio.{ext}", io.BytesIO(audio_bytes), mime_type),
        }
        data = {
            "language_code": lang_code,
            "model": "saarika:v2.5",
            "with_timestamps": "false",
        }
        headers = {
            "api-subscription-key": key,
        }
        resp = requests.post(
            f"{SARVAM_BASE}/speech-to-text",
            headers=headers,
            files=files,
            data=data,
            timeout=30,
        )
        if resp.status_code != 200:
            logger.error(f"Sarvam STT error body: {resp.text}")
        resp.raise_for_status()
        result = resp.json()
        transcript = result.get("transcript", "")
        
        # If saarika:v2.5 returned empty transcript, try saaras:v3 fallback
        if not transcript or not transcript.strip():
            logger.info("saarika:v2.5 returned empty transcript, attempting saaras:v3 fallback...")
            files_fallback = {
                "file": (f"audio.{ext}", io.BytesIO(audio_bytes), mime_type),
            }
            data_fallback = {
                "model": "saaras:v3",
                "with_timestamps": "false",
            }
            resp_fallback = requests.post(
                f"{SARVAM_BASE}/speech-to-text",
                headers=headers,
                files=files_fallback,
                data=data_fallback,
                timeout=30,
            )
            if resp_fallback.status_code == 200:
                res_fb = resp_fallback.json()
                transcript = res_fb.get("transcript", "")
                logger.info(f"saaras:v3 fallback transcript: {transcript[:80]}")

        logger.info(f"Sarvam STT OK: {lang_code}, transcript: {transcript[:80]}...")
        return transcript
    except Exception as e:
        if 'resp' in locals() and hasattr(resp, 'text'):
            logger.error(f"Sarvam STT exception response: {resp.text}")
        logger.error(f"Sarvam STT error: {e}")
        return ""
