"""Offline tests: the plain-code rules. No internet, no Gemini, runs in about 1 second.

    python3 -m pytest tests/test_rules.py -v
"""
from app.briefs import Brief, _check
from app.conversation import _inr, _merge, facts
from app.matcher import _contains_any, _not_for, _queries_for_person, _member_queries, _school_level
from app.profile import FamilyMember, Profile, base_filters, missing_fields


def item(name, tags=(), brief="", **kw):
    return {"name": name, "tags": list(tags), "brief": brief, **kw}


def ids(filters):
    """{identifier: [values]} for easy checks."""
    out = {}
    for f in filters:
        out.setdefault(f["identifier"], []).append(f.get("value", (f.get("min"), f.get("max"))))
    return out


FARMER = Profile(age=45, gender="Male", state="Karnataka", residence="Rural", occupation="Farmer",
                 annual_income=100000, caste="Other Backward Class (OBC)", is_bpl=True)


# --------------------------------------------------------------------------- #
#  What still needs to be asked
# --------------------------------------------------------------------------- #
class TestMissingFields:
    def test_empty_profile_needs_all_required_first(self):
        assert missing_fields(Profile(), [])[:6] == [
            "state", "age", "gender", "occupation", "residence", "annual_income"]

    def test_optional_question_is_asked_only_once(self):
        p = FARMER.model_copy(update={"caste": None})
        assert "caste" in missing_fields(p, [])
        assert "caste" not in missing_fields(p, ["caste"])        # asked, user skipped

    def test_required_question_is_asked_again_until_answered(self):
        p = FARMER.model_copy(update={"age": None})
        assert "age" in missing_fields(p, ["age"])

    def test_land_only_asked_for_farmers(self):
        tailor = FARMER.model_copy(update={"occupation": "Unorganized Worker"})
        assert "land_acres" in missing_fields(FARMER, [])
        assert "land_acres" not in missing_fields(tailor, [])

    def test_complete_profile_has_nothing_missing(self):
        asked = ["family_members", "land_acres"]
        assert missing_fields(FARMER, asked) == []


# --------------------------------------------------------------------------- #
#  Profile -> portal filters
# --------------------------------------------------------------------------- #
class TestFilters:
    def test_state_and_gender_include_all(self):
        f = ids(base_filters(FARMER))
        assert f["beneficiaryState"] == ["Karnataka", "All"]
        assert f["gender"] == ["Male", "All"]
        assert f["residence"] == ["Rural", "Both"]
        assert f["caste"] == ["Other Backward Class (OBC)", "All"]

    def test_age_uses_min_max_format(self):
        age = [x for x in base_filters(FARMER) if x["identifier"] == "age-general"]
        assert age == [{"identifier": "age-general", "min": 45, "max": 45}]

    def test_unknown_facts_add_no_filter(self):
        f = ids(base_filters(Profile(state="Bihar")))
        assert "gender" not in f and "age-general" not in f and "caste" not in f

    def test_skipped_caste_adds_no_filter(self):
        p = FARMER.model_copy(update={"caste": "Prefer not to say"})
        assert "caste" not in ids(base_filters(p))

    def test_rare_traits_default_to_no(self):
        f = ids(base_filters(FARMER))
        assert f["disability"] == ["No"] and f["minority"] == ["No"]
        assert f["isGovEmployee"] == ["No"]

    def test_adult_not_mentioning_study_is_not_student(self):
        assert ids(base_filters(FARMER))["isStudent"] == ["No"]
        assert "isStudent" not in ids(base_filters(Profile(state="Goa", age=19)))

    def test_bpl_holder_keeps_bpl_schemes(self):
        assert "isBpl" not in ids(base_filters(FARMER))
        no_bpl = FARMER.model_copy(update={"is_bpl": False})
        assert ids(base_filters(no_bpl))["isBpl"] == ["No"]


# --------------------------------------------------------------------------- #
#  Which searches we run
# --------------------------------------------------------------------------- #
class TestQueries:
    def test_farmer_gets_occupation_bpl_and_caste_searches(self):
        reasons = [q.reason for q in _queries_for_person(FARMER)]
        assert "For your work: Farmer" in reasons
        assert "For BPL card holders" in reasons
        assert "For Other Backward Class category" in reasons

    def test_stated_need_is_searched_with_top_weight(self):
        p = FARMER.model_copy(update={"needs": ["health insurance"]})
        q = next(q for q in _queries_for_person(p) if q.keyword == "health insurance")
        assert q.weight == 4 and q.must_match == ["health insurance"]

    def test_student_daughter_gets_her_own_search(self):
        d = FamilyMember(relation="daughter", age=18, gender="Female", is_student=True,
                         education="college", needs=["college scholarship"])
        qs = _member_queries(FARMER, d)
        assert all(q.member == "daughter" for q in qs)
        assert any(ids(q.filters).get("isStudent") == ["Yes"] for q in qs)
        assert any(q.keyword == "college scholarship" for q in qs)
        # her searches use HER age and gender, not her father's
        f = ids(qs[0].filters)
        assert f["gender"] == ["Female", "All"] and f["age-general"] == [(18, 18)]

    def test_member_with_nothing_specific_gets_no_search(self):
        assert _member_queries(FARMER, FamilyMember(relation="wife", gender="Female")) == []


# --------------------------------------------------------------------------- #
#  "Not for you" rules
# --------------------------------------------------------------------------- #
class TestNotForYou:
    def test_other_occupation_scheme_is_dropped(self):
        assert _not_for(item("RMEWF Assistance for Ex-Servicemen"), FARMER, "Karnataka") == "Ex Servicemen"
        assert _not_for(item("Pension (K.B.O.C.W.W.B)"), FARMER, "Karnataka") == "Construction Worker"

    def test_own_occupation_scheme_is_kept(self):
        fisher = FARMER.model_copy(update={"occupation": "Fishermen"})
        assert _not_for(item("Matsya Sampada for fishermen"), fisher, "Kerala") is None
        assert _not_for(item("Matsya Sampada for fishermen"), FARMER, "Karnataka") == "Fishermen"

    def test_north_east_only_for_north_east(self):
        s = item("Coffee Development in North East Region")
        assert _not_for(s, FARMER, "Karnataka") == "_north_east"
        assert _not_for(s, FARMER, "Assam") is None

    def test_old_age_pension_needs_60_plus(self):
        s = item("NSAP - Indira Gandhi National Old Age Pension Scheme")
        assert _not_for(s, FARMER, "Karnataka") == "_senior_citizen"
        mother = Profile(age=68, gender="Female", state="Karnataka")
        assert _not_for(s, mother, "Karnataka") is None

    def test_school_child_does_not_get_college_scholarships(self):
        son = Profile(age=12, is_student=True, education="class 6", state="Uttar Pradesh")
        assert _school_level(son) == "school"
        assert _not_for(item("National Talent Scholarship Postgraduate"), son, None) == "_college_student"
        assert _not_for(item("Pre-Matric Scholarship for SC Students"), son, None) is None

    def test_college_student_does_not_get_school_scholarships(self):
        d = Profile(age=18, is_student=True, education="college", state="Karnataka")
        assert _school_level(d) == "college"
        assert _not_for(item("Pre-Matric Scholarship for SC Students"), d, None) == "_school_student"

    def test_scholarships_hidden_from_non_students(self):
        assert _not_for(item("Merit Scholarship"), FARMER, "Karnataka") == "_student"

    def test_illness_schemes_only_if_mentioned(self):
        s = item("Leprosy Pension Scheme")
        assert _not_for(s, FARMER, "Karnataka") == "_illness"
        sick = FARMER.model_copy(update={"needs": ["leprosy treatment"]})
        assert _not_for(s, sick, "Karnataka") is None

    def test_plain_scheme_is_kept(self):
        assert _not_for(item("Pradhan Mantri Kisan Samman Nidhi", ["Farmers"]), FARMER, "Karnataka") is None

    def test_keyword_must_match_every_word(self):
        assert _contains_any("health insurance for poor families", ["health insurance"])
        assert not _contains_any("coconut palm insurance", ["health insurance"])


# --------------------------------------------------------------------------- #
#  Flashcard number check
# --------------------------------------------------------------------------- #
def brief(**kw):
    base = dict(title="PM-KISAN", one_line="", benefit="", who_can_get="", how_to_apply="",
                documents=[], spoken="")
    return Brief(**{**base, **kw})


class TestNumberCheck:
    SOURCE = "Financial benefit of Rs. 6000 per annum payable in three installments of Rs 2000 each."

    def test_numbers_from_source_pass(self):
        assert _check(brief(benefit="₹6,000 a year in 3 instalments of ₹2,000"), self.SOURCE)["ok"]

    def test_invented_number_fails(self):
        r = _check(brief(spoken="You get ₹10,000 every year"), self.SOURCE)
        assert not r["ok"] and r["ungrounded"][0]["number"] == 10000

    def test_lakh_written_out_passes(self):
        assert _check(brief(benefit="₹5,00,000 cover"), "Health cover of Rs 5 lakh per family")["ok"]


# --------------------------------------------------------------------------- #
#  Conversation helpers
# --------------------------------------------------------------------------- #
class TestConversationHelpers:
    def test_model_cannot_drop_known_facts(self):
        old = FARMER.model_copy(update={"needs": ["health insurance"]})
        new = Profile(age=46)                      # model returned a near-empty profile
        m = _merge(old, new)
        assert m.age == 46                         # correction applied
        assert m.state == "Karnataka" and m.occupation == "Farmer"   # rest kept
        assert m.needs == ["health insurance"]

    def test_indian_rupee_format(self):
        assert _inr(80000) == "₹80,000"
        assert _inr(100000) == "₹1,00,000"
        assert _inr(2500000) == "₹25,00,000"
        assert _inr(500) == "₹500"

    def test_summary_facts_are_readable(self):
        f = {x.label: x.value for x in facts(FARMER.model_copy(update={"land_acres": 2.0}))}
        assert f["Family income"] == "₹1,00,000 per year"
        assert f["Land"] == "2 acres"
        assert f["Lives in"] == "Village (rural)"


# --------------------------------------------------------------------------- #
#  Bugs found by the interactive tester (kept as regression tests)
# --------------------------------------------------------------------------- #
from app.conversation import reply_language, script_language, western_digits   # noqa: E402

DRIVER = Profile(age=30, gender="Male", state="Tamil Nadu", residence="Urban",
                 occupation="Unorganized Worker", occupation_detail="auto driver",
                 annual_income=180000, caste="General", is_bpl=False)


class TestRegressions:
    def test_english_message_gets_english_reply(self):
        assert reply_language("I am Ravi, 30, auto driver in Chennai", None) == "en"
        assert reply_language("General category, no BPL card", "en") == "en"

    def test_script_decides_language(self):
        assert script_language("ನನಗೆ 45 ವರ್ಷ") == "kn"
        assert script_language("मेरी उम्र 38 है") == "hi"
        assert script_language("எனக்கு 30 வயது") == "ta"

    def test_short_latin_answer_keeps_conversation_language(self):
        assert reply_language("OBC", "hi") == "hi"
        assert reply_language("yes", "kn") == "kn"

    def test_indic_digits_become_western(self):
        assert western_digits("आप ३० साल के हैं") == "आप 30 साल के हैं"

    def test_negation_in_summary_does_not_drop_scheme(self):
        # PM-SYM's summary says "not a member of EPFO" - it IS for unorganised workers
        pm_sym = item("Pradhan Mantri Shram Yogi Maan-dhan", ["Pension", "Unorganised Worker"],
                      "For unorganised workers who are not members of EPFO/ESIC or NPS.")
        assert _not_for(pm_sym, DRIVER, "Tamil Nadu") is None

    def test_single_industry_scheme_dropped(self):
        s = item("Health Component of Labour Welfare Scheme", ["Health"],
                 "Health care to Beedi workers, Cine workers and non-coal mine workers.")
        assert _not_for(s, DRIVER, "Tamil Nadu") == "_specific_industry"

    def test_awards_and_orphan_schemes_dropped(self):
        assert _not_for(item("Poompuhar State Award"), DRIVER, "Tamil Nadu") == "_award"
        child = Profile(age=4, state="Tamil Nadu")
        assert _not_for(item("Mission Vatsalya (Child Protection Services)"), child, None) == "_vulnerable_child"

    def test_working_adult_gets_safety_net_searches(self):
        kws = {q.keyword for q in _queries_for_person(DRIVER)}
        assert {"health insurance", "accident insurance", "life insurance", "pension",
                "housing"} <= kws
        rich = DRIVER.model_copy(update={"annual_income": 900000})
        assert "housing" not in {q.keyword for q in _queries_for_person(rich)}

    def test_portal_job_filter_trusted_only_for_broad_schemes(self):
        pm_sym = item("Pradhan Mantri Shram Yogi Maan-dhan", ["Artisan", "Pension", "Vendor", "Worker"])
        assert _not_for(pm_sym, DRIVER, "Tamil Nadu", trust_occupation=True) is None
        svanidhi = item("PM Street Vendor's AtmaNirbhar Nidhi", ["Street Vendors", "Loan"])
        assert _not_for(svanidhi, DRIVER, "Tamil Nadu", trust_occupation=True) == "Street Vendor"
