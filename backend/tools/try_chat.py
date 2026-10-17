"""Talk to Saathi in the terminal, exactly as the app will: type in any language.

    python3 tools/try_chat.py            # text only
    python3 tools/try_chat.py --voice    # also speak every reply (macOS afplay)

Flow: you describe yourself -> Saathi asks follow-ups -> reads back a summary ->
you say yes (or correct it) -> it lists schemes -> type a number to hear a flashcard.
Type 'quit' to stop, 'profile' to see what it has understood so far.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import warnings                                                  # noqa: E402
warnings.filterwarnings("ignore")

from fastapi.testclient import TestClient                        # noqa: E402
from app.main import app                                         # noqa: E402

api = TestClient(app)
VOICE = "--voice" in sys.argv
GREY, BOLD, GREEN, CYAN, END = "\033[90m", "\033[1m", "\033[32m", "\033[36m", "\033[0m"


def say(text: str, lang: str) -> None:
    print(f"\n{GREEN}{BOLD}Saathi:{END} {textwrap.fill(text, 100)}")
    if VOICE:
        r = api.get("/api/tts", params={"text": text[:1500], "lang": lang})
        if r.status_code == 200:
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                f.write(r.content)
            subprocess.run(["afplay", f.name], check=False)


def ask(prompt: str = "You") -> str:
    try:
        return input(f"\n{CYAN}{BOLD}{prompt}:{END} ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        sys.exit(0)


def show_profile(p: dict) -> None:
    print(GREY + json.dumps({k: v for k, v in p.items() if v not in (None, [], "")},
                            ensure_ascii=False, indent=1) + END)


def chat_until_confirmed() -> tuple[dict, str]:
    state = {"stage": "collecting", "profile": {}, "asked": [], "history": [], "language": None}
    print(f"{GREY}Tell Saathi about yourself in any language "
          f"(e.g. 'मैं लखनऊ के पास गाँव में रहती हूँ...').{END}")
    while state["stage"] != "confirmed":
        msg = ask()
        if msg.lower() == "quit":
            sys.exit(0)
        if msg.lower() == "profile":
            show_profile(state["profile"])
            continue
        if not msg:
            continue
        r = api.post("/api/chat", json={"message": msg, **state})
        if r.status_code != 200:
            print(f"{GREY}Error {r.status_code}: {r.json().get('detail', r.text)[:300]}{END}")
            continue
        d = r.json()
        if d["stage"] == "confirming" and d["facts"]:
            print(f"\n{BOLD}Summary card:{END}")
            for f in d["facts"]:
                print(f"  {f['label']:>16}: {f['value']}")
        say(d["reply"], d["language"])
        print(f"{GREY}[stage={d['stage']}  language={d['language']}  "
              f"asking_about={d.get('asking_about')}  still_missing={d['missing']}]{END}")
        state = {"stage": d["stage"], "profile": d["profile"], "asked": d["asked"],
                 "language": d["language"],
                 "history": state["history"] + [{"role": "user", "text": msg},
                                                {"role": "assistant", "text": d["reply"]}]}
    return state["profile"], state["language"]


def browse_schemes(profile: dict, lang: str) -> None:
    print(f"\n{GREY}Searching myscheme.gov.in ...{END}")
    d = api.post("/api/schemes/match", json={"profile": profile}).json()
    print(f"{GREY}[{d['searched']} searches, {d['total_found']} schemes found, "
          f"{d['dropped_not_for_you']} dropped as not-for-you]{END}\n")
    schemes = d["schemes"]
    for i, s in enumerate(schemes, 1):
        print(f" {BOLD}{i:2}. {s['name']}{END}")
        print(f"     {GREY}for: {', '.join(s['for'])}  |  why: {'; '.join(s['why'][:2])}{END}")
    while True:
        pick = ask("Flashcard number (or 'quit')")
        if pick.lower() in ("quit", "q", ""):
            return
        if not pick.isdigit() or not 1 <= int(pick) <= len(schemes):
            continue
        s = schemes[int(pick) - 1]
        r = api.post(f"/api/schemes/{s['slug']}/card", json={"language": lang, "profile": profile})
        if r.status_code != 200:
            print(f"{GREY}Error {r.status_code}: {r.text[:300]}{END}")
            continue
        c = r.json()
        b = c["brief"]
        print(f"\n{BOLD}┌─ {b['title']}{END}  {GREY}({c['official_name']}){END}")
        for label, key in (("What", "one_line"), ("Benefit", "benefit"),
                           ("Who", "who_can_get"), ("Apply", "how_to_apply")):
            print(f"│ {BOLD}{label:>7}:{END} {b[key]}")
        print(f"│ {BOLD}{'Docs':>7}:{END} {', '.join(b['documents'])}")
        print(f"└─ {GREY}source: {c['source_url']}  |  written by: {c['backend']}  |  "
              f"numbers checked: {'OK' if c['check'].get('ok') else c['check']}{END}")
        say(b["spoken"], lang)


if __name__ == "__main__":
    profile, lang = chat_until_confirmed()
    browse_schemes(profile, lang)
