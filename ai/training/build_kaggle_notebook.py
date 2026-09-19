"""
Assembles ai/training/generate_dataset_kaggle.ipynb — a self-contained
notebook (no separate dataset upload needed) that runs Qwen3.5-9B on Kaggle's
free GPU to generate the model-based half of Milestone 7's training data
(AI_CHATBOT_PLAN.md section 12.2 step 2).

Builds the .ipynb JSON directly (no `nbformat` package available in ai/.venv)
— the format is simple and stable enough that this is fine.

Run from ai/:  python -m training.build_kaggle_notebook
"""
import json
from pathlib import Path

CHUNKS_PATH = Path(__file__).resolve().parents[1] / "data" / "processed" / "doc_chunks_for_kaggle.json"
# The pure, pytest-covered part of the generation logic (build_prompt,
# extract_json_array, process_one, run_parallel) — embedded verbatim below
# rather than re-typed as a notebook-only string, so the notebook always runs
# exactly the tested code, never a hand-copied (and possibly drifted) version.
KAGGLE_GENERATION_SOURCE_PATH = Path(__file__).resolve().parent / "kaggle_generation.py"
# ai/kaggle/ — a dedicated, obvious place for notebooks meant to be uploaded
# to Kaggle (this one, and the LoRA-training one to come later in Milestone
# 7) — separate from ai/training/'s own Python source that builds them.
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "kaggle" / "generate_dataset_kaggle.ipynb"


def code_cell(source: str) -> dict:
    return {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": source.splitlines(keepends=True)}


def markdown_cell(source: str) -> dict:
    return {"cell_type": "markdown", "metadata": {}, "source": source.splitlines(keepends=True)}


def build_notebook() -> dict:
    chunks_json = CHUNKS_PATH.read_text(encoding="utf-8")
    chunk_count = len(json.loads(chunks_json))
    kaggle_generation_source = KAGGLE_GENERATION_SOURCE_PATH.read_text(encoding="utf-8")

    cells = [
        markdown_cell(
            "# Milestone 7 — Sinh dữ liệu train bằng Qwen3.5-9B\n"
            "\n"
            "**Trước khi Run All:** bật GPU — `Settings` (bảng bên phải) → `Accelerator` → chọn "
            "**GPU T4** (1 GPU là đủ — xem mục 2 để biết vì sao không dùng 2 GPU). Không bật GPU thì cell "
            "load model sẽ rất chậm hoặc lỗi hết bộ nhớ.\n"
            "\n"
            f"Notebook này **không cần bạn upload thêm gì** — {chunk_count} đoạn tài liệu của dự án đã được nhúng "
            "sẵn ở cell dưới. Chạy xong, tải file `generated_qa.jsonl` về (link tải hiện ở cell cuối) rồi "
            "gửi lại cho Claude.\n"
            "\n"
            "**Lưu ý:** đã qua 2 vòng chạy thật trên Kaggle + sửa lỗi thật (OOM do model kèm vision "
            "encoder, và 1 lỗi hình dạng JSON làm sập giữa chừng ở đoạn 21/37 — cả 2 đã sửa và có test "
            "pytest cho phần logic thuần, xem `ai/training/kaggle_generation.py`). Riêng phần gọi model "
            "thật (`generate_qa_for_chunk`, mục 4) vẫn chưa tự kiểm lại được sau lần sửa mới nhất — nếu "
            "gặp lỗi khi chạy, gửi lại thông báo lỗi để debug tiếp.\n"
        ),
        code_cell(
            "!pip install -q -U transformers accelerate bitsandbytes\n"
        ),
        markdown_cell(
            "## 1. Dữ liệu đoạn tài liệu (đã nhúng sẵn, không cần upload)\n"
            "\n"
            f"{chunk_count} đoạn từ `PROJECT_CONTEXT.md`/`USER_GUIDE.md` — đã chunk sẵn ở Milestone 6 "
            "(`ai/server/chunking.py`), sau đó lọc chỉ giữ các mục *người dùng thật sự quan tâm* "
            "(`ai/training/extract_kaggle_chunks.py`, cùng danh sách mục với bước sinh dữ liệu template) "
            "— bỏ các mục dành cho dev (schema DB, hợp đồng API, cấu trúc thư mục...) và toàn bộ "
            "`document.txt` (log lịch sử xây dựng, không phải nội dung cho người dùng)."
        ),
        code_cell("import json\n\nCHUNKS = json.loads(r'''" + chunks_json + "''')\nprint(f\"Loaded {len(CHUNKS)} chunks\")\n"),
        markdown_cell(
            "## 2. Tải model (4-bit, 1 GPU)\n"
            "\n"
            "**Đã bỏ chạy song song 2 GPU** — thử thật trên Kaggle phát hiện Qwen3.5-9B kèm sẵn 1 "
            "vision encoder + module multi-token-prediction (không dùng tới, nhưng vẫn bị đọc vào bộ nhớ "
            "GPU lúc nạp trước khi bị bỏ đi) khiến **1 bản model đã chiếm gần hết 1 GPU T4 (14.56GB)** — "
            "2 bản riêng trên 2 GPU không đủ chỗ, đã gặp lỗi *CUDA out of memory* thật khi thử. Với chỉ "
            "vài chục đoạn, 1 GPU vẫn chạy xong trong thời gian hợp lý nên không cần thiết phải ép chạy "
            "song song 2 bản."
        ),
        code_cell(
            "import torch\n"
            "from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig\n"
            "\n"
            'MODEL_NAME = "Qwen/Qwen3.5-9B"\n'
            "\n"
            "bnb_config = BitsAndBytesConfig(\n"
            "    load_in_4bit=True,\n"
            "    bnb_4bit_compute_dtype=torch.bfloat16,\n"
            "    bnb_4bit_use_double_quant=True,\n"
            '    bnb_4bit_quant_type="nf4",\n'
            ")\n"
            "\n"
            'DEVICE = "cuda:0" if torch.cuda.is_available() else "cpu"\n'
            'print(f"Dang dung: {DEVICE}")\n'
            "\n"
            "tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)\n"
            "model = AutoModelForCausalLM.from_pretrained(\n"
            "    MODEL_NAME,\n"
            "    quantization_config=bnb_config if DEVICE != \"cpu\" else None,\n"
            '    device_map={"": DEVICE},\n'
            ")\n"
            "# Giu nguyen ten MODELS/GPU_IDS o cell duoi (chi con dung 1 \"worker\") de khong phai sua lai\n"
            "# ham sinh cau hoi-dap va vong lap chay song song ben duoi — chi khac la gio chi co 1 GPU.\n"
            "MODELS = {0: model}\n"
            'print("Da tai xong model.")\n'
        ),
        markdown_cell(
            "## 3. Hàm sinh câu hỏi–đáp (đã kiểm bằng 15 test pytest thật trên máy — không gõ tay lại "
            "ở đây, nhúng nguyên văn `ai/training/kaggle_generation.py`)\n"
            "\n"
            "`enable_thinking=False` (cell dưới) quan trọng — đo thật ở Milestone 6: cùng 1 prompt mất "
            "73.7s (thinking bật) so với 1.1s (tắt) trên Qwen3.5-4B."
        ),
        code_cell(kaggle_generation_source),
        markdown_cell(
            "## 4. Nối vào model thật + Smoke test — chỉ 2 đoạn trước (kiểm tra pipeline trước khi tốn "
            "cả phiên GPU)"
        ),
        code_cell(
            "def generate_qa_for_chunk(chunk: dict, gpu_id, max_new_tokens: int = 600) -> list:\n"
            "    model = MODELS[gpu_id]\n"
            "    messages = [\n"
            '        {"role": "system", "content": GENERATION_SYSTEM_PROMPT},\n'
            '        {"role": "user", "content": build_prompt(chunk)},\n'
            "    ]\n"
            "    text = tokenizer.apply_chat_template(\n"
            "        messages, tokenize=False, add_generation_prompt=True, enable_thinking=False\n"
            "    )\n"
            '    inputs = tokenizer(text, return_tensors="pt").to(model.device)\n'
            "    with torch.no_grad():\n"
            "        output_ids = model.generate(\n"
            "            **inputs,\n"
            "            max_new_tokens=max_new_tokens,\n"
            "            do_sample=True,\n"
            "            temperature=0.7,\n"
            "            pad_token_id=tokenizer.eos_token_id,\n"
            "        )\n"
            "    reply = tokenizer.decode(output_ids[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)\n"
            "    return extract_json_array(reply)\n"
            "\n"
            "\n"
            "GPU_IDS = list(MODELS.keys())  # e.g. [0, 1] voi 2 GPU\n"
            "\n"
            "smoke_results = run_parallel(CHUNKS[:2], generate_qa_for_chunk, GPU_IDS)\n"
            "for r in sorted(smoke_results, key=lambda r: r[\"index\"]):\n"
            "    if r[\"error\"]:\n"
            '        print(f"LOI o \'{r[\'heading\']}\': {r[\'error\']}")\n'
            "    else:\n"
            '        print(f"OK — {r[\'heading\']}: {len(r[\'pairs\'])} pairs")\n'
            "        print(json.dumps(r[\"pairs\"], ensure_ascii=False, indent=2))\n"
            "    print(\"---\\n\")\n"
        ),
        markdown_cell(
            "**Dừng ở đây kiểm tra kết quả smoke test phía trên trước khi chạy tiếp.** Nếu 2 đoạn trên ra "
            f"kết quả hợp lý (câu hỏi tự nhiên, đáp án đúng nội dung đoạn), chạy tiếp cell dưới cho toàn "
            f"bộ {chunk_count} đoạn. Nếu lỗi, gửi lại thông báo lỗi để debug."
        ),
        markdown_cell(
            f"## 5. Chạy toàn bộ {chunk_count} đoạn (1 GPU — ước tính 10–20 phút)"
        ),
        code_cell(
            "results = []\n"
            "errors = []\n"
            "done_count = 0\n"
            "\n"
            "\n"
            "def collect(r):\n"
            "    global done_count\n"
            "    done_count += 1\n"
            "    if r[\"error\"]:\n"
            '        errors.append({"chunk_index": r["index"], "heading": r["heading"], "error": r["error"]})\n'
            "    else:\n"
            "        for pair in r[\"pairs\"]:\n"
            '            results.append({"source": r["source"], "heading": r["heading"], **pair})\n'
            "    if done_count % 10 == 0:\n"
            '        print(f"{done_count}/{len(CHUNKS)} xu ly xong, {len(results)} cap, {len(errors)} loi")\n'
            "\n"
            "\n"
            "run_parallel(CHUNKS, generate_qa_for_chunk, GPU_IDS, on_result=collect)\n"
            'print(f"\\nXong: {len(results)} cap hoi-dap, {len(errors)} doan bi loi (bo qua)")\n'
        ),
        markdown_cell("## 6. Lưu kết quả — tải file này về rồi gửi lại cho Claude"),
        code_cell(
            "OUTPUT_FILE = \"generated_qa.jsonl\"\n"
            "with open(OUTPUT_FILE, \"w\", encoding=\"utf-8\") as f:\n"
            "    for r in results:\n"
            "        f.write(json.dumps(r, ensure_ascii=False) + \"\\n\")\n"
            "\n"
            "if errors:\n"
            "    with open(\"generation_errors.json\", \"w\", encoding=\"utf-8\") as f:\n"
            "        json.dump(errors, f, ensure_ascii=False, indent=2)\n"
            '    print(f"Co {len(errors)} doan bi loi, xem generation_errors.json")\n'
            "\n"
            "from IPython.display import FileLink\n"
            "display(FileLink(OUTPUT_FILE))\n"
            'print("Tai file generated_qa.jsonl o tren (hoac trong tab Output ben phai) roi gui lai cho Claude.")\n'
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
    OUTPUT_PATH.write_text(json.dumps(notebook, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Built {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
