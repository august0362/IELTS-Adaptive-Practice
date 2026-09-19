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
    chunk_count = len(json.loads(chunks_json))

    cells = [
        markdown_cell(
            "# Milestone 7 — Sinh dữ liệu train bằng Qwen3.5-9B\n"
            "\n"
            "**Trước khi Run All:** bật GPU — `Settings` (bảng bên phải) → `Accelerator` → chọn "
            "**GPU T4 x2** (hoặc P100). Không bật GPU thì cell load model sẽ rất chậm hoặc lỗi hết bộ nhớ.\n"
            "\n"
            f"Notebook này **không cần bạn upload thêm gì** — {chunk_count} đoạn tài liệu của dự án đã được nhúng "
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
            "## 3. Hàm sinh câu hỏi–đáp cho 1 đoạn\n"
            "\n"
            "`enable_thinking=False` quan trọng — đo thật ở Milestone 6: cùng 1 prompt mất 73.7s "
            "(thinking bật) so với 1.1s (tắt) trên Qwen3.5-4B. 9B chắc chắn cũng chậm tương tự nếu bật, "
            "sẽ tốn quota GPU Kaggle vô ích cho phần \"suy nghĩ\" mà ta không cần tới.\n"
            "\n"
            "Dùng `ThreadPoolExecutor` với đúng 1 worker (1 GPU — xem mục 2) — giữ lại cấu trúc \"chạy "
            "theo hàng đợi\" này thay vì vòng lặp trần trụi, để nếu sau này Kaggle cấp đủ bộ nhớ cho 2 GPU "
            "hoặc đổi sang model nhỏ hơn, chỉ cần thêm lại 1 dòng nạp model thứ 2 vào `MODELS` là chạy "
            "song song được ngay, không phải viết lại phần này."
        ),
        code_cell(
            "import re\n"
            "from concurrent.futures import ThreadPoolExecutor, as_completed\n"
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
            "GPU_IDS = list(MODELS.keys())  # e.g. [0, 1] voi 2 GPU, [None] neu chay CPU\n"
            "\n"
            "\n"
            "def process_one(index_and_chunk):\n"
            '    """1 task = 1 doan, chay tren dung 1 GPU co dinh (chia deu theo index) — dung cho ca'
            " smoke test lan chay that.\"\"\"\n"
            "    index, chunk = index_and_chunk\n"
            "    gpu_id = GPU_IDS[index % len(GPU_IDS)]\n"
            "    try:\n"
            "        pairs = generate_qa_for_chunk(chunk, gpu_id)\n"
            '        return {"index": index, "source": chunk["source"], "heading": chunk["heading"], "pairs": pairs, "error": None}\n'
            "    except Exception as e:\n"
            '        return {"index": index, "source": chunk["source"], "heading": chunk["heading"], "pairs": [], "error": str(e)}\n'
            "\n"
            "\n"
            "def run_parallel(chunks, on_result=None):\n"
            '    """Chay danh sach chunks song song, moi luong 1 GPU. on_result(result) duoc goi ngay '
            'khi 1 doan xu ly xong (khong theo thu tu)."""\n'
            "    all_results = []\n"
            "    with ThreadPoolExecutor(max_workers=len(GPU_IDS)) as executor:\n"
            "        futures = [executor.submit(process_one, (i, c)) for i, c in enumerate(chunks)]\n"
            "        for future in as_completed(futures):\n"
            "            r = future.result()\n"
            "            all_results.append(r)\n"
            "            if on_result:\n"
            "                on_result(r)\n"
            "    return all_results\n"
        ),
        markdown_cell(
            "## 4. Smoke test — chỉ 2 đoạn trước (kiểm tra pipeline chạy đúng trước khi tốn cả phiên GPU)"
        ),
        code_cell(
            "smoke_results = run_parallel(CHUNKS[:2])\n"
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
            "run_parallel(CHUNKS, on_result=collect)\n"
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
