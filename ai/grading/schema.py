"""
Shape, validation and arithmetic for a Writing/Speaking grading result —
Milestone 8 (AI_CHATBOT_PLAN.md section 13). Pure: no I/O, no model.

Why this module is strict. The grader is a small local LLM asked to reply in JSON,
and a reply that *parses* is not a reply that is *usable*: the Kaggle data-generation
runs (AI_TASKS.md, "Lỗi thật thứ 3") crashed on a reply that parsed fine but had the
wrong shape. So everything the model returns is validated here, and whatever can be
computed or checked by code is:

  - the overall band is computed from the four criterion bands — the model's own
    `overallBand`, if it sends one, is ignored (small models mis-add);
  - bands are clamped to 0-9 and snapped to the 0.5 grid, and any such adjustment is
    recorded in `warnings`, never silent;
  - every quoted `evidence` snippet must actually occur in the graded text — a quote
    the model invented is dropped (and recorded), never shown to the user.

A structurally unusable reply raises GradingParseError, so the caller can retry once
and then fail loudly instead of guessing.
"""
from __future__ import annotations

import json
import math
import re
from typing import Literal, Sequence

Skill = Literal["writing", "speaking"]

# (key, human label) per criterion, in the order the UI shows them. The keys are the
# API contract (AI_CHATBOT_PLAN.md 13.4); the labels are the public IELTS names.
CRITERIA: dict[Skill, tuple[tuple[str, str], ...]] = {
    "writing": (
        ("taskResponse", "Task Achievement / Task Response"),
        ("coherenceCohesion", "Coherence & Cohesion"),
        ("lexicalResource", "Lexical Resource"),
        ("grammaticalRange", "Grammatical Range & Accuracy"),
    ),
    "speaking": (
        ("fluencyCoherence", "Fluency & Coherence"),
        ("lexicalResource", "Lexical Resource"),
        ("grammaticalRange", "Grammatical Range & Accuracy"),
        ("pronunciation", "Pronunciation"),
    ),
}

BAND_MIN = 0.0
BAND_MAX = 9.0
MAX_SUMMARY_ITEMS = 3  # strengths / improvements / evidence snippets kept per list


class GradingParseError(ValueError):
    """The model's reply cannot be turned into a valid grading result."""


def ielts_round(mean: float) -> float:
    """Official IELTS rounding of an average band: a fraction below .25 rounds down to
    the whole band, .25 up to (not including) .75 rounds to the half band, .75 and above
    rounds up to the next whole band.

    Mirrors web/src/lib/engine/ieltsRounding.ts as it actually is — including its
    4-decimal guard against floating-point noise (6.249999999999 must round like 6.25),
    which PROJECT_CONTEXT.md 5.5's pseudocode omits. Like the original it does not clamp:
    keeping inputs inside 0-9 is the caller's job (overall_band's inputs are snapped).
    `Math.round` in JS rounds ties up, hence floor(x + 0.5) rather than Python's round().
    """
    rounded = math.floor(mean * 10000 + 0.5) / 10000
    whole = math.floor(rounded)
    frac = rounded - whole
    if frac < 0.25:
        return float(whole)
    if frac < 0.75:
        return whole + 0.5
    return float(whole + 1)


def overall_band(bands: Sequence[float]) -> float:
    """Mean of the criterion bands, rounded the official IELTS way."""
    if not bands:
        raise ValueError("overall_band needs at least one criterion band")
    return ielts_round(sum(bands) / len(bands))


def snap_band(value: float) -> float:
    """Clamp to the 0-9 scale, then round to the nearest 0.5 (ties go up)."""
    clamped = min(max(value, BAND_MIN), BAND_MAX)
    return math.floor(clamped * 2 + 0.5) / 2


_FENCED_BLOCK = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)


def extract_json_object(text: str) -> dict:
    """The first JSON object found in a model reply, tolerating a ```json fence and
    prose before/after it. Raises GradingParseError if there is none."""
    if not isinstance(text, str) or not text.strip():
        raise GradingParseError("the model's reply is empty")

    decoder = json.JSONDecoder()
    for candidate in [text, *_FENCED_BLOCK.findall(text)]:
        candidate = candidate.strip()
        try:
            whole = json.loads(candidate)
        except json.JSONDecodeError:
            whole = None
        if isinstance(whole, dict):
            return whole
        # Not pure JSON: try to decode an object starting at each "{" (prose around it).
        for match in re.finditer(r"\{", candidate):
            try:
                obj, _ = decoder.raw_decode(candidate[match.start():])
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict):
                return obj
    raise GradingParseError("no JSON object found in the model's reply")


def _norm(name: str) -> str:
    """Case/punctuation/space-insensitive form, so "lexicalResource", "Lexical Resource"
    and "lexical_resource" all match."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _squash(text: str) -> str:
    return " ".join(text.split()).casefold()


def _occurs_in(snippet: str, source: str) -> bool:
    # Models often wrap a quote in quotation marks or ellipses; those are not part of
    # the student's text, so they are trimmed before looking the quote up.
    trimmed = snippet.strip(" \t\r\n\"'“”‘’.…")
    return bool(trimmed) and _squash(trimmed) in _squash(source)


def _to_number(value: object, where: str) -> float:
    # bool is an int subclass in Python: `true` must not slip through as band 1.
    if isinstance(value, bool):
        raise GradingParseError(f"{where}: 'band' must be a number, got a boolean")
    if isinstance(value, (int, float)):
        number = float(value)
    elif isinstance(value, str):
        try:
            number = float(value.strip())
        except ValueError:
            raise GradingParseError(f"{where}: 'band' must be a number, got {value!r}") from None
    else:
        raise GradingParseError(f"{where}: 'band' must be a number, got {type(value).__name__}")
    if math.isnan(number) or math.isinf(number):
        raise GradingParseError(f"{where}: 'band' must be a finite number")
    return number


def _string_list(value: object, limit: int | None = MAX_SUMMARY_ITEMS) -> list[str]:
    if not isinstance(value, list):
        return []
    items = [v.strip() for v in value if isinstance(v, str) and v.strip()]
    return items if limit is None else items[:limit]


def _index_criteria(raw: object) -> dict[str, dict]:
    """Normalised name -> criterion object. Accepts a list of {"key": ...} objects or an
    object keyed by criterion name: models vary in container shape, and rejecting a
    perfectly good answer over that wastes a multi-minute GPU run (the lesson of
    extract_json_array in the Kaggle work)."""
    if raw is None:
        raise GradingParseError("the reply has no 'criteria' field")
    indexed: dict[str, dict] = {}
    if isinstance(raw, dict):
        for name, entry in raw.items():
            if isinstance(entry, dict):
                indexed[_norm(str(name))] = entry
    elif isinstance(raw, list):
        for entry in raw:
            if isinstance(entry, dict) and isinstance(entry.get("key"), str):
                indexed[_norm(entry["key"])] = entry
    else:
        raise GradingParseError("'criteria' must be a list or an object")
    return indexed


def _build_criterion(key: str, label: str, item: dict, source_text: str | None, warnings: list[str]) -> dict:
    raw_band = _to_number(item.get("band"), key)
    band = snap_band(raw_band)
    if band != raw_band:
        warnings.append(f"{key}: band {raw_band:g} adjusted to {band:g} (valid bands are 0-9 in steps of 0.5)")

    comment = item.get("comment")
    if not isinstance(comment, str) or not comment.strip():
        raise GradingParseError(f"{key}: 'comment' must be a non-empty string")

    evidence = _string_list(item.get("evidence"), limit=None)
    if source_text is not None:
        verified = [quote for quote in evidence if _occurs_in(quote, source_text)]
        if len(verified) != len(evidence):
            warnings.append(f"{key}: {len(evidence) - len(verified)} quoted snippet(s) not found in the text were dropped")
        evidence = verified

    return {"key": key, "label": label, "band": band, "comment": comment.strip(), "evidence": evidence[:MAX_SUMMARY_ITEMS]}


def parse_grading_response(raw: str, skill: Skill, source_text: str | None = None) -> dict:
    """Turn the model's raw reply into the API's grading result (13.4), or raise
    GradingParseError.

    `source_text` is the essay / transcript that was graded; when given, quoted
    `evidence` that does not occur in it is dropped. Criteria come back in the canonical
    order for the skill whatever order the model used. Returned dict:
      { criteria: [{key, label, band, comment, evidence}] x4, overallBand,
        strengths, improvements, warnings }
    """
    if skill not in CRITERIA:
        raise ValueError(f"unknown skill: {skill!r} (expected one of {sorted(CRITERIA)})")

    data = extract_json_object(raw)
    indexed = _index_criteria(data.get("criteria"))

    found: list[tuple[str, str, dict]] = []
    missing: list[str] = []
    for key, label in CRITERIA[skill]:
        item = indexed.get(_norm(key)) or indexed.get(_norm(label))
        if item is None:
            missing.append(key)
        else:
            found.append((key, label, item))
    if missing:
        raise GradingParseError("missing criteria: " + ", ".join(missing))

    warnings: list[str] = []
    criteria = [_build_criterion(key, label, item, source_text, warnings) for key, label, item in found]
    return {
        "criteria": criteria,
        "overallBand": overall_band([c["band"] for c in criteria]),
        "strengths": _string_list(data.get("strengths")),
        "improvements": _string_list(data.get("improvements")),
        "warnings": warnings,
    }
