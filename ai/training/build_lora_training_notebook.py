"""
Assembles ai/kaggle/train_lora_kaggle.ipynb — Milestone 7 step 6
(AI_CHATBOT_PLAN.md section 12.3): fine-tunes a LoRA adapter on top of
Qwen/Qwen3.5-4B using the 58 user-approved training examples
(data/processed/train_final.jsonl, approved in full by the user via
review_sample.md — "Đồng ý hết").

Uses Unsloth (per AI_CHATBOT_PLAN.md §12.3's already-agreed plan) + TRL's
SFTTrainer — not a hand-rolled training loop, for the same reason
kaggle_generation.py replaced hand-typed generation logic: standard,
maintained libraries catch shape/API mistakes with real errors instead of
silent wrong behavior. Confirmed before writing this notebook (2026-09-19):
  - TRL v1.13.0 SFTTrainer/SFTConfig/SFTConfig.assistant_only_loss API
    (docs.trl SFTTrainer page) — Qwen3.5 is an explicitly supported family
    for the chat-template patching assistant_only_loss needs.
  - Unsloth explicitly supports Qwen3.5 fine-tuning (incl. the 4B size),
    recommends plain 16-bit LoRA over QLoRA 4-bit for this model family
    (matches the community guidance already in AI_CHATBOT_PLAN.md §5), and
    measures ~10GB VRAM for Qwen3.5-4B bf16 LoRA — comfortably under a
    Kaggle T4's 16GB, unlike the 9B data-generation notebook's ~14.33GB
    single-instance footprint (see build_kaggle_notebook.py's cell 2).
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
            "**Phương pháp**: LoRA 16-bit thường qua [Unsloth](https://unsloth.ai) — **không** QLoRA "
            "4-bit (cộng đồng khuyến cáo tránh QLoRA cho Qwen3.5 vì lệch lượng tử hoá cao hơn bình "
            "thường, xem `AI_CHATBOT_PLAN.md` mục 5). Unsloth đo thực tế Qwen3.5-4B LoRA 16-bit tốn "
            "~10GB VRAM — dư dả so với T4 (16GB), khác với notebook sinh dữ liệu (Qwen3.5-9B) suýt "
            "tràn bộ nhớ ở mục đó.\n"
            "\n"
            f"Chạy xong (ước tính vài phút — {example_count} mẫu ít hơn nhiều so với ước tính ban đầu "
            "\"vài trăm mẫu\" lúc lập kế hoạch), tải file `lora_adapter.zip` về (link tải ở cell cuối) "
            "rồi gửi lại cho Claude.\n"
        ),
        code_cell("!pip install -q -U unsloth\n"),
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
            "## 3. Tải model (16-bit, không lượng tử hoá) + gắn LoRA\n"
            "\n"
            f"`max_seq_length = {MAX_SEQ_LENGTH}` — đo thật bằng tokenizer thật của Qwen3.5-4B trên cả "
            "58 mẫu đã duyệt: dài nhất 4656 token (1 câu trả lời ngoại lệ về bảng màu giao diện; 95% còn "
            "lại dưới 1521 token). Đặt dư ra để không bao giờ bị cắt mất phần cuối câu trả lời — "
            "`SFTConfig` cắt bớt từ *cuối* chuỗi khi vượt `max_length`, mà câu trả lời (thứ đang được "
            "train) luôn nằm ở cuối chuỗi."
        ),
        code_cell(
            "from unsloth import FastLanguageModel\n"
            "\n"
            'MODEL_NAME = "Qwen/Qwen3.5-4B"\n'
            "\n"
            "model, tokenizer = FastLanguageModel.from_pretrained(\n"
            "    model_name=MODEL_NAME,\n"
            f"    max_seq_length={MAX_SEQ_LENGTH},\n"
            "    load_in_4bit=False,  # QLoRA khong khuyen cao cho Qwen3.5 (xem markdown tren)\n"
            "    load_in_16bit=True,\n"
            "    full_finetuning=False,\n"
            ")\n"
            "\n"
            "model = FastLanguageModel.get_peft_model(\n"
            "    model,\n"
            "    r=16,\n"
            "    target_modules=[\n"
            '        "q_proj", "k_proj", "v_proj", "o_proj",\n'
            '        "gate_proj", "up_proj", "down_proj",\n'
            "    ],\n"
            "    lora_alpha=16,\n"
            "    lora_dropout=0,\n"
            '    bias="none",\n'
            f"    use_gradient_checkpointing=\"unsloth\",  # giam VRAM, quan trong voi T4\n"
            "    random_state=7,\n"
            f"    max_seq_length={MAX_SEQ_LENGTH},\n"
            ")\n"
            'print("Da tai model + gan LoRA.")\n'
        ),
        markdown_cell(
            "## 4. Cấu hình train + chạy\n"
            "\n"
            "- `assistant_only_loss=True` — chỉ tính loss trên phần model *trả lời*, không tính trên "
            "system prompt/câu hỏi (2 phần đó giống hệt nhau ở nhiều mẫu và không phải thứ cần học). "
            "TRL tự thay chat template của Qwen3.5 bằng bản có đánh dấu `{% generation %}` cho việc "
            "này (Qwen3.5 nằm trong danh sách các họ model TRL hỗ trợ sẵn — đã tra cứu trực tiếp "
            "docs.trl trước khi viết cell này).\n"
            "- `num_train_epochs=3`, batch hiệu dụng nhỏ (`per_device=1 × gradient_accumulation=4`) — "
            "đúng theo kế hoạch mục 12.3 (\"2–3 epoch, batch nhỏ\"), phù hợp với tập chỉ "
            f"{example_count} mẫu.\n"
            "- `learning_rate=2e-4`, `optim=\"adamw_8bit\"` — mặc định chuẩn của Unsloth cho LoRA "
            "(khác PEFT/TRL thường dùng ~1e-4, Unsloth khuyến nghị cao hơn 1 chút vì chỉ train LoRA "
            "adapter, không train full model)."
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
            "    bf16=True,\n"
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
            "FastLanguageModel.for_inference(model)\n"
            "\n"
            "for example in EVAL_EXAMPLES:\n"
            "    system_msg, user_msg, reference_msg = example[\"messages\"]\n"
            "    prompt_text = tokenizer.apply_chat_template(\n"
            "        [system_msg, user_msg], tokenize=False, add_generation_prompt=True, enable_thinking=False\n"
            "    )\n"
            '    inputs = tokenizer(prompt_text, return_tensors="pt").to(model.device)\n'
            "    output_ids = model.generate(**inputs, max_new_tokens=600, do_sample=False, pad_token_id=tokenizer.eos_token_id)\n"
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
