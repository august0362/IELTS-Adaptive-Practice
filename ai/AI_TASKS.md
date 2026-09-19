# Chatbot AI — Danh sách việc

> Phạm vi: `ai/**` (model, RAG, training, server suy luận) + phần nối mỏng phía `web/` (`web/src/app/chat/`, `web/src/app/api/chat/`). Chi tiết đầy đủ (model chọn, lý do, cách sinh dữ liệu train, chia mốc) nằm ở [`AI_CHATBOT_PLAN.md`](../AI_CHATBOT_PLAN.md) và `PROJECT_CONTEXT.md` mục 11 — file này chỉ theo dõi *việc nào xong, việc nào chưa*. Đọc `PROGRESS.md` ở gốc dự án trước để biết trạng thái tổng quan.

## Milestone 6 — Hạ tầng + RAG (đang làm)

- [x] Dời app Next.js vào `web/`, tạo bộ khung `ai/`, sửa mọi path/config/script/tài liệu liên quan
- [x] Tự kiểm sau khi dời: `npm install` + `typecheck` + `lint` + `test` (148/148) + `test:e2e` (8/8) — tất cả xanh trong `web/`, việc dời không làm hỏng gì. Cài thêm Visual Studio Build Tools (workload C++) trên máy dev vì `better-sqlite3` cần biên dịch native và máy chưa có sẵn.
- [x] Cài Ollama (chạy model local qua HTTP API riêng, port 11434 mặc định) — dùng thay vì tự dựng llama.cpp thủ công, đơn giản hơn cho user chưa quen LLM
- [x] `ollama pull qwen3.5:4b` (3.4GB) + `ollama pull nomic-embed-text` (274MB) — cả 2 xác nhận có sẵn trên thư viện Ollama chính thức, tải xong thật trên máy user
- [x] Thử câu hỏi tiếng Việt qua `/chat` thật — chất lượng tốt, trả lời đúng và mạch lạc (xem ví dụ ở mục 11.4)
- [x] Route `POST web/src/app/api/chat/route.ts` — validate input, đọc `getChatContextSummary()` (DB của `web/`), gọi sang `ai/server/`, map lỗi 503/502 rõ ràng, timeout 120s (xem phát hiện độ trễ bên dưới). Tự kiểm: `typecheck`/`lint` xanh.
- [x] Trang `web/src/app/chat/page.tsx` + `ChatWindow.tsx` (có ghi chú "có thể mất khoảng 1 phút" khi đang chờ), thêm "Chatbot" vào Nav. Component test `ChatWindow.test.tsx` (5 case) — 153/153 test xanh.
- [x] `ai/server/` (Python/FastAPI): `main.py` (route `/chat` + `/health`), `ollama_client.py` (gọi Ollama `/api/chat` + `/api/embeddings`, `think: false` — xem phát hiện bên dưới), `chunking.py` + `retrieval.py` + `prompt.py` (RAG thuần, có test pytest không cần model thật — 19 test, xanh), `build_index.py` (chunk+embed `PROJECT_CONTEXT.md`/`USER_GUIDE.md`/`document.txt` → `ai/data/processed/doc_index.json`, 139 đoạn)
- [x] `ai/requirements.txt` + `ai/README.md` (hướng dẫn chạy) + `ai/start-server.bat` (script 1 chạm, theo đúng kiểu `start-app.bat` đã có)
- [x] Nối thật: chạy `ai/server/` + Ollama, thử `/chat` từ server thật (không phải mock) với câu hỏi về công thức Band — trả lời đúng, có trích dẫn đúng nội dung `PROJECT_CONTEXT.md`
- [x] Thêm e2e case cho luồng chat (`chat.spec.ts`) — dùng **AI server giả lập** (`mockAiServer.ts`, `playwright.config.ts` giờ chạy 2 `webServer` song song) thay vì Ollama thật, để bộ e2e không phụ thuộc máy khác có cài Ollama hay không và không bị chậm/không ổn định — xem "Phát hiện quan trọng" bên dưới về lý do
- [x] Tự kiểm cuối: `typecheck`/`lint` sạch, `test` 153/153, `test:e2e` 9/9 (thêm `chat.spec.ts`) xanh trong `web/`; `pytest` 19/19 xanh trong `ai/`
- [x] Review chốt Milestone 6 (Supervisor, theo `CLAUDE.md`) — 1 finding nhỏ (doc lỗi thời: `PROJECT_CONTEXT.md` mục 11.4 còn ghi "60s" thay vì "120s"), đã sửa, không cần vòng review thứ 2. **MILESTONE 6 XONG.**

### Phát hiện quan trọng khi nối thật (đọc trước khi đụng vào `ai/server/ollama_client.py`)

1. **Qwen3.5 bật "thinking mode" mặc định** — model tự sinh cả đoạn suy luận dài trước khi trả lời, kể cả câu hỏi cực đơn giản. Đo trực tiếp trên máy user (RTX 3050 4GB): cùng 1 câu hỏi ngắn mất **73.7 giây** (thinking bật) so với **1.1 giây** (thinking tắt qua tham số `"think": false` trong request `/api/chat` của Ollama) — nhanh hơn ~65 lần. `ollama_client.py` đã set `think: false` cứng — **đừng bỏ dòng này** nếu sau này sửa file đó.
2. **Độ trễ thật với RAG:** 1 câu hỏi thật về công thức Band (có kèm 4 đoạn tài liệu RAG trong prompt) mất **~46 giây** kể cả khi đã tắt thinking — do model 4B chạy trên GPU 4GB + phải xử lý prompt dài hơn. Timeout đã đặt 120s ở cả `web/`'s route và `ai/server/ollama_client.py` để có biên an toàn. Đây là đặc điểm thật của phần cứng, không phải lỗi — đã ghi UI (mục "đang trả lời...") để user không tưởng bị treo.
3. **`chunk_markdown` có 1 lỗi thật đã sửa:** đoạn văn đơn lẻ dài hơn `max_chars` (không có dòng trống bên trong) từng bị bỏ qua không tách nhỏ, khiến `nomic-embed-text` từ chối với lỗi "input length exceeds the context length" khi build index thật (gặp ở 1 đoạn trong mục 9 `PROJECT_CONTEXT.md`). Đã sửa + thêm test (`test_splits_a_single_oversized_paragraph_on_sentence_boundaries` và 2 test liên quan).

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
