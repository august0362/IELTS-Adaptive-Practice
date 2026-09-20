"""
Objective, countable facts about a written answer. The LLM is never asked to
count anything (a 4B model counts unreliably); what is computed here is passed
to it as a fact and returned to the caller as-is.
"""

# Public IELTS Writing minimums. Falling short is not an error by itself — it is
# reported (`meetsMinWords`) so the caller and the grader can treat the task
# response criterion accordingly.
MIN_WORDS: dict[str, int] = {"task1": 150, "task2": 250}


def count_words(text: str) -> int:
    """Whitespace-separated tokens that contain at least one letter or digit.

    IELTS counts a hyphenated word ("well-known") or a contraction ("don't") as
    one word and a stray dash or bullet as none — which is exactly what splitting
    on whitespace and skipping punctuation-only tokens gives.
    """
    return sum(1 for token in text.split() if any(ch.isalnum() for ch in token))


def meets_min_words(task_type: str, word_count: int) -> bool:
    if task_type not in MIN_WORDS:
        raise ValueError(f"unknown task type: {task_type!r} (expected one of {sorted(MIN_WORDS)})")
    return word_count >= MIN_WORDS[task_type]
