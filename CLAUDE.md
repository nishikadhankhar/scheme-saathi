# Scheme Saathi

Voice-first assistant (hackathon: Devlympics, "Bridge the Gap") that finds Indian government
schemes for people with little schooling, in their own language. Backend only so far
(FastAPI, `backend/`); the frontend is not built yet. See README.md for the API contract.

## Commands

All commands run from `backend/`.

```bash
./run.sh                                   # API on :8000, docs at /docs
python3 -m pytest tests/ -q -m "not ai"    # fast: rules + live portal, no Gemini
python3 -m pytest tests/ -q                # everything, ~30 s, about 10 Gemini calls
python3 tools/try_chat.py [--voice]        # talk to Saathi in the terminal
```

Run `-m "not ai"` by default. The Gemini key is free tier (about 8–10 calls/min). Run the
`ai` tests only when conversation or flashcard code changed.

## Design rules (do not break)

- **No AI in eligibility.** Gemini only extracts facts and phrases text. Which schemes match
  is decided in `matcher.py` from the portal's official filters plus plain rules.
- **Code decides the flow.** `profile.missing_fields()` decides what to ask next, not the model.
- **Code decides the reply language** from the script the user types in
  (`conversation.reply_language`). Never trust the model's language guess; it once answered
  an English user in Hindi.
- **Flashcards are grounded.** Every number in a card must appear in the portal text
  (`briefs._check`); otherwise it falls back to a template.
- **No sensitive data.** Never ask for or store Aadhaar, bank details, phone numbers or
  documents. No login, no server database: the frontend keeps the profile on the phone and
  sends it with every request.
- Saathi speaks about itself in the **feminine** form in gendered languages (Hindi etc.).
- Flashcards say "you **may** be eligible", never "you are eligible".

## myscheme.gov.in quirks (learned the hard way)

- Data comes from the JSON endpoints the portal's own pages use (`/api/apisetu/...`).
  These are unofficial. Responses are cached on disk in `backend/cache/` (gitignored).
- Filters: values of the **same** identifier are ORed, **different** identifiers ANDed.
  Always add `"All"` next to the person's state/gender/caste (`"Both"` for residence).
- Age filter format is `{"identifier": "age-general", "min": 45, "max": 45}`. A plain
  `"value"` is silently ignored.
- The portal's result order is **not** relevance, and its keyword search is fuzzy (OR of
  words). Every keyword hit must pass `must_match`; don't add rank-based scoring back.
- Its eligibility tags are incomplete (old-age pensions show for 45-year-olds, college
  scholarships for 12-year-olds), hence the rules in `matcher._not_for`.
- Group-word rules check **name + tags only** (`_label`), not the summary. A summary can say
  the opposite: PM-SYM's says "not a member of EPFO".
- When the portal's own occupation filter found a scheme, trust it only if the scheme is broad
  (several job groups or generic "Worker/Labour" tags). PM-SYM must stay; PM SVANidhi
  (street vendors only) must not show for a driver.

## Code map

```
backend/app/
  main.py          routes
  conversation.py  collect → confirm → confirmed; prompts; language + digit handling
  profile.py       Profile model (enum labels copied exactly from portal filters); profile → filters
  matcher.py       searches, safety-net searches, "not for you" rules, scoring, per-member cap
  scraper.py       portal client + disk cache (per-event-loop httpx client)
  briefs.py        flashcards + number check
  llm.py           Gemini: (model, thinking level) list with fallback + one retry
  tts.py           gTTS, cached MP3s
```

## Working on matching

When you change `matcher.py`, check all three sample families in `tests/test_live.py`
(Karnataka farmer family, UP widow tailor with a school-age son, Chennai auto driver).
A fix for one often breaks another. Each bug found gets a regression test in
`tests/test_rules.py` (offline) or `tests/test_live.py`.

## Secrets

The Gemini key lives in `backend/.env` (gitignored). The repo is **public**: never commit
keys, and scan staged files before pushing.

## Commits

End commit messages with:
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
