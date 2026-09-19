"""
Milestone 7 step 6 (AI_CHATBOT_PLAN.md section 12.3): pure, offline-testable
helpers for the LoRA fine-tuning step.

TRL's SFTTrainer consumes the "conversational" dataset format directly (a
"messages" column) and applies the model's own chat template internally, so
there is no hand-rolled prompt-formatting function here — only loading and
shape validation, which is the part a typo or upstream schema drift could
actually break silently.

HISTORY (2026-09-19, all from real Kaggle runs — not hypothetical): this
module briefly grew a `to_prompt_completion`/`_as_content_blocks` reshape to
work around 2 issues caused by loading the model through Unsloth's
`FastLanguageModel.from_pretrained` (it returns a `ProcessorMixin`, which (1)
made TRL classify the model as a "vision-language model" and refuse
`assistant_only_loss`, and (2) requires message content as
`[{"type": "text", "text": ...}]` blocks instead of a plain string). A 3rd,
deeper Unsloth-specific bug then surfaced — training crashed with
`RuntimeError: ... BFloat16 != Half` inside Unsloth's own recompiled
`Qwen3_5GatedDeltaNet` layer (Qwen3.5's new hybrid linear-attention layer
type) on a T4, a confirmed *upstream, currently unresolved* Unsloth bug
(github.com/unslothai/unsloth issue #4970 — its proposed fix,
unsloth-zoo PR #978, was still unmerged when hit). Rather than keep working
around Unsloth-specific issues for a brand-new model architecture, the
notebook (build_lora_training_notebook.py) dropped Unsloth entirely for this
step and loads the model via plain `transformers` + `peft` + `trl` instead —
which uses a real `PreTrainedTokenizerBase` (not a `ProcessorMixin`), so
neither workaround above is needed any more, and doesn't hit Unsloth's own
compiled Qwen3.5 kernels at all. `to_prompt_completion`/`_as_content_blocks`
were removed accordingly — see git history if they're ever needed again.

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
