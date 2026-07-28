const SARVAM_BASE = "https://api.sarvam.ai";

// Map short locale codes to Sarvam language codes
const LANG_MAP: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  ta: "ta-IN",
  te: "te-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  pa: "pa-IN",
  ml: "ml-IN",
  od: "od-IN",
  ks: "hi-IN", // Kashmiri fallback to Hindi
};

const SPEAKER_MAP: Record<string, string> = {
  "hi-IN": "meera",
  "en-IN": "meera",
  "ta-IN": "meera",
  "te-IN": "meera",
  "mr-IN": "meera",
  "bn-IN": "meera",
  "gu-IN": "meera",
  "kn-IN": "meera",
  "pa-IN": "meera",
  "ml-IN": "meera",
  "od-IN": "meera",
};

/**
 * Calls Sarvam API directly from the mobile client to generate speech.
 * Returns base64 encoded audio string, or empty string on failure.
 */
export async function fetchSarvamTTS(text: string, language: string = "hi"): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_SARVAM_API_KEY;
  if (!apiKey) {
    console.warn("EXPO_PUBLIC_SARVAM_API_KEY not set in .env, skipping Sarvam TTS");
    return "";
  }

  const langCode = LANG_MAP[language] || "hi-IN";
  const speaker = SPEAKER_MAP[langCode] || "meera";
  
  // Sarvam limit is 2500 chars
  const chunk = text.substring(0, 2500);

  try {
    const response = await fetch(`${SARVAM_BASE}/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey
      },
      body: JSON.stringify({
        inputs: [chunk],
        target_language_code: langCode,
        speaker: speaker,
        pitch: 0,
        pace: 1.0,
        loudness: 1.5,
        speech_sample_rate: 22050,
        enable_preprocessing: true,
        model: "bulbul:v2"
      })
    });

    if (!response.ok) {
      console.error(`Sarvam API Error: ${response.status} ${response.statusText}`);
      return "";
    }

    const data = await response.json();
    if (data.audios && data.audios.length > 0) {
      return data.audios[0];
    }
    return "";
  } catch (error) {
    console.error("Sarvam TTS Fetch Error:", error);
    return "";
  }
}