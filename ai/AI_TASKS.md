# Chatbot AI — Danh sách việc

> Phạm vi: `ai/**` (model, RAG, training, server suy luận) + phần nối mỏng phía `web/` (`web/src/app/chat/`, `web/src/app/api/chat/`). Chi tiết đầy đủ (model chọn, lý do, cách sinh dữ liệu train, chia mốc) nằm ở [`AI_CHATBOT_PLAN.md`](../AI_CHATBOT_PLAN.md) và `PROJECT_CONTEXT.md` mục 11 — file này chỉ theo dõi *việc nào xong, việc nào chưa*. Đọc `PROGRESS.md` ở gốc dự án trước để biết trạng thái tổng quan.

## Milestone 6 — Hạ tầng + RAG (đang làm)

- [x] Dời app Next.js vào `web/`, tạo bộ khung `ai/`, sửa mọi path/config/script/tài liệu liên quan
- [x] Tự kiểm sau khi dời: `npm install` + `typecheck` + `lint` + `test` (148/148) + `test:e2e` (8/8) — tất cả xanh trong `web/`, việc dời không làm hỏng gì. Cài thêm Visual Studio Build Tools (workload C++) trên máy dev vì `better-sqlite3` cần biên dịch native và máy chưa có sẵn.
- [x] Cài Ollama (chạy model local qua HTTP API riêng, port 11434 mặc định) — dùng thay vì tự dựng llama.cpp thủ công, đơn giản hơn cho user chưa quen LLM
- [ ] `ollama pull qwen3.5:4b` (3.4GB, xác nhận có sẵn trên thư viện Ollama chính thức) + `ollama pull nomic-embed-text` (model embedding cho RAG, ~274MB)
- [ ] Thử vài câu hỏi tiếng Việt qua `ollama run qwen3.5:4b` để kiểm tra chất lượng đa ngôn ngữ thực tế — báo lại nếu kém, cân nhắc model khác
- [x] Route `POST web/src/app/api/chat/route.ts` — validate input, đọc `getChatContextSummary()` (DB của `web/`), gọi sang `ai/server/`, map lỗi 503/502 rõ ràng. Tự kiểm: `typecheck`/`lint` xanh.
- [x] Trang `web/src/app/chat/page.tsx` + `ChatWindow.tsx`, thêm "Chatbot" vào Nav. Component test `ChatWindow.test.tsx` (welcome message, gửi bằng nút/Enter, không gửi chuỗi rỗng, hiện lỗi khi API fail) — 148→(+5) test, xanh.
- [ ] `ai/server/` (Python/FastAPI): `main.py` (route `/chat`), `ollama_client.py` (gọi Ollama's `/api/generate` + `/api/embeddings`), `chunking.py` + `retrieval.py` (RAG thuần, có test pytest riêng không cần model thật), `build_index.py` (script chunk+embed `PROJECT_CONTEXT.md`/`USER_GUIDE.md`/`document.txt` vào `ai/data/processed/`)
- [ ] `ai/requirements.txt` + hướng dẫn chạy (venv, `uvicorn server.main:app --port 8787`) trong `ai/README.md`
- [ ] Nối thật: chạy `ai/server/` + Ollama, thử `/chat` từ trang `/chat` thật, xác nhận trả lời có dùng được ngữ cảnh DB + tài liệu
- [ ] Thêm 1 e2e case cho luồng chat (sau khi `ai/server/` ổn định) — xem PROJECT_CONTEXT.md mục 11.4 "Chưa làm"
- [ ] Tự kiểm cuối: `typecheck`/`lint`/`test`/`test:e2e` xanh trong `web/`; pytest xanh trong `ai/`
- [ ] Review chốt Milestone 6 (Supervisor, theo `CLAUDE.md`)

## Milestone 7 — Fine-tune (chưa bắt đầu)

- [ ] Soạn template câu hỏi tự động điền số liệu từ tài liệu dự án
- [ ] Chạy Qwen3.5-9B trên Kaggle sinh thêm cặp hỏi-đáp đa dạng (KHÔNG dùng Claude — xem lý do ở `AI_CHATBOT_PLAN.md` mục 6)
- [ ] Lọc dữ liệu (trùng lặp, sai, quá ngắn/dài)
- [ ] User duyệt ~30 mẫu ngẫu nhiên trước khi train
- [ ] Fine-tune LoRA/QLoRA trên Kaggle, tải adapter về
- [ ] Tích hợp adapter vào `ai/server/`, so sánh chất lượng trước/sau
- [ ] Review chốt Milestone 7

## Milestone 8 — Chấm Writing/Speaking theo IELTS (chưa bắt đầu)

- [ ] Tải faster-whisper (small/medium) vào `ai/models/`
- [ ] Khung chấm Writing: rubric 4 tiêu chí (Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy)
- [ ] Khung chấm Speaking: thu âm → faster-whisper (STT) → chấm 4 tiêu chí (Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation ở mức tương đối)
- [ ] Trang chấm riêng (không ghi DB, không đụng công thức Band — hiển thị tại chỗ)
- [ ] Review chốt Milestone 8
