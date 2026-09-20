"""
Assembles ai/kaggle/generate_negative_data_kaggle.ipynb — Milestone 7
follow-up (AI_TASKS.md, after eval found a real, serious failure): runs
Qwen3.5-9B on Kaggle's free GPU to generate NEGATIVE (honest-refusal)
training examples, teaching the chatbot to say "không chắc" instead of
inventing facts for questions its documentation doesn't actually cover —
a behavior the original 58-example dataset never taught at all (every one
of those examples is a real question with a real, documented answer).

Same model, same 1-GPU/4-bit setup, same 37 filtered chunks
(data/processed/doc_chunks_for_kaggle.json) as generate_dataset_kaggle.ipynb
(build_kaggle_notebook.py) — only the generation task given to the model
differs (kaggle_negative_generation.py's prompt, not kaggle_generation.py's).
Embeds BOTH tested modules' source verbatim (kaggle_generation.py first,
since kaggle_negative_generation.py's shared helpers — extract_json_array,
process_one, run_parallel — are re-exported from it) rather than
hand-typing equivalent logic into the notebook, same reasoning as
build_kaggle_notebook.py's docstring (2 of 3 real Kaggle bugs this
milestone came from exactly that anti-pattern).

kaggle_negative_generation.py's own `from training.kaggle_generation import
...` line is stripped before embedding — that package path doesn't exist
in a flat Kaggle notebook, and isn't needed there since
kaggle_generation.py's cell already defines those names in the same global
namespace.

Run from ai/:  python -m training.build_negative_data_notebook
"""
import json
from pathlib import Path

CHUNKS_PATH = Path(__file__).resolve().parents[1] / "data" / "processed" / "doc_chunks_for_kaggle.json"
KAGGLE_GENERATION_SOURCE_PATH = Path(__file__).resolve().parent / "kaggle_generation.py"
KAGGLE_NEGATIVE_GENERATION_SOURCE_PATH = Path(__file__).resolve().parent / "kaggle_negative_generation.py"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "kaggle" / "generate_negative_data_kaggle.ipynb"

IMPORT_LINE = "from training.kaggle_generation import extract_json_array, process_one, run_parallel  # noqa: F401  (re-exported for notebook embedding)\n"


def code_cell(source: str) -> dict:
    return {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": source.splitlines(keepends=True)}


def markdown_cell(source: str) -> dict:
    return {"cell_type": "markdown", "metadata": {}, "source": source.splitlines(keepends=True)}


def build_notebook() -> dict:
    chunks_json = CHUNKS_PATH.read_text(encoding="utf-8")
    chunk_count = len(json.loads(chunks_json))
    kaggle_generation_source = KAGGLE_GENERATION_SOURCE_PATH.read_text(encoding="utf-8")
    negative_source_raw = KAGGLE_NEGATIVE_GENERATION_SOURCE_PATH.read_text(encoding="utf-8")
    if IMPORT_LINE not in negative_source_raw:
        raise ValueError(
            "kaggle_negative_generation.py's import line changed or is missing — "
            "update IMPORT_LINE above to match before embedding into the notebook."
        )
    negative_source = negative_source_raw.replace(IMPORT_LINE, "")

    cells = [
        markdown_cell(
            "# Milestone 7 (bổ sung) — Sinh dữ liệu \"từ chối trung thực\" bằng Qwen3.5-9B\n"
            "\n"
            "**Trước khi Run All:** bật GPU — `Settings` → `Accelerator` → **GPU T4** (1 GPU, "
            "giống notebook sinh dữ liệu gốc — xem lý do ở đó).\n"
            "\n"
            "**Vì sao cần notebook này**: đánh giá thật sau khi fine-tune lần 1 phát hiện lỗi "
            "nghiêm trọng — hỏi 1 tính năng KHÔNG có thật, model fine-tune khẳng định chắc "
            "nịch là có (bịa), trong khi bản gốc trả lời đúng \"không chắc\". Nguyên nhân: "
            "58 mẫu train gốc toàn là câu hỏi có đáp án thật, không có mẫu nào dạy \"không "
            "chắc thì nói không chắc\". Notebook này sinh thêm loại mẫu đó — KHÔNG dùng Claude "
            "để viết (đúng nguyên tắc mục 6 của `AI_CHATBOT_PLAN.md`), dùng lại đúng model "
            f"Qwen3.5-9B đã dùng ở bước sinh dữ liệu gốc, trên cùng {chunk_count} đoạn tài liệu.\n"
            "\n"
            "Chạy xong, tải file `negative_qa.jsonl` về đặt vào `ai/kaggle/` rồi báo lại."
        ),
        code_cell("!pip install -q -U transformers accelerate bitsandbytes\n"),
        markdown_cell("## 1. Dữ liệu đoạn tài liệu (đã nhúng sẵn, giống notebook sinh dữ liệu gốc)"),
        code_cell("import json\n\nCHUNKS = json.loads(r'''" + chunks_json + "''')\nprint(f\"Loaded {len(CHUNKS)} chunks\")\n"),
        markdown_cell("## 2. Tải model (4-bit, 1 GPU) — giống hệt notebook sinh dữ liệu gốc"),
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
            "MODELS = {0: model}\n"
            'print("Da tai xong model.")\n'
        ),
        markdown_cell(
            "## 3. Hàm sinh câu hỏi \"bẫy\" + từ chối trung thực (đã kiểm bằng test pytest thật "
            "trên máy — không gõ tay lại ở đây, nhúng nguyên văn `ai/training/kaggle_generation.py` "
            "rồi `ai/training/kaggle_negative_generation.py`)"
        ),
        code_cell(kaggle_generation_source),
        code_cell(negative_source),
        markdown_cell(
            "## 4. Nối vào model thật + Smoke test — chỉ 2 đoạn trước (kiểm tra pipeline trước khi "
            "tốn cả phiên GPU)\n"
            "\n"
            "**Lưu ý khi đọc kết quả**: mỗi chunk chỉ được cho xem đúng nội dung của chính nó, không "
            "thấy 36 đoạn còn lại — câu hỏi \"bẫy\" mà model tạo ra có thể (hiếm khi) trùng với nội "
            "dung một đoạn KHÁC (tức là thật ra đã có đáp án ở nơi khác), nên **bắt buộc phải người "
            "duyệt lại** trước khi đưa vào tập train, giống hệt bước duyệt 58 mẫu gốc."
        ),
        code_cell(
            "def generate_negative_for_chunk(chunk: dict, gpu_id, max_new_tokens: int = 400) -> list:\n"
            "    model = MODELS[gpu_id]\n"
            "    messages = [\n"
            '        {"role": "system", "content": NEGATIVE_GENERATION_SYSTEM_PROMPT},\n'
            '        {"role": "user", "content": build_negative_prompt(chunk)},\n'
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
            "            temperature=0.8,\n"
            "            pad_token_id=tokenizer.eos_token_id,\n"
            "        )\n"
            "    reply = tokenizer.decode(output_ids[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)\n"
            "    return extract_json_array(reply)\n"
            "\n"
            "\n"
            "GPU_IDS = list(MODELS.keys())\n"
            "\n"
            "smoke_results = run_parallel(CHUNKS[:2], generate_negative_for_chunk, GPU_IDS)\n"
            "for r in sorted(smoke_results, key=lambda r: r[\"index\"]):\n"
            "    if r[\"error\"]:\n"
            '        print(f"LOI o \'{r[\'heading\']}\': {r[\'error\']}")\n'
            "    else:\n"
            '        print(f"OK — {r[\'heading\']}: {len(r[\'pairs\'])} pairs")\n'
            "        print(json.dumps(r[\"pairs\"], ensure_ascii=False, indent=2))\n"
            "    print(\"---\\n\")\n"
        ),
        markdown_cell(
            "**Dừng ở đây kiểm tra kết quả smoke test phía trên trước khi chạy tiếp.** Câu hỏi có "
            "tự nhiên không, câu trả lời có thực sự từ chối (không bịa thông tin) không? Nếu ổn, "
            f"chạy tiếp cell dưới cho toàn bộ {chunk_count} đoạn."
        ),
        markdown_cell(f"## 5. Chạy toàn bộ {chunk_count} đoạn (1 GPU — ước tính 10–20 phút)"),
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
            "run_parallel(CHUNKS, generate_negative_for_chunk, GPU_IDS, on_result=collect)\n"
            'print(f"\\nXong: {len(results)} cap hoi-dap tu choi, {len(errors)} doan bi loi (bo qua)")\n'
        ),
        markdown_cell("## 6. Lưu kết quả — tải file này về rồi gửi lại cho Claude"),
        code_cell(
            "OUTPUT_FILE = \"negative_qa.jsonl\"\n"
            "with open(OUTPUT_FILE, \"w\", encoding=\"utf-8\") as f:\n"
            "    for r in results:\n"
            "        f.write(json.dumps(r, ensure_ascii=False) + \"\\n\")\n"
            "\n"
            "if errors:\n"
            "    with open(\"negative_generation_errors.json\", \"w\", encoding=\"utf-8\") as f:\n"
            "        json.dump(errors, f, ensure_ascii=False, indent=2)\n"
            '    print(f"Co {len(errors)} doan bi loi, xem negative_generation_errors.json")\n'
            "\n"
            "from IPython.display import FileLink\n"
            "display(FileLink(OUTPUT_FILE))\n"
            'print("Tai file negative_qa.jsonl o tren (hoac trong tab Output ben phai) roi gui lai cho Claude.")\n'
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
