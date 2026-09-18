# QA & Độ bao phủ test — Danh sách việc

> Phạm vi: `src/tests/**`, ngoài ra chỉ báo (không tự sửa) nếu thấy thiếu test ở chỗ khác trong repo. Chiến lược/quy ước test nằm ở `PROJECT_CONTEXT.md` mục 7 — file này chỉ theo dõi *việc nào xong, việc nào chưa*. Đọc `PROGRESS.md` ở gốc dự án trước để biết trạng thái tổng quan.

## Đã xong

- [x] Tách Vitest thành 2 **project** (`vitest.config.mts`): `unit` (môi trường node, `tests/unit/**`) và `component` (môi trường jsdom qua RTL, `tests/component/**`), dùng chung 1 alias đường dẫn `@`
- [x] `tests/setup.ts` — dọn dẹp RTL + `vi.unstubAllGlobals()` sau mỗi test (cần thiết vì dự án này không bật `globals: true` của Vitest)
- [x] Test unit: `weightedRandom`, `weeklyConstraint`, `bandPrediction`, `ieltsRounding`, `countSoftReset`, `tagUtils`, `spinnerAnimation`, `theme` (quy tắc an toàn độ tương phản + tự tạo màu primary; có thêm 2 test kiểm tra tỉ lệ tương phản WCAG sau khi review Milestone 4 Bước 1 phát hiện `primaryForeground` không đạt chuẩn AA ở 7/19 theme — xem `document.txt`)
- [x] Test component: `Spinner` (giả lập animation chạy ngay lập tức — phần thời gian chạy có test unit riêng), `Journal`, `CambridgeTracker`, `RoundingModeToggle`, `PredictionCards`, `PredictionPageClient` (test tích hợp: bấm toggle → gọi `PATCH /api/config` → dự đoán được làm mới), `ThemePicker`+`ThemeProvider` (áp CSS var, lưu vào localStorage, khôi phục/dùng mặc định khi mount)
- [x] `tests/component/mockFetch.ts` — hàm giả lập chuỗi kết quả `fetch` dùng chung
- [x] Test e2e Playwright (`playwright.config.ts`, `tests/e2e/*.spec.ts`): quay đầy đủ 1 lượt, thêm/sửa/xóa/lọc nhật ký, thêm điểm Cambridge → bảng dự đoán cập nhật ra số thật (không chỉ kiểm tra dòng "chưa đủ dữ liệu" biến mất)
- [x] Cô lập DB cho e2e — `tests/e2e/setupDb.ts` xóa/migrate/seed 1 file `./e2e-test.db` dùng riêng cho test, chạy nối bằng `&&` trước `next build && next start` trong lệnh webServer (không bao giờ đụng vào `./dev.db` thật); chạy trên bản build production vì `next dev` không cho chạy instance thứ 2 cùng thư mục dự án

## Việc còn chờ / chưa làm

- [ ] `TESTING_GUIDE.md` (Milestone 4 Bước 2 — cách chạy/mở rộng bộ test, quy ước viết test)
- [ ] Tích hợp CI — hiện chưa có yêu cầu/kế hoạch, để ngỏ tính sau

## Thêm việc mới

Việc mới thuộc phạm vi test (file spec mới, vá 1 lỗ hổng test ai đó phát hiện) thì ghi thêm 1 dòng vào đây ngay trong bước làm việc đó, không dồn lại ghi sau. Nếu phát hiện thiếu test ở phạm vi khác, ghi vào đúng `*_TASKS.md` của phạm vi đó (`BACKEND_TASKS.md` / `FRONTEND_TASKS.md`) thay vì tự âm thầm sửa ở đây.
