# PROGRESS.md — Bảng điều phối trung tâm

> Đọc file này đầu tiên khi bắt đầu 1 phiên làm việc mới, trước khi đọc bất cứ thứ gì khác. File cho biết dự án đang tới đâu và việc kế tiếp là gì, khỏi cần lục lại lịch sử git. Muốn biết *luật làm việc*, xem [`CLAUDE.md`](./CLAUDE.md). Muốn biết *chi tiết kỹ thuật* (schema, công thức, hình dạng API), xem [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md). Muốn biết *lịch sử xây dựng chi tiết* (lỗi từng gặp, quyết định đã chốt, theo từng milestone), xem [`document.txt`](./document.txt).

---

## Trạng thái hiện tại

**Cả 5 milestone (+ Milestone 5 mở rộng) đều XONG.** Mới nhất — Milestone 5 mở rộng: công thức Band v2 (EWMA thay cho trung bình phẳng, + thành phần % câu đúng khi luyện tập cho Reading/Listening — 65% Cambridge + 30% % đúng + 5% tần suất cho R/L, 65% Cambridge + 35% tần suất cho W/S), tách giao diện web/ứng dụng (khung ngoài luôn sáng, chỉ nội dung theo theme), sửa theme tối (nền xám đậm + glow thay vì gần đen), và 1 lỗi thật phát hiện khi user dùng app: random hàng tuần luôn chọn Reading rồi Listening do lỗi so sánh `NaN`. Engine + API đã test kỹ (143 test unit+component, 7 kịch bản e2e, tất cả xanh). Xem `PROJECT_CONTEXT.md` mục 5.4/5.12/9; `document.txt` có log đầy đủ.

**Việc kế tiếp: không có gì bắt buộc.** Việc tiếp theo (nếu có) là bất cứ gì user yêu cầu, hoặc 1 mục trong danh sách CHỜ LÀM của `document.txt` (đăng nhập, deploy cloud, Dự đoán Band v3 — OLS hồi quy, cơ chế đảm bảo tần suất tối thiểu ở cấp part, tinh chỉnh ngưỡng soft-reset, UI chỉnh `baseRatio` cho Writing/Listening, UI cấu hình các hằng số của engine, UI chỉnh tỉ lệ dạng bài, gắn Chủ đề vào vòng quay) — không mục nào cản trở việc dùng app bình thường như hiện tại. Nếu có agent nhận làm 1 mục trong danh sách chờ, hãy coi nó như 1 milestone nhỏ riêng: đọc đúng mục liên quan trong `document.txt` và (các) mục `PROJECT_CONTEXT.md` liên quan, code, tự kiểm (`typecheck`/`lint`/`test`), rồi review chốt 1 lần theo đúng quy trình ở `CLAUDE.md`.

**Việc còn treo nhưng không chặn gì:** có 1 thư mục `src/theme/` chưa được git track (chứa các file PNG bảng màu gốc — Color Hunt hoặc bảng màu có tên — mà hệ thống theme đã giải mã màu từ đó). Cố tình để yên theo đúng lựa chọn của user — không commit, không xóa, vẫn được `PROJECT_CONTEXT.md` mục 9 tham chiếu tới như nguồn thiết kế. Ngoài ra còn 1 file `note.txt` chưa track, chứa 1 dòng bị cách ly ra khỏi `document.txt` (xem mục Milestone 4 Bước 1 trong file đó) — cũng cố tình không commit.

---

## Tổng quan các milestone

| Milestone | Phạm vi | Trạng thái | Danh sách việc |
|---|---|---|---|
| Phase 0 | Tài liệu nền tảng (`PROJECT_CONTEXT.md`, `CLAUDE.md`, `document.txt`) | Xong | — |
| 1 — Backend/Thuật toán | Khởi tạo dự án, DB, engine tính toán, API route | Xong | [`src/lib/BACKEND_TASKS.md`](./src/lib/BACKEND_TASKS.md) |
| 2 — Frontend/Giao diện | Vòng quay, Nhật ký, Bảng dự đoán điểm | Xong | [`src/app/FRONTEND_TASKS.md`](./src/app/FRONTEND_TASKS.md) |
| 3 — QA/Kiểm thử | Test unit, component, e2e | Xong | [`src/tests/TEST_TASKS.md`](./src/tests/TEST_TASKS.md) |
| 4 — Supervisor | Hệ thống theme, review toàn bộ, `USER_GUIDE.md`, `TESTING_GUIDE.md` | Xong | — (Supervisor tự làm, không có file task riêng) |
| 5 — Dạng bài, xóa lượt quay, cộng luyện, thống kê, Chủ đề | Backend/Frontend/Design/QA + review chốt | Xong | [`BACKEND_TASKS.md`](./src/lib/BACKEND_TASKS.md), [`FRONTEND_TASKS.md`](./src/app/FRONTEND_TASKS.md), [`TEST_TASKS.md`](./src/tests/TEST_TASKS.md) |
| 5 mở rộng — Band v2 (EWMA + % đúng luyện tập), tách giao diện, sửa theme tối | Backend/Frontend/Design/QA + review chốt | **Xong** | [`BACKEND_TASKS.md`](./src/lib/BACKEND_TASKS.md), [`FRONTEND_TASKS.md`](./src/app/FRONTEND_TASKS.md), [`TEST_TASKS.md`](./src/tests/TEST_TASKS.md) |

Mỗi `*_TASKS.md` của từng phạm vi là nơi ghi checklist chi tiết cho tầng đó (`- [ ]` / `- [x]`) — cập nhật ngay trong bước hoàn thành việc, không dồn lại sau. File này chỉ theo dõi trạng thái ở mức milestone, không lặp lại chi tiết từng việc.

---

## Cách bắt đầu làm việc ở đây (đọc theo đúng phạm vi)

1 phiên làm việc hoặc agent mới bắt đầu vào dự án này nên đọc theo đúng thứ tự:

1. **File này** — biết trạng thái hiện tại và milestone nào đang hoạt động.
2. **Chỉ đọc file `*_TASKS.md` của đúng phạm vi mình đang làm** (`src/lib/BACKEND_TASKS.md`, `src/app/FRONTEND_TASKS.md`, hoặc `src/tests/TEST_TASKS.md`) — để có checklist chi tiết.
3. **Chỉ đọc đúng (các) mục trong `PROJECT_CONTEXT.md` mà việc đang làm động tới** — không đọc cả file, trừ khi đang review toàn bộ app.

Đừng đọc code hay tài liệu của phạm vi khác chỉ để "cho chắc", trừ khi việc đang làm thật sự cắt ngang nhiều phạm vi — bộ test tự động chạy xanh là tín hiệu đủ tin cậy cho mọi thứ mình không trực tiếp sửa.
