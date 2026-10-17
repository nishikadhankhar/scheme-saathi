"""The user's profile: what we learn from the conversation.

Labels for state, gender, caste, occupation etc. are copied exactly from the
myScheme portal's filters, so a profile maps straight onto an official search.
Nothing sensitive is collected: no Aadhaar, no bank details, no documents.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

State = Literal[
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
    "Chandigarh", "Chhattisgarh", "Dadra & Nagar Haveli and Daman & Diu", "Delhi", "Goa",
    "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
    "Kerala", "Ladakh", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"]

Occupation = Literal[
    "Farmer", "Dairy Farmer", "Fishermen", "Construction Worker", "Unorganized Worker",
    "Organized Worker", "Artisans, Spinners & Weavers", "Khadi Artisan", "Coir Worker",
    "Artists", "Street Vendor", "Student", "Sportsperson", "Ex Servicemen", "Journalist",
    "Safai Karamchari", "Teacher / Faculty", "Health Worker", "Lawyer / Law Graduate / Advocate",
    "Homemaker", "Other"]

Caste = Literal[
    "General", "Other Backward Class (OBC)", "Scheduled Caste (SC)", "Scheduled Tribe (ST)",
    "Particularly Vulnerable Tribal Group (PVTG)",
    "De-Notified, Nomadic, and Semi-Nomadic (DNT) communities", "Prefer not to say"]

Gender = Literal["Male", "Female", "Transgender"]
Residence = Literal["Rural", "Urban"]
Employment = Literal["Employed", "Self-Employed/ Entrepreneur", "Unemployed"]
Marital = Literal["Never Married", "Married", "Widowed", "Divorced", "Separated"]
Language = Literal["en", "hi", "kn", "ta", "te", "ml", "mr", "bn", "gu", "pa", "or"]

LANGUAGE_NAMES = {"en": "English", "hi": "Hindi", "kn": "Kannada", "ta": "Tamil", "te": "Telugu",
                  "ml": "Malayalam", "mr": "Marathi", "bn": "Bengali", "gu": "Gujarati",
                  "pa": "Punjabi", "or": "Odia"}


class FamilyMember(BaseModel):
    relation: str = Field(description="In English: wife, husband, son, daughter, mother, father, ...")
    age: Optional[int] = None
    gender: Optional[Gender] = None
    is_student: Optional[bool] = None
    education: Optional[str] = Field(None, description="e.g. 'class 10', 'college', 'nursing diploma'")
    occupation: Optional[Occupation] = None
    has_disability: Optional[bool] = None
    marital_status: Optional[Marital] = None
    needs: list[str] = Field(default_factory=list,
                             description="Short English keywords for help THIS member needs, "
                                         "e.g. 'college scholarship', 'old age pension'")


class Profile(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[Gender] = None
    state: Optional[State] = None
    district: Optional[str] = None
    residence: Optional[Residence] = None
    occupation: Optional[Occupation] = None
    occupation_detail: Optional[str] = Field(None, description="Their own words, e.g. 'tailor', 'auto driver'")
    employment_status: Optional[Employment] = None
    annual_income: Optional[int] = Field(None, description="Whole family, rupees per year")
    is_bpl: Optional[bool] = Field(None, description="Below Poverty Line / BPL ration card")
    caste: Optional[Caste] = None
    is_student: Optional[bool] = None
    education: Optional[str] = None
    has_disability: Optional[bool] = None
    disability_percent: Optional[int] = None
    is_minority: Optional[bool] = None
    marital_status: Optional[Marital] = None
    is_gov_employee: Optional[bool] = None
    land_acres: Optional[float] = None
    family_members: list[FamilyMember] = Field(default_factory=list)
    needs: list[str] = Field(default_factory=list,
                             description="Short English keywords for help the SPEAKER wants for "
                                         "themselves or the whole household, e.g. 'health insurance', 'house'")


# --------------------------------------------------------------------------- #
#  What we still need to ask
# --------------------------------------------------------------------------- #
# Must know before we search, in the order we ask.
REQUIRED = ["state", "age", "gender", "occupation", "residence", "annual_income"]
# Asked once; the user may skip them (we remember that we asked).
OPTIONAL = ["family_members", "caste", "land_acres", "is_bpl"]

FIELD_HINTS = {
    "state": "which state they live in",
    "age": "their age",
    "gender": "their gender (only if not already obvious from what they said)",
    "occupation": "what work they do",
    "residence": "whether they live in a village (rural) or a town/city (urban)",
    "annual_income": "roughly how much the whole family earns in a year",
    "family_members": "who else lives in their family (ages; anyone studying, elderly or with a disability)",
    "caste": "their caste category (SC / ST / OBC / General); say it is optional and they can skip",
    "land_acres": "how much farm land they have, in acres",
    "is_bpl": "whether they have a BPL (below poverty line) ration card",
}


def missing_fields(p: Profile, asked: list[str]) -> list[str]:
    out = [f for f in REQUIRED if getattr(p, f) in (None, "", [])]
    for f in OPTIONAL:
        if f in asked:
            continue
        if f == "land_acres" and p.occupation not in ("Farmer", "Dairy Farmer"):
            continue
        if getattr(p, f) in (None, "", []):
            out.append(f)
    return out


# --------------------------------------------------------------------------- #
#  Profile -> myScheme search filters
# --------------------------------------------------------------------------- #
def _f(identifier: str, *values) -> list[dict]:
    return [{"identifier": identifier, "value": v} for v in values]


def base_filters(p: Profile, age: int | None = None, gender: str | None = None,
                 is_student: bool | None = None, has_disability: bool | None = None,
                 marital: str | None = None) -> list[dict]:
    """Filters every result must pass. Unknown facts add no filter (we stay inclusive).

    For yes/no facts we only filter OUT schemes that need something the person
    doesn't have (e.g. not a student -> drop student-only schemes). Disability,
    minority and government-job status are rare, so if the person never mentioned
    them we assume "no" instead of showing schemes that need them.
    """
    age = p.age if age is None else age
    gender = p.gender if gender is None else gender
    is_student = p.is_student if is_student is None else is_student
    if is_student is None and age is not None and age >= 25:
        is_student = False              # an adult who never mentioned studying
    has_disability = p.has_disability if has_disability is None else has_disability
    marital = p.marital_status if marital is None else marital

    q: list[dict] = []
    if p.state:
        q += _f("beneficiaryState", p.state, "All")
    if gender:
        q += _f("gender", gender, "All")
    if age is not None:
        q.append({"identifier": "age-general", "min": age, "max": age})
    if p.caste and p.caste != "Prefer not to say":
        q += _f("caste", p.caste, "All")
    if p.residence:
        q += _f("residence", p.residence, "Both")
    if marital:
        q += _f("maritalStatus", marital, "All")
    if is_student is False:
        q += _f("isStudent", "No")
    if not has_disability:
        q += _f("disability", "No")
    if not p.is_minority:
        q += _f("minority", "No")
    if p.is_bpl is False:
        q += _f("isBpl", "No")
    if p.is_gov_employee is not True:
        q += _f("isGovEmployee", "No")
    return q
