# ai/ — Chatbot AI

Module độc lập, không import gì từ `web/src/` và ngược lại — chỉ nói chuyện qua HTTP. Xem [`../AI_CHATBOT_PLAN.md`](../AI_CHATBOT_PLAN.md) cho toàn bộ phạm vi/quyết định, [`../PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md) mục 11 cho kiến trúc, [`AI_TASKS.md`](./AI_TASKS.md) cho checklist.

```
models/       # Ollama tự quản model (không tải file .gguf thủ công vào đây)
data/
  raw/        # tài liệu nguồn thêm cho RAG/train sau này — gitignore
  processed/  # doc_index.json do build_index.py sinh ra — gitignore
training/     # script Python sinh dữ liệu train + build các notebook Kaggle (Milestone 7)
kaggle/       # notebook .ipynb sinh ra bởi training/build_*.py — tải thẳng lên Kaggle,
              # gitignore (tái tạo bằng script, không sửa tay file .ipynb)
server/       # FastAPI — RAG + gọi Ollama, web/ gọi vào đây qua HTTP
  chunking.py     # chunk markdown thành đoạn nhỏ (pure, có test)
  retrieval.py    # cosine similarity + top-k (pure, có test)
  prompt.py       # ghép system prompt từ đoạn RAG + dbContext (pure, có test)
  ollama_client.py  # gọi Ollama API (embeddings + chat) — không test trực tiếp
  build_index.py    # script sinh doc_index.json từ PROJECT_CONTEXT.md/USER_GUIDE.md/document.txt
  main.py           # FastAPI app, route POST /chat + GET /health
  tests/            # pytest cho phần logic thuần ở trên
```

## Chạy

Cần cài sẵn [Ollama](https://ollama.com) và đã `ollama pull qwen3.5:4b` + `ollama pull nomic-embed-text` (Ollama tự chạy server riêng ở `127.0.0.1:11434`).

```bash
cd ai
python -m venv .venv
./.venv/Scripts/pip install -r requirements.txt      # Windows; macOS/Linux: .venv/bin/pip

# 1 lần, hoặc mỗi khi PROJECT_CONTEXT.md/USER_GUIDE.md/document.txt đổi:
./.venv/Scripts/python -m server.build_index

# chạy server (mặc định port 8787, đúng như web/'s AI_SERVER_URL mong đợi):
./.venv/Scripts/uvicorn server.main:app --host 127.0.0.1 --port 8787
```

Tự kiểm phần logic thuần (không cần Ollama chạy): `./.venv/Scripts/python -m pytest` từ thư mục `ai/`.

**Trạng thái:** Milestone 6 (+ mở rộng: đổi tên Navita, bình chat nổi, 3 chế độ, lịch sử hội thoại) đã xong. Đang làm Milestone 7 (fine-tune) — xem `AI_TASKS.md`.
