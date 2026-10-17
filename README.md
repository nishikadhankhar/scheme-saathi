# Scheme Saathi — backend

Tell Saathi about your life in your own language; it asks a few follow-up questions,
reads back what it understood, and finds government schemes you may be eligible for,
shown as flashcards that it reads aloud.

**Languages:** the user just speaks; Saathi detects the language and replies in it.
Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia, English
(voice output for all except Odia). Tested end to end in **Hindi** and **Kannada**.

**Design rules:** no login · no Aadhaar, bank details or documents collected ·
the AI only does language work · eligibility comes from the official portal's filters.

## Run

```bash
cd backend
pip3 install -r requirements.txt
echo "GEMINI_API_KEY=..." > .env      # already set up on this machine
./run.sh                              # http://localhost:8000/docs
```

## Test it

```bash
cd backend
python3 -m pytest tests/ -v                 # all 66 tests, ~30 s (live portal + Gemini)
python3 -m pytest tests/ -v -m "not ai"     # skip Gemini to save free-tier quota
python3 tools/try_chat.py --voice           # talk to Saathi yourself, hear the replies
```

- `tests/test_rules.py`: the plain-code rules (filters, "not for you", number check, language). Offline, under 1 s.
- `tests/test_live.py`: real portal searches for 3 sample families (Karnataka farmer, UP widow tailor,
  Chennai auto driver), every API route, and Gemini (Hindi understanding, corrections, grounded flashcards).
- `tools/try_chat.py`: the whole flow in the terminal, in any language. Type `profile` at any point
  to see what Saathi has understood.
- Click-through test page: start the server and open http://localhost:8000/docs → "Try it out".

## The flow

| Step | Endpoint | What happens |
|---|---|---|
| 1. User speaks | `POST /api/transcribe` (form field `audio`) | Gemini turns speech into text in the speaker's own script |
| 2. Follow-up questions | `POST /api/chat` with `stage: "collecting"` | Gemini pulls facts into the profile; **code** decides what's still missing; Saathi asks one question |
| 3. Summary + confirmation | `POST /api/chat` (stage becomes `"confirming"`) | Saathi reads back a summary; user says yes, or corrects something (→ new summary) |
| 4. Find schemes | `POST /api/schemes/match` | Profile → searches on **myscheme.gov.in** using its official filters. No AI. |
| 5. Flashcards | `POST /api/schemes/{slug}/card` | Official text rewritten simply in the user's language; every number is checked against the source |
| Voice | `GET /api/tts?text=…&lang=kn` | MP3 (gTTS), cached on disk |

### `/api/chat` loop (frontend)

The frontend keeps the state (on the phone — no login, no server database) and sends it back each turn:

```jsonc
// request
{ "message": "ನಾನು ಮಂಡ್ಯದಲ್ಲಿ ರೈತ...", "stage": "collecting",
  "profile": {}, "asked": [], "history": [], "language": null }
// response
{ "stage": "collecting", "reply": "ನಿಮ್ಮ ವಯಸ್ಸು ಎಷ್ಟು?", "language": "kn",
  "profile": {...}, "asked": ["age"], "missing": ["age", "annual_income"],
  "asking_about": "age", "facts": [] }
```

Send `profile`, `asked`, `stage` and `language` from each response into the next request,
and append both messages to `history`. Speak `reply`. When `stage` is `"confirming"`,
also show `facts` (label/value pairs) as the summary card. When it becomes
`"confirmed"`, call `/api/schemes/match` with the profile.

Required before searching: state, age, gender, occupation, rural/urban, family income.
Asked once and skippable: family members, caste, land (farmers only), BPL card.

### `/api/schemes/match`

Returns up to 12 schemes, each with `for` (who in the family: `you`, `daughter`, `mother` …)
and `why` (plain reasons such as "For your work: Farmer", "For your daughter's studies").

How matching works (`app/matcher.py`):
1. The profile becomes several searches on the portal: one for the person's occupation,
   one each for student / disability / BPL / caste / women / senior / widow if they apply,
   one per stated need, and the same for each family member with something specific
   (a student daughter, a widowed mother …).
2. Portal filter rules: values of the same field are ORed, different fields ANDed;
   age uses `{"identifier": "age-general", "min": 45, "max": 45}`.
3. Safety nets: keyword hits must actually contain the keyword; schemes for groups
   the person isn't in (ex-servicemen, construction-board members, another region,
   organisations …) are dropped; crop-specific schemes rank lower unless mentioned.
4. Schemes found by more searches rank higher; each family member with a match is shown.

## Files

```
backend/app/
  main.py          API routes
  conversation.py  steps 2–3: follow-up questions, summary, confirmation
  profile.py       profile fields (labels match the portal's filters) + profile → filters
  matcher.py       step 4: searches, "not for you" rules, ranking
  scraper.py       myscheme.gov.in client, disk cache in backend/cache/ (24 h search, 7 days detail)
  briefs.py        step 5: flashcards + number check
  llm.py           Gemini calls (3.5 Flash, minimal thinking; falls back to other models)
  tts.py           text → speech
```

## Known limits

- **Gemini free tier:** about 8–10 calls a minute. Each chat turn is 1 call (2 on the summary
  turn), each flashcard 1. `llm.py` retries once after 4 s, then fails with a 502.
  For the demo, use a paid key or pre-open the flashcards you'll show (they're cached in memory).
- **Speed:** chat turns take about 3–5 s, the summary turn about 7–10 s; scheme search about 1–2 s
  (instant once cached); a flashcard about 3–5 s.
- The portal's own eligibility tags are sometimes incomplete, so a few results may still not
  apply. Flashcards say "you may be eligible", never "you are eligible".
- The portal's JSON endpoints are unofficial (they're what its own pages use). Fine for a
  prototype; production should use the official API Setu access.
