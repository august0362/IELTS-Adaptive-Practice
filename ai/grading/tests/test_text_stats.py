import pytest

from grading.text_stats import MIN_WORDS, count_words, meets_min_words


def test_counts_plain_words():
    assert count_words("The quick brown fox") == 4


def test_empty_and_whitespace_only_text_has_no_words():
    assert count_words("") == 0
    assert count_words("   \n\t  ") == 0


def test_hyphenated_words_and_contractions_count_as_one_word_each():
    assert count_words("a well-known problem, don't ignore it") == 6


def test_numbers_and_percentages_count_as_words():
    assert count_words("In 2020 about 5% of them left") == 7


def test_stray_punctuation_tokens_are_not_words():
    assert count_words("first — second - third ... fourth") == 4


def test_any_whitespace_including_newlines_separates_words():
    assert count_words("one\ntwo\n\nthree   four\tfive") == 5


def test_non_english_letters_count():
    assert count_words("un café très bon") == 4


@pytest.mark.parametrize("task, count, expected", [
    ("task1", 149, False),
    ("task1", 150, True),
    ("task2", 249, False),
    ("task2", 250, True),
    ("task2", 400, True),
])
def test_meets_min_words_boundaries(task, count, expected):
    assert meets_min_words(task, count) is expected


def test_unknown_task_type_is_rejected_rather_than_silently_passing():
    with pytest.raises(ValueError, match="unknown task type"):
        meets_min_words("task3", 500)


def test_minimums_are_the_public_ielts_values():
    assert MIN_WORDS == {"task1": 150, "task2": 250}
