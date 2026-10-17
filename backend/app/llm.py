"""Thin wrapper around Gemini for structured (JSON) output.

The model only does language work: understanding what the user said and
phrasing replies. It never decides which schemes someone qualifies for.
"""
from __future__ import annotations

import os
import time
from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel

try:                                    # the key lives in a git-ignored backend/.env
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)
except ImportError:
    pass

# (model, thinking level), tried in order: the next one is used if a model is
# rate-limited or unavailable. Minimal thinking keeps replies around 1-2 s.
MODELS = [("gemini-3.5-flash", "minimal"), ("gemini-3.8-flash", "low"),
          ("gemini-flash-lite-latest", "minimal")]
RETRY_WAIT_S = 4                        # all models busy (free-tier rate limit): wait, retry once

T = TypeVar("T", bound=BaseModel)

_client = None


def available() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY"))


def _get_client():
    global _client
    if _client is None:
        from google import genai
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


def _attempts():
    for round_ in range(2):
        if round_:
            time.sleep(RETRY_WAIT_S)
        yield from MODELS


def generate(system: str, prompt: str, schema: type[T], temperature: float = 0.3) -> T:
    """Call Gemini and parse the reply into `schema`. Raises if every model fails."""
    from google.genai import types
    errors = []
    for model, thinking in _attempts():
        cfg = types.GenerateContentConfig(
            system_instruction=system, temperature=temperature,
            response_mime_type="application/json", response_schema=schema,
            thinking_config=types.ThinkingConfig(thinking_level=thinking))
        try:
            t0 = time.time()
            r = _get_client().models.generate_content(model=model, contents=prompt, config=cfg)
            out = r.parsed if isinstance(r.parsed, schema) else schema.model_validate_json(r.text)
            LAST.update(model=model, latency_ms=int((time.time() - t0) * 1000), error=None)
            return out
        except Exception as e:          # noqa: BLE001 - try the next model
            errors.append(f"{model}: {type(e).__name__}: {str(e)[:160]}")
    LAST.update(model=None, latency_ms=None, error=" | ".join(errors))
    raise RuntimeError(" | ".join(errors))


def transcribe(audio: bytes, mime_type: str) -> str:
    """Speech to text for any Indian language, returned in the speaker's own script."""
    from google.genai import types
    prompt = ("Transcribe this audio exactly as spoken, in the speaker's own language and script "
              "(for example Kannada in Kannada script, Hindi in Devanagari). Do not translate. "
              "Return only the transcript.")
    errors = []
    for model, thinking in _attempts():
        try:
            r = _get_client().models.generate_content(
                model=model,
                contents=[types.Part.from_bytes(data=audio, mime_type=mime_type), prompt],
                config=types.GenerateContentConfig(
                    thinking_config=types.ThinkingConfig(thinking_level=thinking)))
            return (r.text or "").strip()
        except Exception as e:          # noqa: BLE001
            errors.append(f"{model}: {type(e).__name__}: {str(e)[:160]}")
    raise RuntimeError(" | ".join(errors))


LAST: dict = {"model": None, "latency_ms": None, "error": None}
