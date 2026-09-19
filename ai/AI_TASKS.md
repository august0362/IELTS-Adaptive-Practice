# Chatbot AI — Danh sách việc

> Phạm vi: `ai/**` (model, RAG, training, server suy luận) + phần nối mỏng phía `web/` (`web/src/app/chat/`, `web/src/app/api/chat/`). Chi tiết đầy đủ (model chọn, lý do, cách sinh dữ liệu train, chia mốc) nằm ở [`AI_CHATBOT_PLAN.md`](../AI_CHATBOT_PLAN.md) và `PROJECT_CONTEXT.md` mục 11 — file này chỉ theo dõi *việc nào xong, việc nào chưa*. Đọc `PROGRESS.md` ở gốc dự án trước để biết trạng thái tổng quan.

## Milestone 6 — Hạ tầng + RAG (đang làm)

- [x] Dời app Next.js vào `web/`, tạo bộ khung `ai/`, sửa mọi path/config/script/tài liệu liên quan
- [x] Tự kiểm sau khi dời: `npm install` + `typecheck` + `lint` + `test` (148/148) + `test:e2e` (8/8) — tất cả xanh trong `web/`, việc dời không làm hỏng gì. Cài thêm Visual Studio Build Tools (workload C++) trên máy dev vì `better-sqlite3` cần biên dịch native và máy chưa có sẵn.
- [ ] Tải Qwen3.5-4B-Instruct (GGUF 4-bit) vào `ai/models/`
- [ ] Dựng server suy luận (`ai/server/`) chạy model qua llama.cpp/Ollama, expose 1 API nội bộ (HTTP, chỉ nghe localhost)
- [ ] Thử vài câu hỏi tiếng Việt để kiểm tra chất lượng đa ngôn ngữ thực tế của Qwen3.5-4B — báo lại nếu kém, cân nhắc model khác
- [ ] Dựng pipeline RAG: chunk hóa `PROJECT_CONTEXT.md`/`USER_GUIDE.md`/`document.txt` + đọc DB (nhật ký, lịch sử, Cambridge) làm ngữ cảnh động
- [ ] Route `POST web/src/app/api/chat/route.ts` — nhận câu hỏi, lấy ngữ cảnh RAG, gọi sang `ai/server/`, trả lời
- [ ] Trang `web/src/app/chat/page.tsx` — giao diện chat đơn giản, thêm vào Nav
- [ ] Tự kiểm: `typecheck`/`lint`/`test` xanh trong `web/` sau khi dời + sau khi thêm route/trang mới
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
