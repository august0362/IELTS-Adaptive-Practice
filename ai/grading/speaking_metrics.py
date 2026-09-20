"""
Objective delivery measurements for a Speaking answer, computed from word-level
timestamps (what faster-whisper's `word_timestamps=True` yields). Kept free of any
Whisper import on purpose: `WordTiming` is a plain record, so this is unit-testable
with fabricated timings and works with whatever STT produced them.

The grader LLM is given these numbers as facts instead of being asked to judge
pace or hesitation from raw text (it cannot hear the audio, and a 4B model
counts unreliably). They are honest but partial signals, and the limits matter:

  - Whisper tends to DROP disfluencies ("um", "uh") from its transcript, so
    `fillerCount` is a lower bound, not a true count.
  - Whisper tends to "auto-correct" a mispronounced word into the intended one, so
    `lowConfidenceWordRatio` (share of words the model was unsure about) is at best
    a weak hint at unclear speech — it does NOT measure pronunciation.
  - `wordsPerMinute` is words over the whole span from first word to last word,
    pauses included: an overall pace, not an articulation rate.

Assumes `words` are in chronological order, as Whisper produces them.
"""
import re
from dataclasses import dataclass
from typing import Iterable

# A silence between two consecutive words at least this long counts as a pause.
# Starting values, to be re-tuned against real recordings (AI_CHATBOT_PLAN.md 13.7, C4).
PAUSE_THRESHOLD_SEC = 0.5
# A word the STT model gave a probability below this counts as "low confidence".
LOW_CONFIDENCE_THRESHOLD = 0.5
# Only unambiguous hesitation sounds. "like" / "you know" are deliberately NOT here:
# they are ordinary words too, and counting them would mislabel fluent speech.
FILLER_WORDS = frozenset({"um", "umm", "uh", "uhh", "er", "err", "erm", "ah", "hmm"})

_EDGE_PUNCTUATION = re.compile(r"^\W+|\W+$")


@dataclass(frozen=True)
class WordTiming:
    word: str
    start: float  # seconds from the start of the audio
    end: float
    probability: float | None = None  # STT confidence in this word, if the STT reports one


def _normalize(word: str) -> str:
    """Lower-cased with edge punctuation/whitespace removed — Whisper words arrive
    as " Hello," with a leading space and trailing comma."""
    return _EDGE_PUNCTUATION.sub("", word.strip()).casefold()


def compute_speaking_metrics(
    words: Iterable[WordTiming],
    *,
    pause_threshold: float = PAUSE_THRESHOLD_SEC,
    low_confidence_threshold: float = LOW_CONFIDENCE_THRESHOLD,
) -> dict:
    # Punctuation-only "words" carry no speech, so they are ignored entirely.
    spoken = [w for w in words if _normalize(w.word)]
    if not spoken:
        return {
            "wordCount": 0,
            "durationSec": 0.0,
            "wordsPerMinute": None,
            "pauseCount": 0,
            "longestPauseSec": 0.0,
            "totalPauseSec": 0.0,
            "fillerCount": 0,
            "lowConfidenceWordRatio": None,
        }

    duration = max(0.0, spoken[-1].end - spoken[0].start)
    pauses = [
        gap
        for previous, following in zip(spoken, spoken[1:])
        if (gap := following.start - previous.end) >= pause_threshold
    ]
    with_probability = [w for w in spoken if w.probability is not None]

    return {
        "wordCount": len(spoken),
        "durationSec": round(duration, 2),
        "wordsPerMinute": round(len(spoken) / duration * 60, 1) if duration > 0 else None,
        "pauseCount": len(pauses),
        "longestPauseSec": round(max(pauses, default=0.0), 2),
        "totalPauseSec": round(sum(pauses), 2),
        "fillerCount": sum(1 for w in spoken if _normalize(w.word) in FILLER_WORDS),
        "lowConfidenceWordRatio": (
            round(sum(1 for w in with_probability if w.probability < low_confidence_threshold) / len(with_probability), 3)
            if with_probability
            else None
        ),
    }
