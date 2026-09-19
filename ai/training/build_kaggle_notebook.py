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

    cells = [
        markdown_cell(
            "# Milestone 7 — Sinh dữ liệu train bằng Qwen3.5-9B\n"
            "\n"
            "**Trước khi Run All:** bật GPU — `Settings` (bảng bên phải) → `Accelerator` → chọn "
            "**GPU T4 x2** (hoặc P100). Không bật GPU thì cell load model sẽ rất chậm hoặc lỗi hết bộ nhớ.\n"
            "\n"
            "Notebook này **không cần bạn upload thêm gì** — 139 đoạn tài liệu của dự án đã được nhúng "
            "sẵn ở cell dưới. Chạy xong, tải file `generated_qa.jsonl` về (link tải hiện ở cell cuối) rồi "
            "gửi lại cho Claude.\n"
            "\n"
            "**Lưu ý:** notebook này được viết dựa trên tài liệu API chính thức của `transformers`/"
            "`bitsandbytes`, nhưng CHƯA được chạy thử thật (không có GPU 9B model để tự kiểm trước khi "
            "đưa cho bạn) — khác với mọi phần code khác của dự án. Nếu gặp lỗi khi chạy, gửi lại thông "
            "báo lỗi để debug tiếp.\n"
        ),
        code_cell(
            "!pip install -q -U transformers accelerate bitsandbytes\n"
        ),
        markdown_cell(
            "## 1. Dữ liệu đoạn tài liệu (đã nhúng sẵn, không cần upload)\n"
            "\n"
            f"139 đoạn từ `PROJECT_CONTEXT.md`/`USER_GUIDE.md`/`document.txt`, đã chunk sẵn ở Milestone 6 "
            "(`ai/server/chunking.py`)."
        ),
        code_cell("import json\n\nCHUNKS = json.loads(r'''" + chunks_json + "''')\nprint(f\"Loaded {len(CHUNKS)} chunks\")\n"),
        markdown_cell("## 2. Tải model (4-bit, vừa GPU T4 16GB)"),
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
            "tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)\n"
            "model = AutoModelForCausalLM.from_pretrained(\n"
            "    MODEL_NAME,\n"
            "    quantization_config=bnb_config,\n"
            '    device_map="auto",\n'
            ")\n"
            'print("Model loaded.")\n'
        ),
        markdown_cell(
            "## 3. Hàm sinh câu hỏi–đáp cho 1 đoạn\n"
            "\n"
            "`enable_thinking=False` quan trọng — đo thật ở Milestone 6: cùng 1 prompt mất 73.7s "
            "(thinking bật) so với 1.1s (tắt) trên Qwen3.5-4B. 9B chắc chắn cũng chậm tương tự nếu bật, "
            "sẽ tốn quota GPU Kaggle vô ích cho phần \"suy nghĩ\" mà ta không cần tới."
        ),
        code_cell(
            "import re\n"
            "\n"
            "GENERATION_SYSTEM_PROMPT = (\n"
            '    "Bạn là trợ lý giúp tạo dữ liệu huấn luyện cho 1 chatbot hỏi đáp về ứng dụng luyện thi "\n'
            '    "IELTS. Nhiệm vụ: đọc 1 đoạn tài liệu, đặt 1-2 câu hỏi TỰ NHIÊN mà 1 người dùng thật sự "\n'
            '    "có thể hỏi (không phải câu hỏi kiểu bài kiểm tra), và viết đáp án NGẮN GỌN dựa ĐÚNG "\n'
            '    "nội dung đoạn — không thêm thông tin ngoài đoạn, không bịa. Trả lời DUY NHẤT bằng JSON "\n'
            '    \'dạng [{"question": "...", "answer": "..."}, ...], không thêm chữ nào khác ngoài JSON.\'\n'
            ")\n"
            "\n"
            "\n"
            "def build_prompt(chunk: dict) -> str:\n"
            '    return (\n'
            f'        f"Đoạn tài liệu (nguồn: {{chunk[\'source\']}} — {{chunk[\'heading\']}}):\\n\\n"\n'
            f'        f"{{chunk[\'text\']}}\\n\\n"\n'
            '        "Đặt 1-2 câu hỏi + đáp án dựa đúng đoạn trên, trả lời bằng JSON."\n'
            "    )\n"
            "\n"
            "\n"
            "def extract_json_array(text: str) -> list:\n"
            '    """Model có thể bọc JSON trong ```json ... ``` hoặc thêm chữ thừa quanh — thử vài cách '
            'trước khi bỏ cuộc."""\n'
            "    text = text.strip()\n"
            '    fenced = re.search(r"```(?:json)?\\s*(\\[.*?\\])\\s*```", text, re.DOTALL)\n'
            "    if fenced:\n"
            "        text = fenced.group(1)\n"
            "    else:\n"
            '        bracket = re.search(r"\\[.*\\]", text, re.DOTALL)\n'
            "        if bracket:\n"
            "            text = bracket.group(0)\n"
            "    return json.loads(text)\n"
            "\n"
            "\n"
            "def generate_qa_for_chunk(chunk: dict, max_new_tokens: int = 600) -> list:\n"
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
        ),
        markdown_cell(
            "## 4. Smoke test — chỉ 2 đoạn trước (kiểm tra pipeline chạy đúng trước khi tốn cả phiên GPU)"
        ),
        code_cell(
            "for chunk in CHUNKS[:2]:\n"
            "    try:\n"
            "        pairs = generate_qa_for_chunk(chunk)\n"
            '        print(f"OK — {chunk[\'heading\']}: {len(pairs)} pairs")\n'
            "        print(json.dumps(pairs, ensure_ascii=False, indent=2))\n"
            "    except Exception as e:\n"
            '        print(f"LOI o \'{chunk[\'heading\']}\': {e}")\n'
            "        print(\"---\\n\")\n"
        ),
        markdown_cell(
            "**Dừng ở đây kiểm tra kết quả smoke test phía trên trước khi chạy tiếp.** Nếu 2 đoạn trên ra "
            "kết quả hợp lý (câu hỏi tự nhiên, đáp án đúng nội dung đoạn), chạy tiếp cell dưới cho toàn "
            "bộ 139 đoạn. Nếu lỗi, gửi lại thông báo lỗi để debug."
        ),
        markdown_cell("## 5. Chạy toàn bộ 139 đoạn (ước tính 20–40 phút trên GPU T4)"),
        code_cell(
            "results = []\n"
            "errors = []\n"
            "for i, chunk in enumerate(CHUNKS):\n"
            "    try:\n"
            "        pairs = generate_qa_for_chunk(chunk)\n"
            "        for pair in pairs:\n"
            '            results.append({"source": chunk["source"], "heading": chunk["heading"], **pair})\n'
            "    except Exception as e:\n"
            '        errors.append({"chunk_index": i, "heading": chunk["heading"], "error": str(e)})\n'
            "    if (i + 1) % 10 == 0:\n"
            '        print(f"{i + 1}/{len(CHUNKS)} xu ly xong, {len(results)} cap, {len(errors)} loi")\n'
            "\n"
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
