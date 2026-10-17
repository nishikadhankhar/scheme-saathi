"""Text to speech in Indian languages via gTTS, cached as MP3 on disk.

The frontend can also fall back to the browser's own speechSynthesis.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

CACHE = Path(__file__).resolve().parents[1] / "cache" / "tts"
CACHE.mkdir(parents=True, exist_ok=True)

SUPPORTED = {"en", "hi", "kn", "ta", "te", "ml", "mr", "bn", "gu", "pa"}   # Odia not in gTTS


def speak(text: str, lang: str = "en") -> Path:
    lang = lang if lang in SUPPORTED else "en"
    key = hashlib.sha256(f"{lang}|{text}".encode()).hexdigest()[:24]
    path = CACHE / f"{key}.mp3"
    if not path.exists():
        from gtts import gTTS
        tmp = path.with_suffix(".part")
        gTTS(text=text, lang=lang, tld="co.in" if lang == "en" else "com").save(str(tmp))
        tmp.rename(path)
    return path
