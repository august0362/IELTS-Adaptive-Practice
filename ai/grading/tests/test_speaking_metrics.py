from grading.speaking_metrics import WordTiming, compute_speaking_metrics


def w(word, start, end, probability=None):
    return WordTiming(word=word, start=start, end=end, probability=probability)


def test_no_words_gives_zeroed_metrics_and_unknown_rates():
    metrics = compute_speaking_metrics([])
    assert metrics == {
        "wordCount": 0,
        "durationSec": 0.0,
        "wordsPerMinute": None,
        "pauseCount": 0,
        "longestPauseSec": 0.0,
        "totalPauseSec": 0.0,
        "fillerCount": 0,
        "lowConfidenceWordRatio": None,
    }


def test_words_per_minute_uses_the_span_from_first_word_to_last_word():
    # 2 words over 1.0s = 120 wpm
    metrics = compute_speaking_metrics([w("Hello", 0.0, 0.5), w("world", 0.5, 1.0)])
    assert metrics["wordCount"] == 2
    assert metrics["durationSec"] == 1.0
    assert metrics["wordsPerMinute"] == 120.0


def test_punctuation_only_tokens_are_ignored_entirely():
    metrics = compute_speaking_metrics([w("Hello", 0.0, 0.5), w(",", 0.5, 0.5), w(" world.", 0.5, 1.0)])
    assert metrics["wordCount"] == 2


def test_a_single_instant_word_has_no_computable_rate():
    metrics = compute_speaking_metrics([w("Yes", 2.0, 2.0)])
    assert metrics["wordCount"] == 1
    assert metrics["durationSec"] == 0.0
    assert metrics["wordsPerMinute"] is None


def test_a_gap_exactly_at_the_threshold_counts_as_a_pause_and_a_shorter_one_does_not():
    at_threshold = compute_speaking_metrics([w("a", 0.0, 1.0), w("b", 1.5, 2.0)])
    assert at_threshold["pauseCount"] == 1

    just_short = compute_speaking_metrics([w("a", 0.0, 1.0), w("b", 1.25, 2.0)])
    assert just_short["pauseCount"] == 0
    assert just_short["longestPauseSec"] == 0.0


def test_pause_totals_and_longest():
    words = [
        w("one", 0.0, 1.0),
        w("two", 1.5, 2.0),   # pause 0.5
        w("three", 3.0, 3.5),  # pause 1.0
        w("four", 3.75, 4.0),  # 0.25 -> not a pause
    ]
    metrics = compute_speaking_metrics(words)
    assert metrics["pauseCount"] == 2
    assert metrics["longestPauseSec"] == 1.0
    assert metrics["totalPauseSec"] == 1.5


def test_custom_pause_threshold():
    words = [w("a", 0.0, 1.0), w("b", 1.25, 2.0)]
    assert compute_speaking_metrics(words, pause_threshold=0.25)["pauseCount"] == 1


def test_fillers_are_matched_case_and_punctuation_insensitively_but_not_inside_other_words():
    words = [w(" Um,", 0.0, 0.5), w(" uh", 0.5, 1.0), w(" Well", 1.0, 1.5), w(" ERM.", 1.5, 2.0), w(" umbrella", 2.0, 2.5)]
    assert compute_speaking_metrics(words)["fillerCount"] == 3


def test_ordinary_discourse_words_are_not_counted_as_fillers():
    words = [w("like", 0.0, 0.5), w("you", 0.5, 0.75), w("know", 0.75, 1.0)]
    assert compute_speaking_metrics(words)["fillerCount"] == 0


def test_low_confidence_ratio_counts_only_words_strictly_below_the_threshold():
    words = [w("a", 0.0, 0.25, 0.9), w("b", 0.25, 0.5, 0.4), w("c", 0.5, 0.75, 0.5), w("d", 0.75, 1.0, 0.1)]
    assert compute_speaking_metrics(words)["lowConfidenceWordRatio"] == 0.5


def test_words_without_a_probability_are_left_out_of_the_ratio():
    words = [w("a", 0.0, 0.25, 0.1), w("b", 0.25, 0.5), w("c", 0.5, 0.75)]
    assert compute_speaking_metrics(words)["lowConfidenceWordRatio"] == 1.0


def test_ratio_is_unknown_when_the_stt_reports_no_probabilities():
    words = [w("a", 0.0, 0.5), w("b", 0.5, 1.0)]
    assert compute_speaking_metrics(words)["lowConfidenceWordRatio"] is None
