# export_tools — gộp adapter + vá GGUF (Milestone 7)

Lưu vào repo ngày 2026-09-20. Trước đó 2 script này **chỉ nằm trong thư mục tạm** của 1 phiên làm việc cũ (`%LOCALAPPDATA%\Temp\claude\...\scratchpad\`) — chưa commit, dễ bị dọn mất. Chép nguyên văn, không sửa logic; đường dẫn tuyệt đối cứng trong file là của máy dev này.

Dùng ở bước "Convert GGUF + gộp vào Ollama" của Milestone 7 (`ai/AI_TASKS.md`). Quy trình đã chạy thật thành công ở lần train đầu (58 mẫu), theo thứ tự:

1. **`merge_adapter.py`** — nạp `Qwen/Qwen3.5-4B` gốc (bf16, tải ~9.3GB nếu chưa có cache) + adapter LoRA ở `ai/training/output/`, `merge_and_unload()`, lưu ra `ai/training/output/merged/`. Chạy CPU được, không cần GPU. Cần venv có `torch`, `transformers`, `peft`.
2. **Convert sang GGUF** bằng `convert_hf_to_gguf.py` của llama.cpp (`--outtype q8_0` để vừa GPU 4GB, ra ~4.5GB). llama.cpp **không nằm trong repo** — `git clone https://github.com/ggml-org/llama.cpp`, cài `gguf-py` của nó. *Lệnh chính xác từng chạy không được ghi lại; dùng cú pháp chuẩn và kiểm `--help`.*
3. **Vá metadata GGUF** — bắt buộc, nếu không Ollama báo `tensor 'blk.32.attn_norm.weight' not found` rồi `blk.31.nextn.eh_proj.weight not found`. Nguyên nhân: Qwen3.5 có 1 khối MTP không dùng tới, file GGUF khai dư. Vá 3 chỗ:
   - `qwen35.block_count` 33 → 32 (dùng `gguf_set_metadata.py` trong `llama.cpp/gguf-py/gguf/scripts/`);
   - **`fix_gguf_block_count.py`** — cắt mảng `qwen35.attention.recurrent_layers` từ 33 xuống 32 phần tử, ghi ra `*.fixed.gguf` (có `assert` đúng 33 phần tử trước khi cắt);
   - `qwen35.nextn_predict_layers` 1 → 0 (cũng bằng `gguf_set_metadata.py`).
   *Thứ tự chính xác giữa 3 bước này được dựng lại từ docstring script + ghi chú `AI_TASKS.md`, không phải từ lệnh đã lưu.*
4. `ollama create qwen3.5-4b-project -f Modelfile` (`Modelfile` nằm ở `ai/training/output/`, chỉ trỏ `FROM` tới file GGUF đã vá).

Đã kiểm tra: model tạo ra chạy được và trả lời tiếng Việt sạch (xem `AI_TASKS.md`, Milestone 7).
