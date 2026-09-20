# DANGLAMDO.md — Đang làm dở (2026-09-20)

> Phiên mới: đọc file này trước. Chi tiết nằm ở các file được trỏ tới.

## Tình hình
- **Milestone 8 (chấm Writing/Speaking):** kế hoạch đã viết ở `AI_CHATBOT_PLAN.md` mục 13, **chờ user duyệt 6 câu hỏi dưới**. Nhóm A (code thuần, `ai/grading/`, 90 test xanh) **đã xong**. Chưa tải model, chưa đụng `web/`.
- **Milestone 7 (fine-tune):** do **phiên khác** làm (train lại vòng 2 trên Kaggle). **Không đụng.** Xem mục Milestone 7 trong `ai/AI_TASKS.md`.

## 6 câu hỏi chờ user (in đậm = mặc định; user chỉ cần nói "đồng ý mặc định")
1. Model chấm: **`qwen3.5:4b` gốc, biến riêng `GRADER_MODEL`** (không theo bản fine-tune của M7).
2. Nhận xét: **tiếng Việt, giữ trích dẫn tiếng Anh**.
3. Chế độ chấm: **1 chế độ "kỹ"** (chậm hơn, đáng tin hơn).
4. Task 1: **hỗ trợ cả Task 1 và Task 2** (Task 1 có cảnh báo vì model không thấy biểu đồ).
5. Speaking: **2 bước** (chuyển chữ → user sửa transcript → chấm).
6. User có bài viết đã được chấm điểm thật không? (để đo độ chính xác; không có vẫn làm được.)

## Việc tiếp theo
1. Hỏi user 6 câu trên. Có trả lời rồi thì ghi vào `ai/AI_TASKS.md` và sửa mục 13 cho khớp.
2. Nhóm B, bắt đầu B1: tra bản mô tả band **chính thức** trên ielts.org, soạn `ai/grading/rubric.py` (không soạn từ trí nhớ).
3. Nhóm C (tải faster-whisper, chạy thật): chỉ khi user đồng ý rõ **và** Milestone 7 không đang gộp model/chạy eval (tranh RAM/VRAM).

## Luật khi 2 phiên dùng chung thư mục
- Không sửa/commit file Milestone 7 (`ai/training/**` có sẵn, `ai/kaggle/`, `ai/data/`).
- Commit theo đường dẫn: `git commit -m "..." -- <đường dẫn>`. Không `-A`/`-a`, không đổi nhánh.
- File dùng chung (`AI_TASKS.md`, `PROGRESS.md`, `document.txt`): chỉ Edit/append đúng mục của mình, không ghi đè cả file.
- Mỗi lần dừng: cập nhật khối "ĐIỂM DỪNG Milestone 8" trong `ai/AI_TASKS.md`.

## Cần nhớ
- Chấm điểm chỉ hiển thị "ước lượng", **không ghi DB**, không đụng công thức Band.
- Không dùng Claude sinh dữ liệu train (`AI_CHATBOT_PLAN.md` mục 6).
- Test M8: `cd ai && .venv/Scripts/python -m pytest grading`. Chạy toàn bộ `ai/` có 2 test đỏ là của phiên M7 làm dở, không phải M8.
- `PROGRESS.md` hàng Milestone 7 đang lỗi thời — phiên M7 cập nhật.

## Chuyển cho phiên Milestone 7
- Docstring `ai/training/lora_train_script.py` ghi "giữ nguyên `adamw_torch` từ lần chạy tốt", nhưng theo git lần chạy tốt dùng `adamw_8bit`; `adamw_torch` mới thêm, chưa chạy thử → làm lẫn biến khi chẩn đoán độ chậm.
- Script gộp adapter + vá GGUF đã cứu vào `ai/training/export_tools/` (trước chỉ nằm trong thư mục tạm).

## Vì sao chọn mặc định như vậy
1. Bản fine-tune vòng 1 từng bịa tính năng và chưa được dạy chấm điểm; M7 đổi model chat không nên tự đổi model chấm.
2. User là người Việt học IELTS; giữ trích dẫn tiếng Anh để đối chiếu với bài.
3. Chấm cần suy luận; tắt suy luận dễ chấm sai. Thêm nút "nhanh" sau nếu cần.
4. Task 1 là dạng đề phổ biến; chỉ cần cảnh báo, không nên bỏ.
5. Lỗi nhận dạng giọng nói sẽ bị tính nhầm thành lỗi ngữ pháp → cho sửa transcript trước khi chấm.
6. Chỉ có điểm thật mới đo được model chấm đúng đến đâu.

## Bối cảnh cuộc chat (vì sao có file này)
- User hỏi Milestone 7 làm tới đâu, rồi muốn train 2 GPU cho nhanh. Khuyên **chưa**: 2 GPU đã thử và tệ hơn; bản 1 GPU cũng chậm dần → nguyên nhân chậm chưa rõ, thêm GPU không giải quyết.
- User hỏi làm song song 2 milestone được không → được, vì M7 đang chờ Kaggle. Chốt: M7 giao **phiên khác**, phiên này làm M8.
- User yêu cầu: viết kế hoạch M8 để duyệt; làm trước task không xung đột M7; **phải ghi tiến trình vào file** để phiên sau biết đường làm tiếp; viết ngắn, tiếng Việt, tiết kiệm token.

## Tóm tắt Milestone 7 (chỉ để biết, không làm)
- Vòng 1: train xong (58 mẫu), gộp thành `qwen3.5-4b-project` trong Ollama. Đánh giá: nhanh ~2,9 lần, đúng giọng, nhưng **bịa tính năng không có thật** và sai chi tiết 4/6 câu → **chưa nên đổi `CHAT_MODEL`**.
- Vòng 2: thêm 23 mẫu "từ chối trung thực" → 81 mẫu. Train lại trên Kaggle **chậm dần** (1 GPU: 28/53 bước sau ~2 giờ; 2 GPU: 22/57 bước sau ~2 giờ). Đã bỏ hướng 2 GPU. Nguyên nhân **chưa xác định** (nghi: VRAM T4 gần đầy hoặc Kaggle giới hạn tài nguyên; cảnh báo `MatMul8bitLt` tràn output là nghi vấn yếu hơn).
- Phiên M7 đang thử cách mới: chạy train như tiến trình riêng + ghi số đo từng bước để chẩn đoán (`ai/training/lora_train_script.py`, `kaggle_process_runner.py`, chưa commit).
- Còn lại: train xong → tải adapter → gộp + GGUF (`ai/training/export_tools/`) → chạy lại eval → user quyết đổi `CHAT_MODEL` → review chốt.

## Thiết kế Milestone 8 trong 8 dòng
- **Writing:** dán bài → code đếm từ → prompt rubric → Ollama → **code** kiểm JSON, kẹp band 0–9 bước 0,5, bỏ trích dẫn bịa, **tự tính band tổng** (làm tròn IELTS) → hiển thị "ước lượng".
- **Speaking:** ghi âm → `faster-whisper` (CPU, int8, có mốc thời gian từng từ) → transcript + số đo (tốc độ, ngắt nghỉ, từ đệm) do **code** đo → user sửa transcript → chấm như Writing.
- **API đề xuất:** `/api/grade/writing`, `/api/grade/speaking/transcribe`, `/api/grade/speaking` (chi tiết ở mục 13.4).
- **Giao diện:** trang mới `/grading` (2 tab), Nav thêm "Chấm điểm". Âm thanh không lưu, mọi thứ chạy trên máy.
- **Giới hạn phải ghi rõ:** Pronunciation chỉ đoán thô (Whisper hay tự sửa phát âm sai); Task 1 model không thấy biểu đồ.
- **Kiểm độ tin cậy (13.5):** chấm 1 bài 3 lần xem có nhất quán không; bài tốt vs bài cố tình làm tệ; so với điểm thật nếu có.
- **faster-whisper (đã tra):** không cần cài FFmpeg; trường `probability` của từ **chưa xác nhận** — kiểm lúc cài.
- **Để sau (đã ghi `document.txt`):** fine-tune bộ chấm, lưu DB, gộp Task 1+2.

## Code đã có và việc B còn lại
- `ai/grading/`: `schema.py` (kiểm JSON, kẹp band, lọc trích dẫn bịa, tính band tổng), `text_stats.py` (đếm từ; tối thiểu Task 1 = 150, Task 2 = 250), `speaking_metrics.py` (tốc độ, ngắt nghỉ, từ đệm, độ tin cậy). Test ở `ai/grading/tests/`.
- Nhóm B: B1 rubric · B2 `ollama_client.chat(model=...)` + `GRADER_MODEL` · B3 `ai/server/grading_router.py` · B4 ghi hợp đồng API vào `PROJECT_CONTEXT.md` · B5 phía `web/` (route + trang Writing + test) · B6 cập nhật `CLAUDE.md`, `USER_GUIDE.md`.

## Đã commit (chưa push)
`b138749` kế hoạch + checklist · `f81d6af` code nhóm A.
