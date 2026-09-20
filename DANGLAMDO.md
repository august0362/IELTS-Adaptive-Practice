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

## Đã commit (chưa push)
`b138749` kế hoạch + checklist · `f81d6af` code nhóm A.
