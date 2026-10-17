"""Steps 1-3 of the flow: listen, ask follow-up questions, then read back a summary.

Stages:
  collecting  -> we still need facts; each user message updates the profile and
                 we ask about the next missing one.
  confirming  -> everything needed is known; we read a summary back and wait
                 for "yes" or a correction.
  confirmed   -> the user said yes; the frontend can now fetch schemes.

The model extracts facts and phrases questions. Plain code decides which fact
is still missing, so the conversation always ends.
"""
from __future__ import annotations

import json
from typing import Literal, Optional

from pydantic import BaseModel, Field

from . import llm
from .profile import (FIELD_HINTS, LANGUAGE_NAMES, Language, Profile, missing_fields)

Stage = Literal["collecting", "confirming", "confirmed"]


class Message(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class ChatRequest(BaseModel):
    message: str
    stage: Stage = "collecting"
    profile: Profile = Field(default_factory=Profile)
    asked: list[str] = Field(default_factory=list, description="Fields we already asked about")
    history: list[Message] = Field(default_factory=list)
    language: Optional[Language] = None


class Fact(BaseModel):
    label: str
    value: str


class ChatResponse(BaseModel):
    stage: Stage
    reply: str                      # what to show and speak, in the user's language
    language: Language
    profile: Profile
    asked: list[str]
    missing: list[str]
    asking_about: Optional[str] = None
    facts: list[Fact] = Field(default_factory=list)   # filled on the summary step, for display
    backend: str = "gemini"


# --------------------------------------------------------------------------- #
#  Prompts
# --------------------------------------------------------------------------- #
PERSONA = """You are Saathi, a warm, patient helper who finds Indian government welfare
schemes for people who may have little schooling and may not read well.
Speak like a kind neighbour, not like a government form. Short, simple sentences.
Always reply in the user's language and script (Kannada in Kannada script, Hindi in
Devanagari, and so on). Use Western digits for numbers.
In languages where verbs change with the speaker's gender (Hindi, Marathi, Gujarati,
Punjabi ...), always speak about yourself in the feminine form, every time
(Hindi: "मैं ढूंढती हूँ", "मैं समझ गई"). Address the user with the respectful form
("आप"), matching their gender if you know it.
Never ask for Aadhaar, bank account, phone numbers, or any document. If the user
offers them, gently say you do not need them."""

EXTRACT_SYSTEM = PERSONA + """

YOUR JOB THIS TURN
1. Update the profile with every fact in the user's latest message. Keep all facts
   already in the profile unless the user corrects them. Copy existing values over.
   - Convert amounts to rupees per year for annual_income ("10,000 a month" -> 120000;
     "2 lakh" -> 200000).
   - Convert land to acres (1 hectare = 2.47 acres; 1 acre = 40 guntas in Karnataka).
   - Village -> residence "Rural"; town or city -> "Urban".
   - If they say they are a student, set is_student true; if they clearly work, set it false.
   - Put each family member they mention in family_members (relation in English).
   - Add short English keywords for anything they want help with. If it is for one
     family member, put it in THAT member's `needs` ("my daughter's college fees" ->
     daughter.needs = ["college scholarship"]); otherwise in the top-level `needs`
     ("we have no health insurance" -> needs = ["health insurance"]).
   - occupation: "Unorganized Worker" for daily-wage or informal jobs (tailor, driver,
     domestic worker, labourer, shop helper, mechanic); "Artisans, Spinners & Weavers" only
     for traditional crafts (weaving, pottery, carpentry, metal or wood craft).
     Always also put their own job in English in occupation_detail ("tailor").
   - If they decline to share caste, set caste to "Prefer not to say".
   - Only use the allowed labels for enum fields. Leave a field null if unsure.
2. Write in REPLY_LANGUAGE. Return its code in `language`.
3. Write `reply`: briefly acknowledge what they just told you, in a few words that
   refer to it (never repeat the same acknowledgement you used earlier), then ask
   ONE simple question about the first field in STILL_MISSING that their latest
   message did not answer. Set `asking_about` to that field's name.
   If you ask about family, mention why ("some schemes are for children or parents").
   If STILL_MISSING would be empty after your update, set asking_about to null and
   just thank them."""

QUESTION_SYSTEM = PERSONA + """

Write ONE short, friendly question in the given language asking about the topic given.
Do not greet. Do not repeat what they already told you."""

SUMMARY_SYSTEM = PERSONA + """

Read back what you understood about the person as a short spoken summary
(at most 70 words), in their language. Mention only the FACTS given.
Use the numbers exactly as given. Do not mention any scheme yet.
End by asking if everything is correct, and that they can correct anything."""

CONFIRM_SYSTEM = PERSONA + """

You just read the person a summary of their details and asked if it is correct.
Decide from their reply:
- confirmed = true if they agree (yes, haan, houdu, correct, sari, ok, ...) and give no correction.
- confirmed = false if they correct or add anything. Then apply the corrections to the
  profile (keep everything else exactly as it was).
Write a one-line `reply` in REPLY_LANGUAGE: if confirmed, say you will now look for
schemes for them; if corrected, say you have updated it."""


class ExtractOut(BaseModel):
    profile: Profile
    language: Language
    reply: str
    asking_about: Optional[str] = None


class QuestionOut(BaseModel):
    question: str


class SummaryOut(BaseModel):
    summary: str


class ConfirmOut(BaseModel):
    confirmed: bool
    profile: Profile
    language: Language
    reply: str


# --------------------------------------------------------------------------- #
#  Helpers
# --------------------------------------------------------------------------- #
def _merge(old: Profile, new: Profile) -> Profile:
    """Never let the model silently drop a fact we already had."""
    merged = new.model_dump()
    for k, v in old.model_dump().items():
        if merged.get(k) in (None, "", []) and v not in (None, "", []):
            merged[k] = v
    if new.needs or old.needs:
        merged["needs"] = list(dict.fromkeys([*old.needs, *new.needs]))
    return Profile.model_validate(merged)


# Unicode blocks of Indian scripts -> language. Devanagari is Hindi unless the model
# recognises Marathi.
_SCRIPTS = [(0x0900, 0x097F, "hi"), (0x0980, 0x09FF, "bn"), (0x0A00, 0x0A7F, "pa"),
            (0x0A80, 0x0AFF, "gu"), (0x0B00, 0x0B7F, "or"), (0x0B80, 0x0BFF, "ta"),
            (0x0C00, 0x0C7F, "te"), (0x0C80, 0x0CFF, "kn"), (0x0D00, 0x0D7F, "ml")]
_INDIC_DIGITS = {start + 0x66 + i: str(i) for start, _, _ in _SCRIPTS for i in range(10)}


def script_language(text: str) -> str | None:
    """Language from the script the user typed in: 'kn', 'hi', ..., 'en' for Latin, None if unclear."""
    counts: dict[str, int] = {}
    for ch in text:
        o = ord(ch)
        if ch.isascii() and ch.isalpha():
            counts["en"] = counts.get("en", 0) + 1
            continue
        for lo, hi, lang in _SCRIPTS:
            if lo <= o <= hi:
                counts[lang] = counts.get(lang, 0) + 1
                break
    return max(counts, key=counts.get) if counts else None


def reply_language(message: str, previous: str | None) -> str:
    """Decided by code, not the model. Short Latin replies ("OBC", "yes") keep the language
    the conversation is already in."""
    lang = script_language(message)
    if lang == "en" and previous and len(message.split()) <= 3:
        return previous
    return lang or previous or "en"


def western_digits(text: str) -> str:
    return text.translate(_INDIC_DIGITS)


def _lang_line(lang: str) -> str:
    name = LANGUAGE_NAMES.get(lang, "English")
    if lang == "hi":
        name = "Hindi (or Marathi, if the user is writing Marathi)"
    return f"{name} — write `reply` in this language and its own script"


def _history_text(history: list[Message], limit: int = 10) -> str:
    return "\n".join(f"{m.role.upper()}: {m.text}" for m in history[-limit:])


def _inr(n: int) -> str:
    s = str(n)
    if len(s) <= 3:
        return "₹" + s
    head, tail = s[:-3], s[-3:]
    parts = []
    while len(head) > 2:
        parts.insert(0, head[-2:])
        head = head[:-2]
    if head:
        parts.insert(0, head)
    return "₹" + ",".join(parts) + "," + tail


def facts(p: Profile) -> list[Fact]:
    """The profile as label/value pairs for the summary card (English labels)."""
    out: list[Fact] = []
    add = lambda label, v: out.append(Fact(label=label, value=str(v))) if v not in (None, "", []) else None  # noqa: E731
    add("Name", p.name)
    add("Age", p.age)
    add("Gender", p.gender)
    add("State", p.state)
    add("District", p.district)
    add("Lives in", {"Rural": "Village (rural)", "Urban": "Town / city (urban)"}.get(p.residence or ""))
    add("Work", p.occupation_detail or p.occupation)
    if p.annual_income is not None:
        add("Family income", f"{_inr(p.annual_income)} per year")
    add("Land", f"{p.land_acres:g} acres" if p.land_acres is not None else None)
    add("Caste category", p.caste)
    add("BPL card", {True: "Yes", False: "No"}.get(p.is_bpl))
    add("Student", "Yes" if p.is_student else None)
    add("Disability", f"Yes ({p.disability_percent}%)" if p.has_disability and p.disability_percent
        else ("Yes" if p.has_disability else None))
    for m in p.family_members:
        bits = [b for b in (f"{m.age} yrs" if m.age is not None else None,
                            "studying" + (f" ({m.education})" if m.education else "") if m.is_student else None,
                            m.occupation, "disability" if m.has_disability else None) if b]
        add(m.relation.capitalize(), ", ".join(bits) or "—")
    if p.needs:
        add("Looking for", ", ".join(p.needs))
    return out


def _template_summary(p: Profile) -> str:
    lines = "; ".join(f"{f.label}: {f.value}" for f in facts(p))
    return f"Here is what I understood. {lines}. Is this correct? You can correct anything."


def _summary(p: Profile, lang: str) -> tuple[str, str]:
    shown = [f"{f.label}: {f.value}" for f in facts(p)]   # already formatted: ₹80,000, 2 acres
    prompt = (f"LANGUAGE: {LANGUAGE_NAMES.get(lang, 'English')} ({lang})\n"
              "FACTS (copy numbers and ₹ amounts exactly as written):\n" + "\n".join(shown))
    try:
        return llm.generate(SUMMARY_SYSTEM, prompt, SummaryOut).summary, "gemini"
    except Exception:                   # noqa: BLE001 - demo must not die
        return _template_summary(p), "template"


# --------------------------------------------------------------------------- #
#  Main entry point
# --------------------------------------------------------------------------- #
def chat(req: ChatRequest) -> ChatResponse:
    if req.stage == "confirming":
        return _confirm(req)
    return _collect(req)


def _to_confirming(p: Profile, asked: list[str], lang: str, backend: str,
                   prefix: str = "") -> ChatResponse:
    text, b = _summary(p, lang)
    return ChatResponse(stage="confirming", reply=western_digits((prefix + " " + text).strip()),
                        language=lang,
                        profile=p, asked=asked, missing=[], facts=facts(p),
                        backend=backend if b == "gemini" else b)


def _collect(req: ChatRequest) -> ChatResponse:
    before_missing = missing_fields(req.profile, req.asked)
    lang = reply_language(req.message, req.language)
    if not llm.available():
        raise RuntimeError("GEMINI_API_KEY is not set (backend/.env)")

    prompt = json.dumps({
        "CURRENT_PROFILE": req.profile.model_dump(exclude_none=True),
        "STILL_MISSING": [{"field": f, "meaning": FIELD_HINTS[f]} for f in before_missing],
        "CONVERSATION_SO_FAR": _history_text(req.history),
        "USER_LATEST_MESSAGE": req.message,
        "REPLY_LANGUAGE": _lang_line(lang),
    }, ensure_ascii=False, indent=1)
    out = llm.generate(EXTRACT_SYSTEM, prompt, ExtractOut, temperature=0.2)

    profile = _merge(req.profile, out.profile)
    if lang == "hi" and out.language == "mr":
        lang = "mr"
    if script_language(out.reply) not in (lang, None) and not (lang == "mr" and
                                                               script_language(out.reply) == "hi"):
        out.asking_about = None             # replied in the wrong language: re-ask below
    asked = list(req.asked)
    missing = missing_fields(profile, asked)

    # The user may skip an optional question: once asked, we do not ask again.
    if not missing:
        return _to_confirming(profile, asked, lang, "gemini", prefix=_ack(out.reply))

    reply, about = out.reply, out.asking_about
    if about not in missing:            # model asked about the wrong thing: re-ask precisely
        about = missing[0]
        try:
            q = llm.generate(QUESTION_SYSTEM,
                             f"LANGUAGE: {_lang_line(lang)}\nTOPIC: {FIELD_HINTS[about]}",
                             QuestionOut).question
        except Exception:               # noqa: BLE001
            q = f"Could you tell me {FIELD_HINTS[about]}?"
        reply = q
    if about not in asked:
        asked.append(about)
    return ChatResponse(stage="collecting", reply=western_digits(reply), language=lang,
                        profile=profile, asked=asked, missing=missing, asking_about=about)


def _ack(reply: str) -> str:
    """Use the model's thank-you before the summary, unless it slipped in a question."""
    return "" if "?" in reply else reply.strip()


def _confirm(req: ChatRequest) -> ChatResponse:
    lang = reply_language(req.message, req.language)
    prompt = json.dumps({
        "PROFILE_YOU_READ_BACK": req.profile.model_dump(exclude_none=True),
        "USER_REPLY": req.message,
        "REPLY_LANGUAGE": _lang_line(lang),
    }, ensure_ascii=False, indent=1)
    out = llm.generate(CONFIRM_SYSTEM, prompt, ConfirmOut, temperature=0.1)
    if out.confirmed:
        return ChatResponse(stage="confirmed", reply=western_digits(out.reply), language=lang,
                            profile=req.profile,
                            asked=req.asked, missing=[], facts=facts(req.profile))

    profile = _merge(req.profile, out.profile)      # corrected values win, the rest is kept
    missing = missing_fields(profile, req.asked)
    if missing:                         # a correction removed something we need
        return _collect(ChatRequest(message=req.message, stage="collecting", profile=profile,
                                    asked=req.asked, history=req.history, language=lang))
    return _to_confirming(profile, req.asked, lang, "gemini", prefix=out.reply)
