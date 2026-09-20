"""
Assembles ai/kaggle/train_lora_kaggle.ipynb — Milestone 7 step 6
(AI_CHATBOT_PLAN.md section 12.3): fine-tunes a LoRA adapter on top of
Qwen/Qwen3.5-4B using the user-approved training examples
(data/processed/train_final.jsonl, approved in full by the user via
review_sample.md — "Đồng ý hết").

FOLLOW-UP ROUND (2026-09-20): the first fine-tune (58 examples) evaluated
badly on one specific, serious axis — asked a question about a feature
that doesn't exist, it confidently invented an answer instead of saying
"không chắc" (the base model got this right). Root cause: all 58 examples
were real-question-with-real-answer pairs; none taught the "honest refusal"
behavior at all. Fixed by generating 23 more examples of exactly that kind
(same non-Claude generation mechanism, see kaggle_negative_generation.py)
and merging them in (merge_negative_dataset.py) — train_final.jsonl is now
81 examples. Every count/measurement below that says "58" is what was true
for the *first* fine-tune; re-measured for this run where it matters
(token-length distribution, truncation impact) — see the max_length
discussion further down.

Uses plain transformers + PEFT + TRL's SFTTrainer — not a hand-rolled
training loop, for the same reason kaggle_generation.py replaced
hand-typed generation logic: standard, maintained libraries catch
shape/API mistakes with real errors instead of silent wrong behavior.

DROPPED UNSLOTH (2026-09-19), after 3 real, consecutive Kaggle runs each
hit a genuine bug specifically caused by Unsloth's handling of this brand
new model (Qwen3.5-4B, first supported the same month this was written):
  1. `FastLanguageModel.from_pretrained` returns a `ProcessorMixin` (not a
     plain tokenizer) for this model — TRL then classified it as a
     "vision-language model" and refused `assistant_only_loss=True`.
  2. That same Processor's `apply_chat_template` requires every message's
     `content` to be a list of content blocks (`[{"type":"text",...}]`),
     not a plain string — crashed with `TypeError: string indices must be
     integers, not 'str'` when given our normal string content.
  3. Worked around both of the above, then hit a 3rd, deeper bug: training
     crashed with `RuntimeError: ... BFloat16 != Half` inside Unsloth's own
     recompiled `Qwen3_5GatedDeltaNet` layer (Qwen3.5's new hybrid
     linear-attention layer type) — a confirmed, currently-UNRESOLVED
     upstream Unsloth bug (github.com/unslothai/unsloth issue #4970). Its
     proposed fix (`UNSLOTH_FORCE_FLOAT32=1`, unsloth-zoo PR #978) was
     applied but had NO effect because that PR was still open/unmerged —
     not yet in any released Unsloth version, contrary to what was assumed
     when first citing it (a real mistake: an open PR proposing a fix is
     not the same as a shipped fix — should have checked merge status
     before relying on it).

Given a still-open upstream bug with no released fix, plain
transformers.AutoModelForCausalLM + peft.LoraConfig + TRL's SFTTrainer is
used instead — it doesn't go through Unsloth's custom compiled Qwen3.5
kernels at all, so bug 3 doesn't apply, and its tokenizer is a real
PreTrainedTokenizerBase (not a Processor), so bugs 1 and 2 don't apply
either. This also means the "messages" format + `assistant_only_loss=True`
from the original design (before Unsloth-specific workarounds) is usable
again as-is. Trade-off: no Unsloth memory/speed optimizations — training
will be somewhat slower and use somewhat more VRAM than Unsloth's ~10GB
claim.

That predicted OOM risk turned out real: after also fixing 2 unrelated
environment issues (Kaggle's preinstalled `torchao` too old for the
upgraded `peft`; `transformers.Trainer` auto-wrapping the model in
`torch.nn.DataParallel` across Kaggle's 2 visible T4s despite `device_map`
pinning it to one — fixed with `CUDA_VISIBLE_DEVICES="0"`), training
itself started but hit `OutOfMemoryError` a few steps in (~14GB used of
14.56GB). Root cause: the 4B model's own weights alone are ~8GB in native
bf16, leaving too little headroom once any longer example's activations
are added. Fixed with the standard, community-endorsed "8-bit LoRA" recipe
(`BitsAndBytesConfig(load_in_8bit=True)` + `prepare_model_for_kbit_training`
— NOT 4-bit/QLoRA, which is the specific thing avoided for Qwen3.5 per
AI_CHATBOT_PLAN.md §5) to roughly halve the base weight footprint, plus
lowering `max_length` from 6144 to 2048 as a second safety margin (only
costs the tail of the single 4656-token outlier answer — every other
approved example is well under 2048).

Also confirmed before writing this notebook:
  - TRL v1.13.0 SFTTrainer/SFTConfig/SFTConfig.assistant_only_loss API
    (docs.trl SFTTrainer page) — Qwen3.5 is an explicitly supported family
    for the chat-template patching assistant_only_loss needs, keyed off the
    tokenizer's own chat template, independent of Unsloth.
  - PEFT's LoraConfig `target_modules="all-linear"` auto-targets every
    Linear/Conv1D layer (LM head excluded) — deliberately used instead of
    a hardcoded proj-name list, because Qwen3.5's new GatedDeltaNet layers
    use different projection names (e.g. `in_proj_qkv`, seen directly in
    the bug-3 traceback) that a hardcoded q/k/v/o/gate/up/down list would
    silently miss, leaving those layers untrained.
  - REAL BUG (first Kaggle run, user-reported, still applies regardless of
    Unsloth): hardcoding `bf16=True` in SFTConfig raised `ValueError: Your
    setup doesn't support bf16/gpu` — Kaggle's free T4 is Turing, not
    Ampere+, so it has no hardware bf16 tensor-core support. Fixed here by
    loading the model natively in bf16 (matches the checkpoint's own
    format — no cast needed) and setting SFTConfig's bf16=False, fp16=False
    (no trainer-level mixed-precision autocast at all, so that hardware
    check never triggers and no dtype-conversion happens on top of the
    already-consistent bf16 weights).
  - The real max token length, using the actual Qwen3.5-4B tokenizer +
    chat template (enable_thinking=False, matching Flash-mode inference):
    still 4656 tokens (same single outlier — the "bảng màu giao diện"
    answer — re-measured after the 81-example merge; p95 actually *dropped*
    to 849 since the 23 new refusal examples are all short). max_length
    below is set well above that so SFTConfig's truncation ("keep_start" —
    truncates the *end*) never silently cuts off part of an assistant
    answer, which is exactly the part being trained on.

SECOND FOLLOW-UP (2026-09-20, user request): switched to real 2-GPU
data-parallel training via `accelerate.notebook_launcher` — Kaggle's free
T4 accelerator gives 2 GPUs, and the single-GPU approach above
deliberately never used the 2nd one (avoiding the broken naive
`DataParallel` bug from before). Doing this *properly* needs
`accelerate.notebook_launcher(train_fn, num_processes=2)`: everything that
touches CUDA (model loading, LoRA, SFTTrainer, .train(), saving) must live
inside one function passed to it — per Accelerate's own docs, nothing
CUDA-related may run in the notebook *before* that call, or the spawned
processes get an unusable CUDA context. Per HF's bitsandbytes+Trainer docs,
no explicit `device_map` is passed when training under a distributed
launcher — Trainer/Accelerate place each process's model on its own GPU
automatically; each process holds a full model replica (same per-GPU
memory footprint as the working single-GPU run), so this shouldn't
increase OOM risk. `gradient_accumulation_steps` halved 4→2 (effective
batch stays 1 × 2 × 2 GPUs = 4, same as the single-GPU run) — smaller
gradient-update chunks per the user's request, not a bigger risk.
train_final.jsonl was also padded 81→82 (pad_dataset_for_parallel.py,
duplicates one already-approved example — no new content) purely so the
train split comes out even for a clean 2-way split. This whole path is
new and NOT yet proven on real hardware the way the single-GPU version
was — expect this needs at least one real-error-driven fix, same as every
other Kaggle-specific step so far.

Builds the .ipynb JSON directly (no `nbformat` package in ai/.venv) — same
approach as build_kaggle_notebook.py.

Run from ai/:  python -m training.build_lora_training_notebook
"""
import json
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "processed" / "train_final.jsonl"
# The pure, pytest-covered part of this step (load/validate/split) —
# embedded verbatim below rather than re-typed as a notebook-only string,
# same reasoning as kaggle_generation.py in build_kaggle_notebook.py.
LORA_TRAINING_DATA_SOURCE_PATH = Path(__file__).resolve().parent / "lora_training_data.py"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "kaggle" / "train_lora_kaggle.ipynb"

MAX_SEQ_LENGTH = 2048  # real measured p95 is 849 tokens on the 81-example set (see docstring) — buffer above that;
# lowered from 6144 after a real OOM (see docstring) to bound worst-case activation memory.
# Only the single 4656-token outlier example gets its answer truncated as a result — every
# other approved example (80/81) is well under this and stays fully intact.


def code_cell(source: str) -> dict:
    return {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": source.splitlines(keepends=True)}


def markdown_cell(source: str) -> dict:
    return {"cell_type": "markdown", "metadata": {}, "source": source.splitlines(keepends=True)}


def build_notebook() -> dict:
    dataset_jsonl = DATA_PATH.read_text(encoding="utf-8")
    example_count = len([line for line in dataset_jsonl.splitlines() if line.strip()])
    lora_training_data_source = LORA_TRAINING_DATA_SOURCE_PATH.read_text(encoding="utf-8")

    cells = [
        markdown_cell(
            "# Milestone 7 — Fine-tune LoRA trên Qwen3.5-4B\n"
            "\n"
            "**Trước khi Run All:** bật GPU — `Settings` (bảng bên phải) → `Accelerator` → chọn "
            "**GPU T4 x2** (bắt buộc lần này — notebook dùng thật cả 2 GPU, không phải TPU, xem lý do ở "
            "mục 3). Notebook **không cần bạn upload thêm gì** — "
            f"{example_count} cặp hỏi–đáp đã duyệt (Milestone 7 bước 5, bạn đã \"Đồng ý hết\") được "
            "nhúng sẵn ở cell dưới.\n"
            "\n"
            "**Phương pháp**: LoRA 16-bit thường (bf16, đúng định dạng gốc của checkpoint) qua "
            "`transformers` + `peft` + `trl` **thuần** — **không dùng Unsloth nữa** (đổi hướng so với "
            "bản trước): đã thử Unsloth theo đúng kế hoạch ban đầu, nhưng gặp liên tiếp 3 lỗi thật đều "
            "xuất phát từ cách Unsloth xử lý model Qwen3.5 (rất mới) trên GPU T4, lỗi cuối là 1 bug "
            "**chưa được Unsloth sửa xong** (xem mục 3). Không QLoRA 4-bit (cộng đồng khuyến cáo tránh "
            "cho Qwen3.5, xem `AI_CHATBOT_PLAN.md` mục 5).\n"
            "\n"
            f"Chạy xong (ước tính vài phút — {example_count} mẫu ít hơn nhiều so với ước tính ban đầu "
            "\"vài trăm mẫu\" lúc lập kế hoạch), tải file `lora_adapter.zip` về (link tải ở cell cuối) "
            "rồi gửi lại cho Claude.\n"
        ),
        # torchao: PEFT (nang cap qua -U) doi ban torchao >= 0.16.0, nhung Kaggle
        # co san ban cu hon (0.10.0) - loi that gap: ImportError khi get_peft_model()
        # quet qua dispatcher torchao (khong lien quan gi den lua chon model/GPU/du
        # lieu cua minh, thuan tuy goi co san tren Kaggle cu hon yeu cau moi cua PEFT).
        code_cell("!pip install -q -U transformers accelerate peft trl bitsandbytes torchao\n"),
        markdown_cell(
            "## 1. Dữ liệu train (đã nhúng sẵn, đã được bạn duyệt toàn bộ — không cần upload)\n"
            "\n"
            f"{example_count} cặp hỏi–đáp, mỗi cặp gồm system prompt thật của Navita (`ai/server/prompt.py`) "
            "+ câu hỏi + câu trả lời, đúng định dạng \"conversational\" mà TRL's SFTTrainer đọc trực "
            "tiếp (cột `messages`)."
        ),
        code_cell(
            "with open(\"training_data.jsonl\", \"w\", encoding=\"utf-8\") as f:\n"
            "    f.write(r'''" + dataset_jsonl + "''')\n"
            'print("Da ghi training_data.jsonl")\n'
        ),
        markdown_cell(
            "## 2. Nạp + kiểm dữ liệu (đã kiểm bằng 16 test pytest thật trên máy — không gõ tay lại ở "
            "đây, nhúng nguyên văn `ai/training/lora_training_data.py`)"
        ),
        code_cell(lora_training_data_source),
        code_cell(
            'ALL_EXAMPLES = load_training_examples("training_data.jsonl")\n'
            "TRAIN_EXAMPLES, EVAL_EXAMPLES = split_train_eval(ALL_EXAMPLES, eval_fraction=0.1, seed=7)\n"
            'print(f"{len(ALL_EXAMPLES)} tong, {len(TRAIN_EXAMPLES)} train, {len(EVAL_EXAMPLES)} giu lai '
            'de kiem tra chat luong sau khi train (khong dua vao tap train)")\n'
        ),
        markdown_cell(
            "## 3. Train trên 2 GPU song song (data-parallel qua `accelerate`)\n"
            "\n"
            "**Đổi theo yêu cầu**: dùng thật cả 2 GPU T4 mà Kaggle cấp, chia đôi mỗi batch (mỗi GPU giữ "
            "1 bản model, xử lý 1 nửa batch, gộp gradient lại) — thay vì chỉ dùng 1 GPU như bản trước.\n"
            "\n"
            "**Vì sao trước đây tránh dùng 2 GPU**: cách `Trainer` tự làm khi thấy 2 GPU mà không cấu "
            "hình gì thêm (`torch.nn.DataParallel`, kiểu cũ, đơn tiến trình) chính là thứ gây lỗi thật "
            "trước đó (`RuntimeError: ... on cuda:1, different from ... cuda:0`). Cách làm **đúng** cho "
            "nhiều GPU là `accelerate.notebook_launcher` — chạy 2 tiến trình song song thật sự (mỗi tiến "
            "trình giữ 1 GPU riêng), không phải `DataParallel`.\n"
            "\n"
            "**Quy tắc bắt buộc của `notebook_launcher`** (theo đúng docs của `accelerate`, không đoán): "
            "mọi đoạn code đụng tới CUDA (nạp model, train...) phải nằm **trong 1 hàm duy nhất** truyền "
            "vào `notebook_launcher` — không được có bước nào chạm CUDA ở ngoài hàm đó, trước khi gọi, "
            "nếu không tiến trình con sẽ nhận 1 CUDA context hỏng. Vì vậy toàn bộ mục 3+4+lưu adapter cũ "
            "giờ gộp vào 1 hàm `train_fn()` bên dưới.\n"
            "\n"
            "**Không cần `device_map` chỉ định thủ công** (đã tra cứu đúng docs `transformers`+"
            "`bitsandbytes` cho trường hợp train phân tán, không phải đoán): khi train dưới "
            "`accelerate`/`Trainer` phân tán, mỗi tiến trình tự nạp model vào đúng GPU của nó, không cần "
            "(và không nên) tự set `device_map`. Mỗi GPU vẫn giữ **1 bản đầy đủ** của model (giống hệt "
            "bộ nhớ dùng ở bản 1 GPU đã chạy ổn) — dùng thêm 1 GPU không làm tăng nguy cơ hết bộ nhớ, vì "
            "mỗi GPU có ngân sách bộ nhớ riêng, không chia sẻ.\n"
            "\n"
            f"`gradient_accumulation_steps` giảm còn **2** (từ 4) — cập nhật gradient thường xuyên hơn "
            "theo yêu cầu, batch hiệu dụng vẫn giữ nguyên `1 × 2 × 2 GPU = 4` như bản đã chạy ổn.\n"
            "\n"
            f"Đã thêm 1 mẫu (nhân đôi 1 câu \"từ chối trung thực\" đã duyệt — không bịa nội dung mới) "
            f"để tổng {example_count} mẫu chia 2 GPU cho chẵn.\n"
            "\n"
            "**Lưu ý**: đây là cách làm mới, chưa được chạy thử thật trên phần cứng — khác các bước "
            "trước đã tự kiểm hoặc chạy thật rồi. Nếu gặp lỗi, gửi lại thông báo lỗi đầy đủ để debug."
        ),
        code_cell(
            "def train_fn():\n"
            "    # Theo dung docs cua accelerate: MOI thu dung CUDA phai nam trong ham nay,\n"
            "    # khong duoc chay o ngoai truoc khi goi notebook_launcher() ben duoi.\n"
            "    import warnings\n"
            "\n"
            "    warnings.filterwarnings(\"ignore\", message=\"MatMul8bitLt.*\")\n"
            "    _original_showwarning = warnings.showwarning\n"
            "\n"
            "    def _filtered_showwarning(message, category, filename, lineno, file=None, line=None):\n"
            "        if \"MatMul8bitLt\" in str(message):\n"
            "            return\n"
            "        _original_showwarning(message, category, filename, lineno, file, line)\n"
            "\n"
            "    warnings.showwarning = _filtered_showwarning\n"
            "\n"
            "    import torch\n"
            "    from accelerate import Accelerator\n"
            "    from datasets import Dataset\n"
            "    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig\n"
            "    from peft import LoraConfig, TaskType, get_peft_model, prepare_model_for_kbit_training\n"
            "    from trl import SFTConfig, SFTTrainer\n"
            "\n"
            "    accelerator = Accelerator()\n"
            '    MODEL_NAME = "Qwen/Qwen3.5-4B"\n'
            "\n"
            "    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)\n"
            "\n"
            "    bnb_config = BitsAndBytesConfig(load_in_8bit=True)  # 8-bit, KHONG phai 4-bit/QLoRA (xem AI_CHATBOT_PLAN.md muc 5)\n"
            "    model = AutoModelForCausalLM.from_pretrained(\n"
            "        MODEL_NAME,\n"
            "        quantization_config=bnb_config,\n"
            "        dtype=torch.bfloat16,  # dtype cho phan KHONG bi luong tu hoa (embedding, layer norm, adapter LoRA)\n"
            "        # KHONG truyen device_map: dang train phan tan, de accelerate/Trainer tu dat\n"
            "        # dung GPU cho tung tien trinh (xem markdown tren, da tra cuu docs that).\n"
            "    )\n"
            "    model = prepare_model_for_kbit_training(model)\n"
            "\n"
            "    lora_config = LoraConfig(\n"
            "        r=16,\n"
            "        lora_alpha=16,\n"
            "        lora_dropout=0.0,\n"
            '        bias="none",\n'
            '        target_modules="all-linear",  # phu ca layer GatedDeltaNet (ten khac: in_proj_qkv...), khong bo sot\n'
            "        task_type=TaskType.CAUSAL_LM,\n"
            "    )\n"
            "    model = get_peft_model(model, lora_config)\n"
            "    if accelerator.is_main_process:\n"
            "        model.print_trainable_parameters()\n"
            "\n"
            "    train_dataset = Dataset.from_list(TRAIN_EXAMPLES)  # TRAIN_EXAMPLES tu cell truoc (ke thua qua fork)\n"
            "\n"
            "    sft_config = SFTConfig(\n"
            '        output_dir="lora_adapter_output",\n'
            "        num_train_epochs=3,\n"
            "        per_device_train_batch_size=1,\n"
            "        gradient_accumulation_steps=2,  # giam tu 4 - cap nhat gradient thuong xuyen hon; batch hieu dung 1x2x2GPU=4, giu nguyen nhu ban 1 GPU\n"
            "        learning_rate=2e-4,\n"
            "        warmup_steps=5,\n"
            '        optim="adamw_8bit",\n'
            "        weight_decay=0.0,\n"
            f"        max_length={MAX_SEQ_LENGTH},\n"
            "        assistant_only_loss=True,\n"
            "        packing=False,\n"
            "        bf16=False,\n"
            "        fp16=False,\n"
            "        logging_steps=5,\n"
            '        save_strategy="epoch",\n'
            '        report_to="none",\n'
            "        seed=7,\n"
            "    )\n"
            "\n"
            "    trainer = SFTTrainer(\n"
            "        model=model,\n"
            "        args=sft_config,\n"
            "        train_dataset=train_dataset,\n"
            "        processing_class=tokenizer,\n"
            "        # khong truyen peft_config — model da la PeftModel tu get_peft_model() o tren\n"
            "    )\n"
            "\n"
            "    trainer.train()\n"
            "\n"
            "    if accelerator.is_main_process:\n"
            '        ADAPTER_DIR = "lora_adapter"\n'
            "        trainer.save_model(ADAPTER_DIR)\n"
            "        tokenizer.save_pretrained(ADAPTER_DIR)\n"
            '        print("Da luu adapter vao", ADAPTER_DIR)\n'
        ),
        markdown_cell(
            "## 4. Chạy train trên 2 GPU\n"
            "\n"
            "`num_processes=2` — 2 tiến trình song song, mỗi tiến trình 1 GPU T4. Log sẽ hiện "
            "`Launching training on 2 GPUs.` nếu đúng."
        ),
        code_cell(
            "from accelerate import notebook_launcher\n"
            "\n"
            "notebook_launcher(train_fn, num_processes=2)\n"
        ),
        markdown_cell("## 5. Nén + tải adapter — tải file này về rồi gửi lại cho Claude"),
        code_cell(
            "import shutil\n"
            "\n"
            'shutil.make_archive("lora_adapter", "zip", "lora_adapter")\n'
            "\n"
            "from IPython.display import FileLink\n"
            'display(FileLink("lora_adapter.zip"))\n'
            'print("Tai file lora_adapter.zip o tren (hoac trong tab Output ben phai) roi gui lai cho Claude.")\n'
        ),
        markdown_cell(
            "## 6. Smoke test — so sánh câu trả lời model fine-tune với câu trả lời đã duyệt\n"
            "\n"
            "Nạp lại adapter vừa lưu (model/tokenizer bên trong `train_fn()` không còn truy cập được ở "
            "đây — mỗi tiến trình của `notebook_launcher` là 1 process riêng, không chia sẻ bộ nhớ "
            "ngược lại notebook chính). Dùng phần dữ liệu **giữ lại, không đưa vào tập train** "
            "(`EVAL_EXAMPLES` ở mục 2) — không phải đánh giá chính thức (quá ít mẫu để tính điểm), chỉ "
            "để bạn liếc qua xem giọng văn/nội dung có bám theo dữ liệu dự án hơn bản gốc không, trước "
            "khi tải adapter về."
        ),
        code_cell(
            "import torch\n"
            "from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig\n"
            "from peft import PeftModel\n"
            "\n"
            'MODEL_NAME = "Qwen/Qwen3.5-4B"\n'
            'ADAPTER_DIR = "lora_adapter"\n'
            "\n"
            "smoke_tokenizer = AutoTokenizer.from_pretrained(ADAPTER_DIR)\n"
            "smoke_bnb_config = BitsAndBytesConfig(load_in_8bit=True)\n"
            "smoke_base = AutoModelForCausalLM.from_pretrained(\n"
            "    MODEL_NAME, quantization_config=smoke_bnb_config, dtype=torch.bfloat16, device_map={\"\": \"cuda:0\"}\n"
            ")\n"
            "smoke_model = PeftModel.from_pretrained(smoke_base, ADAPTER_DIR)\n"
            "smoke_model.eval()\n"
            "\n"
            "for example in EVAL_EXAMPLES:\n"
            "    system_msg, user_msg, reference_msg = example[\"messages\"]\n"
            "    prompt_text = smoke_tokenizer.apply_chat_template(\n"
            "        [system_msg, user_msg], tokenize=False, add_generation_prompt=True, enable_thinking=False\n"
            "    )\n"
            '    inputs = smoke_tokenizer(prompt_text, return_tensors="pt").to(smoke_model.device)\n'
            "    with torch.no_grad():\n"
            "        output_ids = smoke_model.generate(**inputs, max_new_tokens=600, do_sample=False, pad_token_id=smoke_tokenizer.eos_token_id)\n"
            "    reply = smoke_tokenizer.decode(output_ids[0][inputs[\"input_ids\"].shape[1]:], skip_special_tokens=True)\n"
            "\n"
            '    print(f"HOI: {user_msg[\'content\']}")\n'
            '    print(f"\\nDAP (fine-tune): {reply}")\n'
            '    print(f"\\nDAP (da duyet, tham khao): {reference_msg[\'content\'][:500]}")\n'
            '    print("\\n" + "=" * 80 + "\\n")\n'
        ),
    ]

    return {
        "cells": cells,
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python", "version": "3"},
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }


def main() -> None:
    notebook = build_notebook()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(notebook, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Built {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
