# PROGRESS.md — Bảng điều phối trung tâm

> Đọc file này đầu tiên khi bắt đầu 1 phiên làm việc mới, trước khi đọc bất cứ thứ gì khác. File cho biết dự án đang tới đâu và việc kế tiếp là gì, khỏi cần lục lại lịch sử git. Muốn biết *luật làm việc*, xem [`CLAUDE.md`](./CLAUDE.md). Muốn biết *chi tiết kỹ thuật* (schema, công thức, hình dạng API), xem [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md). Muốn biết *lịch sử xây dựng chi tiết* (lỗi từng gặp, quyết định đã chốt, theo từng milestone), xem [`document.txt`](./document.txt).

---

## Trạng thái hiện tại

**Cả 4 milestone đã lên kế hoạch ban đầu đều XONG.** App đã đầy đủ tính năng: Vòng quay, Nhật ký, Bảng dự đoán điểm, và trang Cài đặt/chọn giao diện — đứng sau là 1 engine tính toán và tầng API đã test kỹ (95 test unit+component, 3 kịch bản e2e, tất cả đều xanh), cùng 2 file `TESTING_GUIDE.md` và `USER_GUIDE.md`.

**Việc kế tiếp: không có gì bắt buộc.** Không có Milestone 5. Việc tiếp theo (nếu có) là bất cứ gì user yêu cầu, hoặc 1 mục trong danh sách CHỜ LÀM của `document.txt` (đăng nhập, deploy cloud, Dự đoán Band v2, cơ chế đảm bảo tần suất tối thiểu ở cấp part, tinh chỉnh ngưỡng soft-reset, UI chỉnh `baseRatio` cho Writing/Listening, UI cấu hình các hằng số của engine) — không mục nào trong số này cản trở việc dùng app bình thường như hiện tại. Nếu có agent nhận làm 1 mục trong danh sách chờ, hãy coi nó như 1 milestone nhỏ riêng: đọc đúng mục liên quan trong `document.txt` và (các) mục `PROJECT_CONTEXT.md` liên quan, code, tự kiểm (`typecheck`/`lint`/`test`), rồi review chốt 1 lần theo đúng quy trình ở `CLAUDE.md`.

**Việc còn treo nhưng không chặn gì:** có 1 thư mục `src/theme/` chưa được git track (chứa các file PNG bảng màu gốc — Color Hunt hoặc bảng màu có tên — mà hệ thống theme đã giải mã màu từ đó). Cố tình để yên theo đúng lựa chọn của user — không commit, không xóa, vẫn được `PROJECT_CONTEXT.md` mục 9 tham chiếu tới như nguồn thiết kế. Ngoài ra còn 1 file `note.txt` chưa track, chứa 1 dòng bị cách ly ra khỏi `document.txt` (xem mục Milestone 4 Bước 1 trong file đó) — cũng cố tình không commit.

---

## Tổng quan các milestone

| Milestone | Phạm vi | Trạng thái | Danh sách việc |
|---|---|---|---|
| Phase 0 | Tài liệu nền tảng (`PROJECT_CONTEXT.md`, `CLAUDE.md`, `document.txt`) | Xong | — |
| 1 — Backend/Thuật toán | Khởi tạo dự án, DB, engine tính toán, API route | Xong | [`src/lib/BACKEND_TASKS.md`](./src/lib/BACKEND_TASKS.md) |
| 2 — Frontend/Giao diện | Vòng quay, Nhật ký, Bảng dự đoán điểm | Xong | [`src/app/FRONTEND_TASKS.md`](./src/app/FRONTEND_TASKS.md) |
| 3 — QA/Kiểm thử | Test unit, component, e2e | Xong | [`src/tests/TEST_TASKS.md`](./src/tests/TEST_TASKS.md) |
| 4 — Supervisor | Hệ thống theme, review toàn bộ, `USER_GUIDE.md`, `TESTING_GUIDE.md` | **Xong** | — (Supervisor tự làm, không có file task riêng) |

Mỗi `*_TASKS.md` của từng phạm vi là nơi ghi checklist chi tiết cho tầng đó (`- [ ]` / `- [x]`) — cập nhật ngay trong bước hoàn thành việc, không dồn lại sau. File này chỉ theo dõi trạng thái ở mức milestone, không lặp lại chi tiết từng việc.

---

## Cách bắt đầu làm việc ở đây (đọc theo đúng phạm vi)

1 phiên làm việc hoặc agent mới bắt đầu vào dự án này nên đọc theo đúng thứ tự:

1. **File này** — biết trạng thái hiện tại và milestone nào đang hoạt động.
2. **Chỉ đọc file `*_TASKS.md` của đúng phạm vi mình đang làm** (`src/lib/BACKEND_TASKS.md`, `src/app/FRONTEND_TASKS.md`, hoặc `src/tests/TEST_TASKS.md`) — để có checklist chi tiết.
3. **Chỉ đọc đúng (các) mục trong `PROJECT_CONTEXT.md` mà việc đang làm động tới** — không đọc cả file, trừ khi đang review toàn bộ app.

Đừng đọc code hay tài liệu của phạm vi khác chỉ để "cho chắc", trừ khi việc đang làm thật sự cắt ngang nhiều phạm vi — bộ test tự động chạy xanh là tín hiệu đủ tin cậy cho mọi thứ mình không trực tiếp sửa.
