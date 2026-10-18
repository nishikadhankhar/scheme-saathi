# Scheme Saathi

Tell Saathi about your life in your own language; it asks a few follow-up questions,
reads back what it understood, and finds government schemes you may be eligible for,
shown as flashcards that it reads aloud in your native tongue.

**Languages:** the user just speaks or chooses their language; Saathi detects the language, translates the entire interface, and replies and speaks natively in it:
**Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia, English**
(Voice output & native UI translations supported across **all 11 languages**, including Odia). Tested end to end in **Hindi** and **Kannada**.

**Design rules:** no login · no Aadhaar, bank details or documents collected ·
the AI only does language work · eligibility comes from the official portal's filters.

---

## Quick Start

You will need two terminals running side-by-side:

### 1. Backend (FastAPI)

```bash
cd backend
pip3 install -r requirements.txt
echo "GEMINI_API_KEY=your_key_here" > .env
uvicorn app.main:app --reload --port 8000
```

*(On Windows PowerShell:)*
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

- API runs at: http://localhost:8000
- Interactive Swagger docs: http://localhost:8000/docs

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

- Web App opens at: **http://localhost:5173**
- In development, API requests to `/api/*` are automatically proxied to the backend at port 8000.

---

## Test it

```bash
cd backend
python3 -m pytest tests/ -v                 # test suite (live portal + rules)
python3 -m pytest tests/ -v -m "not ai"     # skip Gemini to save free-tier quota
python3 tools/try_chat.py --voice           # interactive terminal demo with audio
```

- `tests/test_rules.py`: the plain-code rules (filters, "not for you", number checks, language). Runs offline in < 1 s.
- `tests/test_live.py`: real portal searches for 3 sample families (Karnataka farmer, UP widow tailor, Chennai auto driver), every API route, and Gemini grounding tests.
- `tools/try_chat.py`: the complete flow in the terminal, in any language. Type `profile` at any point to inspect what Saathi has understood.
- Click-through test page: open http://localhost:8000/docs → "Try it out".

---

## The Flow

| Step | Endpoint | What happens |
|---|---|---|
| **1. User speaks** | `POST /api/transcribe` (field `audio`) | Gemini turns speech into text in the speaker's own script |
| **2. Follow-up questions** | `POST /api/chat` (`stage: "collecting"`) | Gemini extracts facts into the profile; code determines what's missing; Saathi asks one simple question |
| **3. Summary + confirmation** | `POST /api/chat` (`stage: "confirming"`) | Saathi reads back what it learned; user says yes or corrects facts (→ new summary) |
| **4. Find schemes** | `POST /api/schemes/match` | Profile searches on **myscheme.gov.in** using official portal filters. No AI hallucination. |
| **5. Flashcards** | `POST /api/schemes/{slug}/card` | Official text simplified into a grounded flashcard in the user's language and script; numbers verified against source |
| **Voice (TTS)** | `GET /api/tts?text=…&lang=…` | MP3 audio cached on disk; supported across all 11 languages (including Odia phonetic synthesis) |

---

### `/api/chat` Loop (Frontend State)

The frontend manages conversation state on the user's phone (no login, no server-side database) and sends it back each turn:

```jsonc
// Request
{
  "message": "ನಾನು ಮಂಡ್ಯದಲ್ಲಿ ರೈತ...",
  "stage": "collecting",
  "profile": {},
  "asked": [],
  "history": [],
  "language": "kn"
}

// Response
{
  "stage": "collecting",
  "reply": "ನಿಮ್ಮ ವಯಸ್ಸು ಎಷ್ಟು?",
  "language": "kn",
  "profile": { "state": "Karnataka", "occupation": "Farmer" },
  "asked": ["age"],
  "missing": ["age", "annual_income"],
  "asking_about": "age",
  "facts": []
}
```

- Send `profile`, `asked`, `stage`, and `language` from each response into the next request.
- When `stage` is `"confirming"`, display `facts` (label/value pairs) on the summary card.
- When `stage` is `"confirmed"`, call `POST /api/schemes/match` with the completed profile.

**Required before searching:** State, age, gender, occupation, rural/urban residence, family income.  
**Asked once and skippable:** Family members, caste category, land holding (farmers only), BPL card.

---

### Scheme Matching (`backend/app/matcher.py`)

Returns up to 12 schemes, each with `for` (who in the family qualifies: `you`, `daughter`, `mother` …) and localized `why` tags (e.g. *"For BPL card holders"* $\rightarrow$ *"बीपीएल (BPL) कार्ड धारकों के लिए"*).

1. **Targeted Searches:** Generates targeted queries on **myscheme.gov.in** based on occupation, student/disability/BPL/caste/gender/age status, plus separate queries for family members.
2. **Portal Filter Semantics:** Values for the same filter are ORed; different filters are ANDed.
3. **Safety Nets:** Keyword hits must actually contain the required terms; irrelevant schemes (ex-servicemen, construction-board specific, other states) are dropped.
4. **Ranking:** Schemes matched by multiple queries rank higher; family members each get fair representation.

---

## Repository Structure

```
scheme-saathi/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI application & API endpoints
│   │   ├── conversation.py  # Chat turn handling, question selection & summary
│   │   ├── profile.py       # Profile models, fields & portal filter builders
│   │   ├── matcher.py       # Scheme matching & query builder for myscheme.gov.in
│   │   ├── scraper.py       # Government portal scraper client & UTF-8 disk cache
│   │   ├── briefs.py        # Flashcard generation in native scripts + number grounding
│   │   ├── llm.py           # Gemini client wrapper with model fallbacks & retries
│   │   └── tts.py           # Multilingual text-to-speech (gTTS + Odia phonetic synthesis)
│   ├── tests/               # Offline rule tests and live integration tests
│   ├── tools/               # Terminal-based chat testing tool (`try_chat.py`)
│   └── requirements.txt     # Python dependencies
│
└── frontend/
    ├── src/
    │   ├── components/      # React screens (Welcome, Listening, Summary, Results, Flashcards)
    │   ├── lib/
    │   │   ├── i18n.js      # Complete UI translation tables for all 11 languages
    │   │   ├── speech.js    # TTS client with audio playback & accent safeguards
    │   │   ├── recorder.js  # Voice recording & audio blob management
    │   │   └── schemes.js   # Flashcard data processing & reason localization
    │   ├── styles.css       # Core styling & custom animations
    │   └── tokens.css       # Accessible color tokens & high-sunlight mode
    └── package.json         # React 18, Vite & Tailwind CSS dependencies
```

---

## Known Limits & Notes

- **Gemini Free-Tier Rate Limits:** About 8–10 requests per minute. `llm.py` retries once after 4 s before returning a 502. Flashcards are cached in memory and on disk.
- **Speed:** Chat turns take ~2–4 s; scheme search takes ~1–2 s (instant when cached); flashcard generation takes ~2–4 s.
- **Grounding Guarantee:** Flashcards say *"you may be eligible"*, never *"you are eligible"*, as official qualification depends on final government verification.
- **API Setu:** The portal JSON endpoints are current production endpoints used by myscheme.gov.in. Production enterprise deployments should use dedicated API Setu credentials.
