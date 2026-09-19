"""
Milestone 7 step 6 (AI_CHATBOT_PLAN.md section 12.3): pure, offline-testable
helpers for the LoRA fine-tuning step.

TRL's SFTTrainer consumes the "conversational" dataset format directly (a
"messages" column, or a "prompt"/"completion" pair) and applies the model's
own chat template internally, so there is no hand-rolled prompt-formatting
function here — only loading, shape validation, and the one small reshape
`to_prompt_completion` needs (see below).

REAL FINDING from an actual Kaggle run (2026-09-19): originally this used
the "messages" format with `assistant_only_loss=True` (loss only on the
assistant's tokens — Qwen3.5 is an explicitly TRL-supported family for the
chat-template patching that needs). That raised `ValueError: Assistant-only
loss is not yet supported for vision-language models` — Unsloth loads
Qwen3.5-4B's `processing_class` as a `ProcessorMixin` (a multimodal
processor), which TRL's SFTTrainer treats as "this is a VLM" regardless of
whether any image is ever used, and assistant-only loss is blocked for that
case. Switched to the "prompt-completion" dataset shape instead
(`to_prompt_completion` below) + `completion_only_loss=True`, which TRL does
NOT block for VLM-classified processors and in fact defaults to "on" for
this shape — same effect (loss only on the answer), different mechanism.

SECOND real finding, same run, one step later: with `content` still a plain
string, tokenization itself crashed — `TypeError: string indices must be
integers, not 'str'` inside `processing_class.apply_chat_template()`. That
processor (Qwen3.5-4B's, per the finding above, a `ProcessorMixin`) expects
every message's `content` to be a *list of content blocks*
(`[{"type": "text", "text": "..."}]`), the standard format for any
vision-capable model's processor (confirmed against Qwen-VL's own message
format docs) — not a bare string. Iterating a bare string yields characters,
and indexing a character with `["type"]` is exactly that TypeError.
`to_prompt_completion` now wraps every message's content this way.

Kept separate from the notebook and pytest-covered so this logic isn't
hand-typed straight into Kaggle — that exact anti-pattern caused 2 of the 3
real Kaggle bugs earlier in Milestone 7 (see kaggle_generation.py's
docstring).

Run tests from ai/:  python -m pytest training/tests/test_lora_training_data.py
"""
import json
import random
from pathlib import Path

REQUIRED_ROLES = ("system", "user", "assistant")


def validate_example(example: dict) -> None:
    """Raises ValueError unless `example` is exactly the shape our own data
    pipeline (Step 1 template + Step 2 Kaggle generation, combined by
    build_final_dataset.py) always produces: a "messages" list of exactly
    [system, user, assistant], each with non-empty string content. This is
    stricter than what SFTTrainer itself requires (it tolerates multi-turn
    conversations) — but for us, drift from this shape is a bug, not a
    valid variant, and is far cheaper to catch here than after spending
    Kaggle GPU time on it."""
    if not isinstance(example, dict) or "messages" not in example:
        raise ValueError("missing 'messages' key")
    messages = example["messages"]
    if not isinstance(messages, list) or len(messages) != 3:
        raise ValueError(f"expected exactly 3 messages, got {messages!r}")
    roles = tuple(m.get("role") if isinstance(m, dict) else None for m in messages)
    if roles != REQUIRED_ROLES:
        raise ValueError(f"expected roles {REQUIRED_ROLES}, got {roles!r}")
    for message in messages:
        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            raise ValueError(f"message role={message.get('role')!r} has empty/non-string content")


def load_training_examples(path: Path) -> list[dict]:
    """Reads a .jsonl file of {"messages": [...]} training examples and
    validates every one before returning — fails fast, before any GPU time
    is spent, with the offending line number in the error message."""
    examples = []
    text = Path(path).read_text(encoding="utf-8")
    for line_number, line in enumerate(text.splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        try:
            example = json.loads(line)
        except json.JSONDecodeError as e:
            raise ValueError(f"{path}:{line_number}: invalid JSON ({e})") from e
        try:
            validate_example(example)
        except ValueError as e:
            raise ValueError(f"{path}:{line_number}: {e}") from e
        examples.append(example)
    return examples


def _as_content_blocks(message: dict) -> dict:
    """{"role": r, "content": "text"} -> {"role": r, "content": [{"type": "text", "text": "text"}]}
    — the content-block list format Qwen3.5-4B's (multimodal-capable)
    processor requires even for plain text (see module docstring)."""
    return {"role": message["role"], "content": [{"type": "text", "text": message["content"]}]}


def to_prompt_completion(example: dict) -> dict:
    """Reshapes a validated {"messages": [system, user, assistant]} example
    into TRL's "conversational prompt-completion" shape:
    {"prompt": [system, user], "completion": [assistant]}, with each
    message's content wrapped as a content-block list. No text content is
    added/removed/changed — needed because SFTConfig's `completion_only_loss`
    (unlike `assistant_only_loss`) isn't blocked when TRL classifies the
    processing_class as a VLM, and because that same processor's
    apply_chat_template requires content-block-shaped messages (both per
    module docstring)."""
    system, user, assistant = example["messages"]
    return {
        "prompt": [_as_content_blocks(system), _as_content_blocks(user)],
        "completion": [_as_content_blocks(assistant)],
    }


def split_train_eval(examples: list[dict], eval_fraction: float, seed: int) -> tuple[list[dict], list[dict]]:
    """Deterministic random split. Held out purely so the notebook can
    eyeball generation quality on examples the model wasn't trained on —
    58 examples total is too small for an eval-loss number to mean much on
    its own, so this is a qualitative check, not a rigorous test set."""
    shuffled = list(examples)
    random.Random(seed).shuffle(shuffled)
    if not shuffled:
        return [], []
    n_eval = max(1, round(len(shuffled) * eval_fraction))
    return shuffled[n_eval:], shuffled[:n_eval]
