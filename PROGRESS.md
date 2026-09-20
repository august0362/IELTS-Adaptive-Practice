# PROGRESS.md — Bảng điều phối trung tâm

> Đọc file này đầu tiên khi bắt đầu 1 phiên làm việc mới, trước khi đọc bất cứ thứ gì khác. File cho biết dự án đang tới đâu và việc kế tiếp là gì, khỏi cần lục lại lịch sử git. Muốn biết *luật làm việc*, xem [`CLAUDE.md`](./CLAUDE.md). Muốn biết *chi tiết kỹ thuật* (schema, công thức, hình dạng API), xem [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md). Muốn biết *lịch sử xây dựng chi tiết* (lỗi từng gặp, quyết định đã chốt, theo từng milestone), xem [`document.txt`](./document.txt).

---

## Trạng thái hiện tại

**Milestone 6 + phần mở rộng (Chatbot AI "Navita") XONG.** App gốc (Milestone 1–5 mở rộng) đã dời vào [`web/`](./web/) để module hóa, chatbot AI nằm riêng trong [`ai/`](./ai/) — 2 module độc lập. Chatbot tên **Navita**, chạy được thật (không phải mock): Ollama + Qwen3.5-4B + RAG, có **3 chế độ Flash/Thinking/Pro**, **bình chat nổi** trên mọi trang (trừ `/chat`), **lịch sử nhiều cuộc hội thoại lưu DB**. Phần mở rộng qua 1 vòng review chốt tìm ra 2 lỗi race condition thật (mất câu trả lời khi xóa cuộc hội thoại đang chờ; câu trả lời rò sang cuộc khác khi chuyển giữa chừng) — đã sửa hết, xác nhận lại xanh. Toàn bộ ngữ cảnh/quyết định (phạm vi, model chọn, cách sinh dữ liệu train, lý do pháp lý loại phương án dùng Claude sinh data, các phát hiện quan trọng lúc build...) nằm ở **[`AI_CHATBOT_PLAN.md`](./AI_CHATBOT_PLAN.md) + [`ai/AI_TASKS.md`](./ai/AI_TASKS.md) — đọc trước khi tiếp tục bất cứ việc gì liên quan chatbot**, kể cả khi ngữ cảnh hội thoại đã mất.

**Trước Milestone 6:** cả 5 milestone (+ Milestone 5 mở rộng) đều Xong. Mới nhất trước khi có chatbot — Milestone 5 mở rộng: công thức Band v2 (EWMA thay cho trung bình phẳng, + thành phần % câu đúng khi luyện tập cho Reading/Listening — 65% Cambridge + 30% % đúng + 5% tần suất cho R/L, 65% Cambridge + 35% tần suất cho W/S), tách giao diện web/ứng dụng (khung ngoài luôn sáng, chỉ nội dung theo theme), sửa theme tối (nền xám đậm + glow thay vì gần đen), và 1 lỗi thật phát hiện khi user dùng app: random hàng tuần luôn chọn Reading rồi Listening do lỗi so sánh `NaN`. Xem `PROJECT_CONTEXT.md` mục 5.4/5.12/9; `document.txt` có log đầy đủ.

**Cách dùng chatbot ngay bây giờ:** chạy `start-app.bat` (gốc project) **và** `ai/start-server.bat` **cùng lúc** (2 cửa sổ riêng) — thiếu 1 trong 2 thì trang `/chat` báo "chưa sẵn sàng". Lần đầu chạy `ai/start-server.bat` sẽ tự tải model (~3.7GB, cần internet), các lần sau thì nhanh. Cần cài [Ollama](https://ollama.com) trước.

**Việc kế tiếp:** Milestone 7 (fine-tune) đã có **kế hoạch thực thi chi tiết** ở `AI_CHATBOT_PLAN.md` mục 12 — **đang chờ user duyệt (đọc + trả lời 4 câu hỏi ở mục 12.6), chưa được thực thi**, không tự ý bắt đầu tải/chạy gì cho Milestone 7 cho tới khi có xác nhận rõ ràng. Milestone 8 (chấm Writing/Speaking) chưa có kế hoạch chi tiết, chưa bắt đầu. Không milestone nào bắt buộc — chatbot đã dùng được ở dạng RAG + model gốc (Milestone 6).

**Milestone 8 (cập nhật 2026-09-20):** kế hoạch chi tiết đã viết ở [`AI_CHATBOT_PLAN.md`](./AI_CHATBOT_PLAN.md) **mục 13**, **đang chờ user duyệt** (6 câu hỏi ở 13.8, mỗi câu có mặc định). Riêng "nhóm A" (code thuần + test, không tải/chạy model, không đụng file Milestone 7) đã bắt đầu theo yêu cầu user — tiến trình chi tiết + điểm dừng ở mục "Milestone 8" của [`ai/AI_TASKS.md`](./ai/AI_TASKS.md). **Lưu ý:** Milestone 7 đang được xử lý bởi 1 phiên khác trong cùng thư mục (train lại trên Kaggle) — đoạn "Việc kế tiếp" và hàng Milestone 7 ở trên **đã lỗi thời** (M7 thực tế đã qua bước train vòng 1 + đánh giá, đang train lại vòng 2; xem mục "Milestone 7" của `ai/AI_TASKS.md` mới đúng), chờ phiên đó cập nhật.

**Nếu không liên quan chatbot:** việc khác (nếu có) là bất cứ gì user yêu cầu, hoặc 1 mục trong danh sách CHỜ LÀM của `document.txt` (đăng nhập, deploy cloud, Dự đoán Band v3 — OLS hồi quy, cơ chế đảm bảo tần suất tối thiểu ở cấp part, tinh chỉnh ngưỡng soft-reset, UI chỉnh `baseRatio` cho Writing/Listening, UI cấu hình các hằng số của engine, UI chỉnh tỉ lệ dạng bài, gắn Chủ đề vào vòng quay) — không mục nào cản trở việc dùng app bình thường như hiện tại.

**Việc còn treo nhưng không chặn gì:** có 1 file `web/note.txt` chưa track (gitignore), chứa 1 dòng bị cách ly ra khỏi `document.txt` (xem mục Milestone 4 Bước 1 trong file đó) — cố tình không commit theo lựa chọn của user. Đã dời theo app vào `web/` cùng đợt dời Milestone 6.

**Git/GitHub:** repo đã có remote `origin` trỏ về `https://github.com/august0362/IELTS-Adaptive-Practice.git` (nhánh `master`, đã push). Thư mục `web/src/theme/` (19 PNG bảng màu gốc mà `PROJECT_CONTEXT.md` mục 9 tham chiếu) đã được commit từ trước, nay theo app dời vào `web/`. 2 script `push-to-github.bat` / `pull-from-github.bat` **vẫn ở gốc project** (không dời — chúng thao tác trên cả repo qua `git`, không phụ thuộc `web/`).

---

## Tổng quan các milestone

| Milestone | Phạm vi | Trạng thái | Danh sách việc |
|---|---|---|---|
| Phase 0 | Tài liệu nền tảng (`PROJECT_CONTEXT.md`, `CLAUDE.md`, `document.txt`) | Xong | — |
| 1 — Backend/Thuật toán | Khởi tạo dự án, DB, engine tính toán, API route | Xong | [`web/src/lib/BACKEND_TASKS.md`](./web/src/lib/BACKEND_TASKS.md) |
| 2 — Frontend/Giao diện | Vòng quay, Nhật ký, Bảng dự đoán điểm | Xong | [`web/src/app/FRONTEND_TASKS.md`](./web/src/app/FRONTEND_TASKS.md) |
| 3 — QA/Kiểm thử | Test unit, component, e2e | Xong | [`web/src/tests/TEST_TASKS.md`](./web/src/tests/TEST_TASKS.md) |
| 4 — Supervisor | Hệ thống theme, review toàn bộ, `USER_GUIDE.md`, `TESTING_GUIDE.md` | Xong | — (Supervisor tự làm, không có file task riêng) |
| 5 — Dạng bài, xóa lượt quay, cộng luyện, thống kê, Chủ đề | Backend/Frontend/Design/QA + review chốt | Xong | [`BACKEND_TASKS.md`](./web/src/lib/BACKEND_TASKS.md), [`FRONTEND_TASKS.md`](./web/src/app/FRONTEND_TASKS.md), [`TEST_TASKS.md`](./web/src/tests/TEST_TASKS.md) |
| 5 mở rộng — Band v2 (EWMA + % đúng luyện tập), tách giao diện, sửa theme tối | Backend/Frontend/Design/QA + review chốt | Xong | [`BACKEND_TASKS.md`](./web/src/lib/BACKEND_TASKS.md), [`FRONTEND_TASKS.md`](./web/src/app/FRONTEND_TASKS.md), [`TEST_TASKS.md`](./web/src/tests/TEST_TASKS.md) |
| 6 — Chatbot AI: hạ tầng + RAG | Dời `web/`+`ai/`, tải model mở, RAG, route/trang `/chat` | Xong | [`ai/AI_TASKS.md`](./ai/AI_TASKS.md) |
| **7 — Chatbot AI: fine-tune** | Sinh dữ liệu train, train Kaggle, tích hợp adapter | **Chưa bắt đầu (không bắt buộc)** | `ai/AI_TASKS.md` (tiếp) |
| 8 — Chấm Writing/Speaking theo IELTS | STT (faster-whisper) + rubric chấm điểm, trang riêng | **Đang làm** — kế hoạch chờ duyệt (`AI_CHATBOT_PLAN.md` mục 13), nhóm A (code thuần) đã bắt đầu | `ai/AI_TASKS.md` (tiếp) |

Mỗi `*_TASKS.md` của từng phạm vi là nơi ghi checklist chi tiết cho tầng đó (`- [ ]` / `- [x]`) — cập nhật ngay trong bước hoàn thành việc, không dồn lại sau. File này chỉ theo dõi trạng thái ở mức milestone, không lặp lại chi tiết từng việc.

---

## Cách bắt đầu làm việc ở đây (đọc theo đúng phạm vi)

1 phiên làm việc hoặc agent mới bắt đầu vào dự án này nên đọc theo đúng thứ tự:

1. **File này** — biết trạng thái hiện tại và milestone nào đang hoạt động.
2. **Nếu việc liên quan chatbot (Milestone 6/7/8):** đọc [`AI_CHATBOT_PLAN.md`](./AI_CHATBOT_PLAN.md) trước tiên — toàn bộ phạm vi/quyết định/lý do đã chốt nằm ở đó.
3. **Chỉ đọc file `*_TASKS.md` của đúng phạm vi mình đang làm** (`web/src/lib/BACKEND_TASKS.md`, `web/src/app/FRONTEND_TASKS.md`, `web/src/tests/TEST_TASKS.md`, hoặc `ai/AI_TASKS.md`) — để có checklist chi tiết.
4. **Chỉ đọc đúng (các) mục trong `PROJECT_CONTEXT.md` mà việc đang làm động tới** — không đọc cả file, trừ khi đang review toàn bộ app.

Đừng đọc code hay tài liệu của phạm vi khác chỉ để "cho chắc", trừ khi việc đang làm thật sự cắt ngang nhiều phạm vi — bộ test tự động chạy xanh là tín hiệu đủ tin cậy cho mọi thứ mình không trực tiếp sửa.
