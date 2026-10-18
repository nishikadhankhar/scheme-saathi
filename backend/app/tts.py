"""Text to speech in Indian languages via gTTS, cached as MP3 on disk.

The frontend can also fall back to the browser's own speechSynthesis.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

CACHE = Path(__file__).resolve().parents[1] / "cache" / "tts"
CACHE.mkdir(parents=True, exist_ok=True)

SUPPORTED = {"en", "hi", "kn", "ta", "te", "ml", "mr", "bn", "gu", "pa", "or"}


def _odia_to_phonetic(text: str) -> str:
    """Odia is not natively in gTTS. Map Odia Brahmic Unicode to Devanagari phonetics."""
    res = []
    for c in text:
        code = ord(c)
        if 0x0B00 <= code <= 0x0B7F:
            if code == 0x0B5C:
                res.append("ड़")
            elif code == 0x0B5D:
                res.append("ढ़")
            elif code == 0x0B5F:
                res.append("य")
            elif code == 0x0B71:
                res.append("व")
            else:
                res.append(chr(code - 0x0B00 + 0x0900))
        else:
            res.append(c)
    return "".join(res)


def speak(text: str, lang: str = "en") -> Path:
    lang = lang if lang in SUPPORTED else "en"
    key = hashlib.sha256(f"{lang}|{text}".encode()).hexdigest()[:24]
    path = CACHE / f"{key}.mp3"
    if not path.exists():
        from gtts import gTTS
        tmp = path.with_suffix(".part")
        if lang == "or":
            tts_text = _odia_to_phonetic(text)
            gTTS(text=tts_text, lang="hi", tld="co.in").save(str(tmp))
        else:
            gTTS(text=text, lang=lang, tld="co.in" if lang == "en" else "com").save(str(tmp))
        tmp.rename(path)
    return path
