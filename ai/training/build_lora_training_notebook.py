"""
Assembles ai/kaggle/train_lora_kaggle.ipynb — Milestone 7 step 6
(AI_CHATBOT_PLAN.md section 12.3): fine-tunes a LoRA adapter on top of
Qwen/Qwen3.5-4B using the 58 user-approved training examples
(data/processed/train_final.jsonl, approved in full by the user via
review_sample.md — "Đồng ý hết").

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
claim, but the 4B model in native bf16 + LoRA (~21M trainable params) +
gradient checkpointing + a tiny 52-example dataset should still comfortably
fit a T4's 16GB; if it doesn't, the concrete OOM error will say so and
that's the next real thing to fix, not a hypothetical to solve in advance.

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
  - The real max token length across all 58 approved examples, using the
    actual Qwen3.5-4B tokenizer + chat template (enable_thinking=False,
    matching Flash-mode inference): 4656 tokens (1 outlier — the "bảng màu
    giao diện" answer; p95 is only 1521). max_length below is set well
    above that so SFTConfig's truncation ("keep_start" — truncates the
    *end*) never silently cuts off part of an assistant answer, which is
    exactly the part being trained on.

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

MAX_SEQ_LENGTH = 6144  # real measured max is 4656 tokens (see docstring) — buffer above that


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
            "**GPU T4**. Notebook **không cần bạn upload thêm gì** — "
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
        code_cell("!pip install -q -U transformers accelerate peft trl bitsandbytes\n"),
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
            "## 3. Tải model (bf16 thuần, không qua Unsloth) + gắn LoRA\n"
            "\n"
            "**Vì sao bỏ Unsloth (đổi hướng so với kế hoạch ban đầu)** — 3 lỗi thật liên tiếp khi chạy "
            "trên Kaggle, cả 3 đều do cách Unsloth nạp riêng model Qwen3.5 (model rất mới), không liên "
            "quan đến dữ liệu/cấu hình train của mình:\n"
            "  1. `FastLanguageModel.from_pretrained` trả về 1 `Processor` đa phương thức thay vì "
            "tokenizer thường → TRL coi model là \"vision-language\" và chặn `assistant_only_loss`.\n"
            "  2. `Processor` đó đòi content mỗi message phải là danh sách khối `{\"type\":\"text\",...}` "
            "thay vì chuỗi thường → `TypeError` khi tokenize.\n"
            "  3. Sau khi vá 2 lỗi trên, train thật sự chạy thì sập ở layer `Qwen3_5GatedDeltaNet` "
            "(kiểu layer \"linear attention\" mới của Qwen3.5): `RuntimeError: ... BFloat16 != Half` — "
            "tra ra đây là **bug thật của chính Unsloth, đã có người báo, CHƯA được sửa xong** "
            "([issue #4970](https://github.com/unslothai/unsloth/issues/4970)): fix đề xuất "
            "(`UNSLOTH_FORCE_FLOAT32=1`) nằm trong 1 pull request **vẫn đang mở, chưa merge** "
            "([unsloth-zoo #978](https://github.com/unslothai/unsloth-zoo/pull/978)) — nên dù đã bật "
            "biến môi trường đó, không có tác dụng gì (bản Unsloth cài qua pip chưa có code fix này). "
            "Đây là điểm tôi nhận định sai ở lần sửa trước: thấy có pull request đề xuất fix rồi vội "
            "coi như \"đã có fix chính thức\", nhưng chưa kiểm tra pull request đó **đã merge/phát hành "
            "hay chưa** trước khi áp dụng.\n"
            "\n"
            "→ Bỏ hẳn Unsloth cho bước này, dùng thẳng `transformers` + `peft` + `trl` — không đi qua "
            "bản Qwen3.5 tự biên dịch lại của Unsloth nên không dính lỗi 3, tokenizer là "
            "`PreTrainedTokenizerBase` thường nên không dính lỗi 1/2 (dữ liệu giữ nguyên dạng `messages` "
            "với content chuỗi thường như ban đầu, không cần khối nội dung nữa). Đánh đổi: mất tối ưu bộ "
            "nhớ/tốc độ riêng của Unsloth — chậm hơn 1 chút, tốn VRAM hơn mức Unsloth từng đo (~10GB), "
            "nhưng model 4B ở bf16 gốc (không ép kiểu) + chỉ train LoRA (~21 triệu tham số, đã thấy ở "
            "log lần trước) + bật gradient checkpointing + tập dữ liệu rất nhỏ (52 mẫu) nhiều khả năng "
            "vẫn vừa 16GB của T4 — nếu không vừa, thông báo lỗi thật sẽ cho biết cụ thể để sửa tiếp, "
            "không đoán trước.\n"
            "\n"
            f"`max_seq_length = {MAX_SEQ_LENGTH}` — đo thật bằng tokenizer thật của Qwen3.5-4B trên cả "
            "58 mẫu đã duyệt: dài nhất 4656 token (1 câu trả lời ngoại lệ về bảng màu giao diện; 95% còn "
            "lại dưới 1521 token). Đặt dư ra để không bao giờ bị cắt mất phần cuối câu trả lời — "
            "`SFTConfig` cắt bớt từ *cuối* chuỗi khi vượt `max_length`, mà câu trả lời (thứ đang được "
            "train) luôn nằm ở cuối chuỗi.\n"
            "\n"
            "`target_modules=\"all-linear\"` (thay vì liệt kê tên cố định q/k/v/o/gate/up/down) — layer "
            "`GatedDeltaNet` mới của Qwen3.5 dùng tên khác hẳn (`in_proj_qkv`, thấy thẳng trong traceback "
            "lỗi 3 ở trên), 1 danh sách tên cố định kiểu cũ sẽ bỏ sót hẳn các layer này, khiến chúng "
            "không được train LoRA. `\"all-linear\"` tự nhắm mọi layer Linear (trừ lm_head, theo đúng "
            "docs PEFT) nên phủ đúng cả kiểu layer mới này."
        ),
        code_cell(
            "import torch\n"
            "from transformers import AutoModelForCausalLM, AutoTokenizer\n"
            "from peft import LoraConfig, TaskType, get_peft_model\n"
            "\n"
            'MODEL_NAME = "Qwen/Qwen3.5-4B"\n'
            "\n"
            "tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)\n"
            "model = AutoModelForCausalLM.from_pretrained(\n"
            "    MODEL_NAME,\n"
            "    dtype=torch.bfloat16,  # dung dtype goc cua checkpoint, khong ep kieu\n"
            '    device_map={"": "cuda:0"},\n'
            ")\n"
            "model.gradient_checkpointing_enable()\n"
            "model.enable_input_require_grads()  # can thiet de gradient checkpointing hoat dong dung voi LoRA (base model dong bang)\n"
            "\n"
            "lora_config = LoraConfig(\n"
            "    r=16,\n"
            "    lora_alpha=16,\n"
            "    lora_dropout=0.0,\n"
            '    bias="none",\n'
            '    target_modules="all-linear",\n'
            "    task_type=TaskType.CAUSAL_LM,\n"
            ")\n"
            "model = get_peft_model(model, lora_config)\n"
            "model.print_trainable_parameters()\n"
        ),
        markdown_cell(
            "## 4. Cấu hình train + chạy\n"
            "\n"
            "- `assistant_only_loss=True` trên dữ liệu dạng `messages` gốc — chỉ tính loss trên phần "
            "model *trả lời*, không tính trên system prompt/câu hỏi (2 phần đó giống hệt/lặp lại ở "
            "nhiều mẫu và không phải thứ cần học). Dùng lại được nguyên bản (không cần đổi dạng "
            "`prompt`/`completion` như bản Unsloth trước) vì `tokenizer` giờ là tokenizer thường, không "
            "còn bị TRL coi là model đa phương thức nữa (xem mục 3).\n"
            "- `num_train_epochs=3`, batch hiệu dụng nhỏ (`per_device=1 × gradient_accumulation=4`) — "
            "đúng theo kế hoạch mục 12.3 (\"2–3 epoch, batch nhỏ\"), phù hợp với tập chỉ "
            f"{example_count} mẫu.\n"
            "- `learning_rate=2e-4`, `optim=\"adamw_8bit\"` — chuẩn phổ biến cho LoRA (cao hơn mức "
            "~1e-4 hay dùng khi train full model, hợp lý hơn vì chỉ train phần adapter nhỏ).\n"
            "- `bf16=False, fp16=False` — không bật autocast mixed-precision nào của Trainer. Model đã "
            "nạp sẵn ở bf16 (mục 3) nên cứ train nguyên trong dtype đó, không ép kiểu thêm lần nào nữa. "
            "**Lỗi thật gặp ở bản trước** (vẫn áp dụng dù đổi framework): hardcode `bf16=True` bị GPU T4 "
            "từ chối ngay từ bước tạo `SFTConfig` (`ValueError: Your setup doesn't support bf16/gpu`) vì "
            "T4 là kiến trúc Turing, chỉ GPU Ampere trở lên mới có nhân bf16 phần cứng cho việc autocast "
            "này — nay tránh hẳn vấn đề bằng cách không bật autocast, để model tự chạy đúng dtype nó "
            "đã có sẵn."
        ),
        code_cell(
            "from datasets import Dataset\n"
            "from trl import SFTConfig, SFTTrainer\n"
            "\n"
            "train_dataset = Dataset.from_list(TRAIN_EXAMPLES)\n"
            "\n"
            "sft_config = SFTConfig(\n"
            '    output_dir="lora_adapter_output",\n'
            "    num_train_epochs=3,\n"
            "    per_device_train_batch_size=1,\n"
            "    gradient_accumulation_steps=4,\n"
            "    learning_rate=2e-4,\n"
            "    warmup_steps=5,\n"
            '    optim="adamw_8bit",\n'
            "    weight_decay=0.0,\n"
            f"    max_length={MAX_SEQ_LENGTH},\n"
            "    assistant_only_loss=True,\n"
            "    packing=False,\n"
            "    bf16=False,\n"
            "    fp16=False,\n"
            "    logging_steps=5,\n"
            '    save_strategy="epoch",\n'
            '    report_to="none",\n'
            "    seed=7,\n"
            ")\n"
            "\n"
            "trainer = SFTTrainer(\n"
            "    model=model,\n"
            "    args=sft_config,\n"
            "    train_dataset=train_dataset,\n"
            "    processing_class=tokenizer,\n"
            "    # khong truyen peft_config — model da la PeftModel tu get_peft_model() o tren\n"
            ")\n"
            "\n"
            "trainer.train()\n"
        ),
        markdown_cell("## 5. Lưu adapter — tải file này về rồi gửi lại cho Claude"),
        code_cell(
            'ADAPTER_DIR = "lora_adapter"\n'
            "model.save_pretrained(ADAPTER_DIR)\n"
            "tokenizer.save_pretrained(ADAPTER_DIR)\n"
            "\n"
            "import shutil\n"
            'shutil.make_archive("lora_adapter", "zip", ADAPTER_DIR)\n'
            "\n"
            "from IPython.display import FileLink\n"
            'display(FileLink("lora_adapter.zip"))\n'
            'print("Tai file lora_adapter.zip o tren (hoac trong tab Output ben phai) roi gui lai cho Claude.")\n'
        ),
        markdown_cell(
            "## 6. Smoke test — so sánh câu trả lời model fine-tune với câu trả lời đã duyệt\n"
            "\n"
            "Dùng phần dữ liệu **giữ lại, không đưa vào tập train** (`EVAL_EXAMPLES` ở mục 2) — không "
            "phải đánh giá chính thức (quá ít mẫu để tính điểm), chỉ để bạn liếc qua xem giọng văn/nội "
            "dung có bám theo dữ liệu dự án hơn bản gốc không, trước khi tải adapter về."
        ),
        code_cell(
            "model.eval()\n"
            "\n"
            "for example in EVAL_EXAMPLES:\n"
            "    system_msg, user_msg, reference_msg = example[\"messages\"]\n"
            "    prompt_text = tokenizer.apply_chat_template(\n"
            "        [system_msg, user_msg], tokenize=False, add_generation_prompt=True, enable_thinking=False\n"
            "    )\n"
            '    inputs = tokenizer(prompt_text, return_tensors="pt").to(model.device)\n'
            "    with torch.no_grad():\n"
            "        output_ids = model.generate(**inputs, max_new_tokens=600, do_sample=False, pad_token_id=tokenizer.eos_token_id)\n"
            "    reply = tokenizer.decode(output_ids[0][inputs[\"input_ids\"].shape[1]:], skip_special_tokens=True)\n"
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
