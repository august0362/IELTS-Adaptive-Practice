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

### Milestone 5 (QA) — Dạng bài, xóa lượt quay, cộng luyện thủ công, thống kê, chủ đề

- [x] Unit: `pickWeightedIndependent` trong `weightedRandom.test.ts` — trả đúng `count` phần tử kể cả khi vượt kích thước pool (cho phép trùng), mỗi lần random độc lập (không bị ảnh hưởng bởi lần trước), có thể ra trùng 1 dạng bài 2 lần, `count=0` trả mảng rỗng, phân bố đều thống kê
- [x] Component: `Spinner` — thêm test cascade dạng bài (2 lần random độc lập cho Reading Block A, 0 lần cho Speaking, đúng thứ tự "đoạn 1"/"đoạn 2")
- [x] Component mới: `RecentRolls.test.tsx` — hiện dạng bài + nhãn "Tự học", nút Xóa có `window.confirm` (test cả xác nhận lẫn hủy), báo lỗi khi API thất bại
- [x] Component mới: `ManualPractice.test.tsx` — ẩn/hiện ô Dạng bài theo `questionTypeRollCount` của part đang chọn, gửi đúng body, báo lỗi khi API thất bại
- [x] Component mới: `Topics.test.tsx` — thêm/xóa lạc quan (optimistic), khôi phục lại khi xóa thất bại
- [x] Component mới: `PracticeLog.test.tsx` — trạng thái rỗng, nhãn "Tự học" chỉ hiện đúng ở lượt `manual`
- [x] E2E mới: `delete-roll.spec.ts` (quay → xóa → biến mất khỏi lịch sử), `manual-practice.spec.ts` (ghi nhận tự học → hiện "Tự học" trong lịch sử), `topics.spec.ts` (thêm → xóa)
- [x] Sửa lỗi tự phát hiện qua e2e: cascade dạng bài lồng animation tốc độ như skill/part khiến 1 lượt quay "xui" (nhiều lần random dạng bài liên tiếp) có thể mất tới ~35s, làm `roll.spec.ts`/`delete-roll.spec.ts` timeout không ổn định — giảm tốc animation riêng cho dạng bài (`minSteps`/`baseDelayMs` nhỏ hơn skill/part), chạy lại `npx playwright test --repeat-each=3` xác nhận hết flaky
- [x] `npm run test:e2e` chạy đầy đủ 6 spec, xanh hết trước khi chốt milestone

### Milestone 5 mở rộng (QA) — Band v2 (EWMA + % đúng luyện tập), nhập số câu đúng

- [x] Unit: `ewma.test.ts` (mới) — mảng rỗng, 1 phần tử, alpha gần 0/gần 1, chuỗi hằng số
- [x] Unit: viết lại `bandPrediction.test.ts` cho công thức v2 — nhánh có/không `accuracyEwma`, fallback khi chưa có dữ liệu % đúng, mức trần tần suất đúng theo trọng số (0.45 cho R/L, 3.15 cho W/S), EWMA kéo về điểm gần đây hơn trung bình phẳng
- [x] Component mới: `AccuracyEntry.test.tsx` — gửi đúng `PATCH /api/results/:id/accuracy`, nút Lưu disable tới khi đủ 2 ô, báo lỗi khi API thất bại
- [x] Component: `ManualPractice.test.tsx` — thêm test `AccuracyEntry` hiện đúng cho Reading, không hiện cho Speaking
- [x] Component: `Spinner.test.tsx` — thêm test `AccuracyEntry` hiện đúng 1 lần dưới kết quả Reading, không hiện dưới Writing
- [x] E2E mới: `accuracy-entry.spec.ts` — tự học Reading → nhập số câu đúng → lưu thành công
- [x] Sửa lỗi tự phát hiện qua e2e: `cambridge-prediction.spec.ts` hard-code giá trị Band tổng dự đoán chính xác theo công thức v1 (`"6.5"`) — vừa sai theo công thức v2 (EWMA/accuracy/tần suất khác v1), vừa giòn vì các spec e2e dùng chung 1 DB (`setupDb.ts` chỉ seed 1 lần, không phải mỗi spec) nên spec `accuracy-entry.spec.ts` chạy trước đã làm lệch tần suất Reading. Sửa thành kiểm tra "có hiện 1 số Band hợp lệ" thay vì giá trị cụ thể — phần số học chính xác đã có unit test riêng ở `bandPrediction.test.ts`
- [x] `npm run test:e2e` chạy đầy đủ 7 spec, xanh hết

## Việc còn chờ / chưa làm

- [ ] `TESTING_GUIDE.md` (Milestone 4 Bước 2 — cách chạy/mở rộng bộ test, quy ước viết test)
- [ ] Tích hợp CI — hiện chưa có yêu cầu/kế hoạch, để ngỏ tính sau

## Thêm việc mới

Việc mới thuộc phạm vi test (file spec mới, vá 1 lỗ hổng test ai đó phát hiện) thì ghi thêm 1 dòng vào đây ngay trong bước làm việc đó, không dồn lại ghi sau. Nếu phát hiện thiếu test ở phạm vi khác, ghi vào đúng `*_TASKS.md` của phạm vi đó (`BACKEND_TASKS.md` / `FRONTEND_TASKS.md`) thay vì tự âm thầm sửa ở đây.
