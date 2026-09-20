import json

import pytest

from grading.schema import (
    CRITERIA,
    GradingParseError,
    extract_json_object,
    ielts_round,
    overall_band,
    parse_grading_response,
    snap_band,
)

WRITING_KEYS = [key for key, _ in CRITERIA["writing"]]
SPEAKING_KEYS = [key for key, _ in CRITERIA["speaking"]]


def criterion(key, band=6.5, comment="Reasonable.", evidence=None):
    item = {"key": key, "band": band, "comment": comment}
    if evidence is not None:
        item["evidence"] = evidence
    return item


def reply(keys, bands=None, **extra):
    bands = bands or [6.5] * len(keys)
    return json.dumps({"criteria": [criterion(k, b) for k, b in zip(keys, bands)], **extra})


# --- ielts_round: mirrors web/src/tests/unit/ieltsRounding.test.ts case for case ---

@pytest.mark.parametrize("mean, expected", [
    (6.0, 6.0),
    (6.5, 6.5),
    (6.25, 6.5),
    (6.75, 7.0),
    (6.1, 6.0),
    (6.6, 6.5),
    (6.249999999999, 6.5),   # float noise near a boundary must not flip the bucket
    (6.750000000001, 7.0),
    (9.25, 9.5),             # like the original, no clamping: that is the caller's job
    (9.75, 10.0),
])
def test_ielts_round_matches_the_apps_own_rounding(mean, expected):
    assert ielts_round(mean) == expected


# --- snap_band ---

@pytest.mark.parametrize("value, expected", [
    (6.0, 6.0),
    (6.2, 6.0),
    (6.25, 6.5),   # ties go up
    (6.3, 6.5),
    (6.74, 6.5),
    (6.75, 7.0),
    (-1, 0.0),
    (10, 9.0),
    (9.4, 9.0),
])
def test_snap_band_clamps_to_0_9_and_rounds_to_half_bands(value, expected):
    assert snap_band(value) == expected


# --- overall_band ---

@pytest.mark.parametrize("bands, expected", [
    ([6, 6, 6.5, 6.5], 6.5),   # mean 6.25
    ([6, 6, 6, 6.5], 6.0),     # mean 6.125
    ([7, 7, 7, 7.5], 7.0),     # mean 7.125
    ([6.5, 6.5, 7, 7], 7.0),   # mean 6.75
    ([9, 9, 9, 9], 9.0),
])
def test_overall_band_is_the_ielts_rounded_mean(bands, expected):
    assert overall_band(bands) == expected


def test_overall_band_of_nothing_is_an_error_not_a_zero():
    with pytest.raises(ValueError):
        overall_band([])


# --- extract_json_object ---

def test_extracts_plain_json():
    assert extract_json_object('{"a": 1}') == {"a": 1}


def test_extracts_json_from_a_code_fence_with_prose_around_it():
    text = 'Here is the grading:\n```json\n{"a": 1}\n```\nHope that helps!'
    assert extract_json_object(text) == {"a": 1}


def test_extracts_an_object_embedded_in_prose():
    assert extract_json_object('Sure! {"a": {"b": 2}} Done.') == {"a": {"b": 2}}


def test_skips_stray_braces_that_are_not_json():
    assert extract_json_object('note {not json} then {"a": 1}') == {"a": 1}


@pytest.mark.parametrize("bad", ["", "   ", "no json here", "[1, 2]", None])
def test_no_json_object_is_a_parse_error(bad):
    with pytest.raises(GradingParseError):
        extract_json_object(bad)


# --- parse_grading_response: structure ---

def test_parses_a_valid_writing_reply_and_returns_criteria_in_canonical_order():
    bands = {"taskResponse": 6, "coherenceCohesion": 7, "lexicalResource": 6.5, "grammaticalRange": 6}
    shuffled = list(reversed(WRITING_KEYS))
    raw = json.dumps({"criteria": [criterion(k, bands[k]) for k in shuffled]})

    result = parse_grading_response(raw, "writing")

    assert [c["key"] for c in result["criteria"]] == WRITING_KEYS
    assert [c["band"] for c in result["criteria"]] == [6.0, 7.0, 6.5, 6.0]
    assert [c["label"] for c in result["criteria"]] == [label for _, label in CRITERIA["writing"]]
    assert result["overallBand"] == 6.5   # mean 6.375
    assert result["warnings"] == []


def test_accepts_criteria_as_an_object_keyed_by_name():
    raw = json.dumps({"criteria": {k: {"band": 7, "comment": "Good."} for k in WRITING_KEYS}})
    result = parse_grading_response(raw, "writing")
    assert [c["band"] for c in result["criteria"]] == [7.0] * 4


def test_matches_criteria_by_public_label_or_loosely_written_key():
    raw = json.dumps({"criteria": [
        criterion("Task Achievement / Task Response", 6),
        criterion("coherence_cohesion", 6),
        criterion("Lexical Resource", 6),
        criterion("GRAMMATICAL RANGE & ACCURACY", 6),
    ]})
    result = parse_grading_response(raw, "writing")
    assert [c["key"] for c in result["criteria"]] == WRITING_KEYS


def test_speaking_has_its_own_four_criteria():
    result = parse_grading_response(reply(SPEAKING_KEYS), "speaking")
    assert [c["key"] for c in result["criteria"]] == SPEAKING_KEYS


def test_writing_criteria_do_not_satisfy_a_speaking_grade():
    with pytest.raises(GradingParseError, match="missing criteria: fluencyCoherence"):
        parse_grading_response(reply(WRITING_KEYS), "speaking")


def test_a_missing_criterion_is_an_error_that_names_it():
    with pytest.raises(GradingParseError, match="missing criteria: grammaticalRange"):
        parse_grading_response(reply(WRITING_KEYS[:3]), "writing")


def test_missing_criteria_field_is_an_error():
    with pytest.raises(GradingParseError, match="no 'criteria' field"):
        parse_grading_response('{"strengths": ["x"]}', "writing")


def test_criteria_of_the_wrong_type_is_an_error():
    with pytest.raises(GradingParseError, match="list or an object"):
        parse_grading_response('{"criteria": 5}', "writing")


def test_reply_wrapped_in_a_fence_and_prose_still_parses():
    raw = "Result:\n```json\n" + reply(WRITING_KEYS) + "\n```"
    assert len(parse_grading_response(raw, "writing")["criteria"]) == 4


def test_unknown_skill_is_a_programming_error():
    with pytest.raises(ValueError, match="unknown skill"):
        parse_grading_response(reply(WRITING_KEYS), "reading")


# --- parse_grading_response: bands ---

def test_a_numeric_string_band_is_accepted():
    result = parse_grading_response(reply(WRITING_KEYS, ["6.5", 6, 6, 6]), "writing")
    assert result["criteria"][0]["band"] == 6.5


@pytest.mark.parametrize("bad_band", [True, "abc", None, [7], float("nan"), float("inf")])
def test_a_band_that_is_not_a_finite_number_is_an_error(bad_band):
    with pytest.raises(GradingParseError, match="taskResponse"):
        parse_grading_response(reply(WRITING_KEYS, [bad_band, 6, 6, 6]), "writing")


def test_out_of_range_and_off_grid_bands_are_snapped_and_reported():
    result = parse_grading_response(reply(WRITING_KEYS, [11, 6.3, 6.5, 6]), "writing")

    assert [c["band"] for c in result["criteria"]] == [9.0, 6.5, 6.5, 6.0]
    assert len(result["warnings"]) == 2
    assert "taskResponse" in result["warnings"][0] and "adjusted to 9" in result["warnings"][0]
    assert "coherenceCohesion" in result["warnings"][1]


def test_the_models_own_overall_band_is_ignored():
    result = parse_grading_response(reply(WRITING_KEYS, [6, 6, 6, 6], overallBand=9.0), "writing")
    assert result["overallBand"] == 6.0


# --- parse_grading_response: comments, evidence, lists ---

@pytest.mark.parametrize("bad_comment", ["", "   ", None, 5, ["text"]])
def test_a_criterion_without_a_real_comment_is_an_error(bad_comment):
    items = [criterion(k) for k in WRITING_KEYS]
    items[2]["comment"] = bad_comment
    with pytest.raises(GradingParseError, match="lexicalResource"):
        parse_grading_response(json.dumps({"criteria": items}), "writing")


def test_comments_are_stripped():
    items = [criterion(k, comment="  Fine.  ") for k in WRITING_KEYS]
    result = parse_grading_response(json.dumps({"criteria": items}), "writing")
    assert result["criteria"][0]["comment"] == "Fine."


def test_evidence_the_model_invented_is_dropped_and_reported():
    essay = "Some people   think that\nTechnology is harmful. However, I disagree."
    items = [criterion(k) for k in WRITING_KEYS]
    items[0]["evidence"] = [
        "some people think that technology",   # whitespace/case differences are fine
        '"However, I disagree."',              # wrapping quotes and final stop are not part of the text
        "...I disagree...",                    # nor are ellipses
        "This sentence is nowhere in the essay.",
    ]

    result = parse_grading_response(json.dumps({"criteria": items}), "writing", source_text=essay)

    assert result["criteria"][0]["evidence"] == [
        "some people think that technology",
        '"However, I disagree."',
        "...I disagree...",
    ]
    assert result["warnings"] == ["taskResponse: 1 quoted snippet(s) not found in the text were dropped"]


def test_evidence_that_is_only_quotes_or_dots_never_counts_as_found():
    items = [criterion(k) for k in WRITING_KEYS]
    items[0]["evidence"] = ['""', "...", "  "]
    result = parse_grading_response(json.dumps({"criteria": items}), "writing", source_text="anything at all")
    assert result["criteria"][0]["evidence"] == []


def test_without_source_text_evidence_is_kept_but_capped_at_three():
    items = [criterion(k) for k in WRITING_KEYS]
    items[0]["evidence"] = ["a", "b", "c", "d", "e"]
    result = parse_grading_response(json.dumps({"criteria": items}), "writing")
    assert result["criteria"][0]["evidence"] == ["a", "b", "c"]


def test_evidence_that_is_not_a_list_of_strings_becomes_empty_or_filtered():
    items = [criterion(k) for k in WRITING_KEYS]
    items[0]["evidence"] = "just a string"
    items[1]["evidence"] = ["ok", 5, None, "  "]
    result = parse_grading_response(json.dumps({"criteria": items}), "writing")
    assert result["criteria"][0]["evidence"] == []
    assert result["criteria"][1]["evidence"] == ["ok"]


def test_strengths_and_improvements_are_optional_capped_and_string_only():
    raw = json.dumps({
        "criteria": [criterion(k) for k in WRITING_KEYS],
        "strengths": ["one", "two", 3, "three", "four"],
        "improvements": "not a list",
    })
    result = parse_grading_response(raw, "writing")
    assert result["strengths"] == ["one", "two", "three"]
    assert result["improvements"] == []
