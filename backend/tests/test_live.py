"""Live tests: the real myScheme portal, the API routes, and (marked `ai`) Gemini.

    python3 -m pytest tests/test_live.py -v              # everything (~1 min, ~6 Gemini calls)
    python3 -m pytest tests/test_live.py -v -m "not ai"  # skip Gemini (saves free-tier quota)
"""
import asyncio

import pytest
from fastapi.testclient import TestClient

from app import llm, matcher, scraper
from app.main import app
from app.profile import FamilyMember, Profile

client = TestClient(app)
ai = pytest.mark.ai


def run(coro):
    return asyncio.run(coro)


FARMER_FAMILY = Profile(
    age=45, gender="Male", state="Karnataka", residence="Rural", occupation="Farmer",
    annual_income=100000, land_acres=2, caste="Other Backward Class (OBC)", is_bpl=True,
    needs=["health insurance"],
    family_members=[
        FamilyMember(relation="daughter", age=18, gender="Female", is_student=True,
                     education="college", needs=["college scholarship"]),
        FamilyMember(relation="mother", age=68, gender="Female", marital_status="Widowed")])

WIDOW = Profile(age=38, gender="Female", state="Uttar Pradesh", residence="Rural",
                occupation="Unorganized Worker", occupation_detail="tailor",
                marital_status="Widowed", annual_income=60000, caste="Scheduled Caste (SC)",
                is_bpl=True,
                family_members=[FamilyMember(relation="son", age=12, gender="Male",
                                             is_student=True, education="class 6")])


# --------------------------------------------------------------------------- #
#  The portal (myscheme.gov.in)
# --------------------------------------------------------------------------- #
class TestPortal:
    def test_search_finds_pm_kisan_for_karnataka_farmers(self):
        f = [{"identifier": "occupation", "value": "Farmer"},
             {"identifier": "beneficiaryState", "value": "Karnataka"},
             {"identifier": "beneficiaryState", "value": "All"}]
        r = run(scraper.search(f, size=50))
        assert r["total"] > 0
        assert "pm-kisan" in [i["slug"] for i in r["items"]]

    def test_age_filter_works(self):
        base = [{"identifier": "beneficiaryState", "value": "All"},
                {"identifier": "isBpl", "value": "Yes"}]
        age = lambda a: {"identifier": "age-general", "min": a, "max": a}   # noqa: E731
        slugs = lambda a: [i["slug"] for i in run(scraper.search(base + [age(a)], size=50))["items"]]  # noqa: E731
        assert "nsap-ignoaps" not in slugs(45)                 # old-age pension
        assert "nsap-ignoaps" in slugs(68)

    def test_scheme_detail_has_the_real_facts(self):
        d = run(scraper.detail("pm-kisan"))
        assert d["name"] == "Pradhan Mantri Kisan Samman Nidhi"
        assert "6000" in d["benefits"]
        assert "Aadhaar" in d["documents"]

    def test_unknown_scheme_has_no_name(self):
        assert not run(scraper.detail("this-scheme-does-not-exist-123")).get("name")


# --------------------------------------------------------------------------- #
#  Matching (portal + our rules, no AI)
# --------------------------------------------------------------------------- #
class TestMatching:
    @pytest.fixture(scope="class")
    def farmer(self):
        return run(matcher.find_schemes(FARMER_FAMILY))

    @pytest.fixture(scope="class")
    def widow(self):
        return run(matcher.find_schemes(WIDOW))

    def test_farmer_gets_core_schemes(self, farmer):
        slugs = [s["slug"] for s in farmer["schemes"]]
        assert "pm-kisan" in slugs
        assert "ab-pmjay" in slugs                         # asked for health insurance

    def test_every_family_member_with_a_match_is_shown(self, farmer):
        who = {w for s in farmer["schemes"] for w in s["for"]}
        assert {"you", "daughter", "mother"} <= who

    def test_every_scheme_says_why(self, farmer):
        assert all(s["why"] for s in farmer["schemes"])

    def test_daughter_gets_college_not_school_schemes(self, farmer):
        hers = [s["name"].lower() for s in farmer["schemes"] if "daughter" in s["for"]]
        assert hers and not any("pre-matric" in n or "pre matric" in n for n in hers)

    def test_no_schemes_for_other_groups(self, farmer, widow):
        names = " ".join(s["name"].lower() for s in farmer["schemes"] + widow["schemes"])
        for wrong in ("ex-servic", "construction worker", "journalist", "north east", "leprosy"):
            assert wrong not in names, wrong

    def test_widow_gets_widow_pension(self, widow):
        names = [s["name"].lower() for s in widow["schemes"]]
        assert any("widow" in n for n in names)

    def test_widow_under_60_gets_no_old_age_pension(self, widow):
        assert not any("old age" in s["name"].lower() for s in widow["schemes"])

    def test_school_son_gets_no_college_schemes(self, widow):
        his = [s["name"].lower() for s in widow["schemes"] if "son" in s["for"]]
        assert his
        assert not any(w in n for n in his for w in ("postgraduate", "college", "uchchatar"))


# --------------------------------------------------------------------------- #
#  API routes (no AI)
# --------------------------------------------------------------------------- #
class TestRoutes:
    def test_health(self):
        r = client.get("/api/health")
        assert r.status_code == 200 and r.json()["ok"]

    def test_empty_chat_message_rejected(self):
        assert client.post("/api/chat", json={"message": "  "}).status_code == 400

    def test_match_needs_a_state(self):
        assert client.post("/api/schemes/match", json={"profile": {"age": 30}}).status_code == 400

    def test_match_returns_schemes(self):
        r = client.post("/api/schemes/match", json={"profile": WIDOW.model_dump(), "limit": 5})
        assert r.status_code == 200 and 0 < r.json()["count"] <= 5

    def test_unknown_scheme_is_404(self):
        assert client.get("/api/schemes/not-a-real-scheme-xyz").status_code == 404

    def test_text_to_speech_returns_mp3(self):
        r = client.get("/api/tts", params={"text": "नमस्ते", "lang": "hi"})
        assert r.status_code == 200 and r.headers["content-type"] == "audio/mpeg"
        assert len(r.content) > 1000


# --------------------------------------------------------------------------- #
#  Gemini (uses free-tier quota)
# --------------------------------------------------------------------------- #
@ai
@pytest.mark.skipif(not llm.available(), reason="GEMINI_API_KEY not set")
class TestAI:
    def test_hindi_first_message_is_understood(self):
        msg = ("नमस्ते, मेरा नाम सुनीता है। मैं लखनऊ के पास एक गाँव में रहती हूँ, 38 साल की हूँ। "
               "मेरे पति नहीं रहे, मैं सिलाई का काम करती हूँ। महीने का 5 हज़ार कमाती हूँ।")
        d = client.post("/api/chat", json={"message": msg}).json()
        p = d["profile"]
        assert d["language"] == "hi"
        assert (p["state"], p["age"], p["gender"]) == ("Uttar Pradesh", 38, "Female")
        assert p["residence"] == "Rural" and p["marital_status"] == "Widowed"
        assert p["annual_income"] == 60000                 # 5,000 a month -> per year
        assert d["stage"] == "collecting" and d["asking_about"] in d["missing"]
        assert any("ऀ" <= ch <= "ॿ" for ch in d["reply"])   # reply in Devanagari

    def test_never_asks_for_aadhaar(self):
        d = client.post("/api/chat", json={"message": "I am a farmer in Punjab, 50 years old."}).json()
        assert "aadhaar" not in d["reply"].lower()

    def test_yes_confirms_and_correction_updates(self):
        state = {"stage": "confirming", "profile": WIDOW.model_dump(), "asked": [],
                 "language": "hi"}
        yes = client.post("/api/chat", json={"message": "हाँ, सब सही है", **state}).json()
        assert yes["stage"] == "confirmed"
        fix = client.post("/api/chat", json={"message": "नहीं, मेरी उम्र 42 है", **state}).json()
        assert fix["stage"] == "confirming" and fix["profile"]["age"] == 42
        assert fix["profile"]["state"] == "Uttar Pradesh"   # nothing else lost

    def test_flashcard_is_grounded_and_in_hindi(self):
        r = client.post("/api/schemes/pm-kisan/card", json={"language": "hi"})
        c = r.json()
        assert r.status_code == 200
        assert c["backend"] == "gemini" and c["check"]["ok"]
        assert "6000" in c["brief"]["benefit"].replace(",", "")
        assert any("ऀ" <= ch <= "ॿ" for ch in c["brief"]["spoken"])


DRIVER = Profile(age=30, gender="Male", state="Tamil Nadu", residence="Urban",
                 occupation="Unorganized Worker", occupation_detail="auto driver",
                 annual_income=180000, caste="General", is_bpl=False,
                 family_members=[FamilyMember(relation="son", age=4, gender="Male")])


class TestDriver:
    @pytest.fixture(scope="class")
    def driver(self):
        return run(matcher.find_schemes(DRIVER))

    def test_gets_worker_pension_and_insurance(self, driver):
        slugs = [s["slug"] for s in driver["schemes"]]
        names = " ".join(s["name"].lower() for s in driver["schemes"])
        assert "pm-sym" in slugs or "shram yogi" in names
        assert "suraksha bima" in names or "jeevan jyoti" in names
        assert len(slugs) >= 6

    def test_no_beedi_or_orphan_schemes(self, driver):
        names = " ".join(s["name"].lower() for s in driver["schemes"])
        assert "labour welfare" not in names and "vatsalya" not in names
        assert "street vendor" not in names


@ai
@pytest.mark.skipif(not llm.available(), reason="GEMINI_API_KEY not set")
def test_english_user_gets_english_reply():
    d = client.post("/api/chat", json={
        "message": "I am Ravi, 30, auto driver in Chennai. Wife and a 4 year old son. "
                   "We earn about 15000 a month."}).json()
    assert d["language"] == "en"
    assert script_language_is_latin(d["reply"])


def script_language_is_latin(text):
    letters = [c for c in text if c.isalpha()]
    return sum(c.isascii() for c in letters) > 0.9 * len(letters)
