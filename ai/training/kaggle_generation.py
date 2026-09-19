"""
Pure/testable logic for the Kaggle data-generation notebook
(ai/kaggle/generate_dataset_kaggle.ipynb, built by build_kaggle_notebook.py).

Kept as a real, importable, pytest-covered module — NOT re-typed by hand as
a string inside the notebook builder, after 2 real bugs shipped in
hand-typed notebook code that a test would have caught:
  1. A model loading/OOM issue (Qwen3.5-9B's hidden vision encoder) — not
     something a local test could catch (needs a real GPU), fixed by
     reverting to 1 GPU.
  2. extract_json_array() trusted whatever JSON shape the model returned
     without validating it — a real reply of ["câu hỏi 1", "câu hỏi 2"]
     (a list of strings, not {question, answer} objects) "parsed
     successfully" but then crashed the aggregation step downstream with
     `TypeError: 'str' object is not a mapping`, found live on Kaggle after
     20/37 chunks had already run, losing that work. THIS one is exactly the
     kind of bug a test on plain Python input/output would have caught
     immediately — hence this refactor.

build_kaggle_notebook.py embeds this file's source verbatim into the
notebook. GPU/model-specific code (loading the model, calling .generate())
stays notebook-only, since it can't be tested without a real GPU — but
everything that CAN be tested with plain Python objects lives here instead.
"""
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable

GENERATION_SYSTEM_PROMPT = (
    "Bạn là trợ lý giúp tạo dữ liệu huấn luyện cho 1 chatbot hỏi đáp về ứng dụng luyện thi "
    "IELTS. Nhiệm vụ: đọc 1 đoạn tài liệu, đặt 1-2 câu hỏi TỰ NHIÊN mà 1 người dùng thật sự "
    "có thể hỏi (không phải câu hỏi kiểu bài kiểm tra), và viết đáp án NGẮN GỌN dựa ĐÚNG "
    "nội dung đoạn — không thêm thông tin ngoài đoạn, không bịa. Trả lời DUY NHẤT bằng JSON "
    'dạng [{"question": "...", "answer": "..."}, ...], không thêm chữ nào khác ngoài JSON.'
)


def build_prompt(chunk: dict) -> str:
    return (
        f"Đoạn tài liệu (nguồn: {chunk['source']} — {chunk['heading']}):\n\n"
        f"{chunk['text']}\n\n"
        "Đặt 1-2 câu hỏi + đáp án dựa đúng đoạn trên, trả lời bằng JSON."
    )


def extract_json_array(text: str) -> list[dict]:
    """Parses + VALIDATES the model's reply. Raises ValueError on anything
    that isn't exactly a JSON array of {"question": str, "answer": str}
    objects, so a wrong-shaped reply is treated as "this chunk failed"
    (caught by process_one below) rather than silently flowing downstream
    as malformed data that crashes something else later — the real bug
    this module exists to regression-test.
    """
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)
    else:
        bracket = re.search(r"\[.*\]", text, re.DOTALL)
        if bracket:
            text = bracket.group(0)

    parsed = json.loads(text)
    if not isinstance(parsed, list):
        raise ValueError(f"Expected a JSON array, got {type(parsed).__name__}: {parsed!r}")
    for item in parsed:
        if not isinstance(item, dict) or not isinstance(item.get("question"), str) or not isinstance(item.get("answer"), str):
            raise ValueError(f"Expected {{'question': str, 'answer': str}} objects, got {item!r}")
    return parsed


GenerateFn = Callable[[dict, object], list[dict]]


def process_one(index_and_chunk: tuple[int, dict], generate_fn: GenerateFn, gpu_ids: list) -> dict:
    """1 task = 1 chunk, run on a fixed gpu id (round-robin by index).
    `generate_fn(chunk, gpu_id) -> list[dict]` is the actual model call,
    injected as a parameter so this stays testable without a real model."""
    index, chunk = index_and_chunk
    gpu_id = gpu_ids[index % len(gpu_ids)]
    try:
        pairs = generate_fn(chunk, gpu_id)
        return {"index": index, "source": chunk["source"], "heading": chunk["heading"], "pairs": pairs, "error": None}
    except Exception as e:
        return {"index": index, "source": chunk["source"], "heading": chunk["heading"], "pairs": [], "error": str(e)}


def run_parallel(chunks: list[dict], generate_fn: GenerateFn, gpu_ids: list, on_result: Callable[[dict], None] | None = None) -> list[dict]:
    """Runs `chunks` through `generate_fn`, 1 worker per gpu id (1 worker =
    sequential; N workers = N-way parallel, 1 gpu id per worker). Chunks are
    fully independent of each other, so processing them out of order (via
    as_completed) is safe — `on_result` is called as each one finishes, not
    in original order."""
    all_results = []
    with ThreadPoolExecutor(max_workers=len(gpu_ids)) as executor:
        futures = [executor.submit(process_one, (i, c), generate_fn, gpu_ids) for i, c in enumerate(chunks)]
        for future in as_completed(futures):
            r = future.result()
            all_results.append(r)
            if on_result:
                on_result(r)
    return all_results
