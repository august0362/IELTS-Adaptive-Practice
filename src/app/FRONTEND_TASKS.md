# Trang & Giao diện — Danh sách việc

> Phạm vi: `src/app/**` (trang, layout) + `src/components/**`. Hình dạng API mà tầng này dùng nằm ở `PROJECT_CONTEXT.md` mục 6 — file này chỉ theo dõi *việc nào xong, việc nào chưa*. Đọc `PROGRESS.md` ở gốc dự án trước để biết trạng thái tổng quan.

## Đã xong

- [x] Khung app & thanh điều hướng — `layout.tsx`, `components/layout/Nav.tsx` (tô sáng link đang active)
- [x] Trang Vòng quay — `page.tsx` (lấy dữ liệu bằng Server Component) + `components/spinner/*` (hiệu ứng quay nối tiếp, hiển thị % xác suất từng thẻ, danh sách lượt quay gần đây)
- [x] Trang Nhật ký — `journal/page.tsx` + `components/journal/*` (thêm/sửa/xóa ghi chú, tự nhận diện `#tag` trong nội dung, lọc theo tag)
- [x] Theo dõi điểm thi thử Cambridge — `components/prediction/CambridgeTracker.tsx` + `CambridgeRow.tsx` (thêm/sửa/xóa, hiện 5 gần nhất + nút "Xem tất cả"/"Thu gọn")
- [x] Bảng dự đoán điểm — `components/prediction/PredictionCards.tsx`, `RoundingModeToggle.tsx`, `RatioSliders.tsx`, `FrequencyChart.tsx`, ghép lại trong `PredictionPageClient.tsx`
- [x] Biểu đồ tần suất luyện tập đạt chuẩn dataviz — bảng màu đã kiểm tra (cả sáng lẫn tối), có nhãn giá trị trực tiếp, có tooltip khi hover
- [x] Sửa lỗi: thêm `export const dynamic = "force-dynamic"` ở cả 3 trang (1 Server Component đọc DB trực tiếp thì không được để `next build` dựng sẵn thành HTML tĩnh — xem `PROJECT_CONTEXT.md` mục 3)
- [x] Quy tắc chung: lấy dữ liệu ban đầu qua props của Server Component, không bao giờ fetch bằng `useEffect` phía client lúc mount (ESLint của dự án này báo lỗi bất kỳ `setState` nào gọi được từ trong effect)
- [x] Hệ thống theme (chuẩn bị cho Milestone 4, trước bước review Bước 1) — `src/lib/theme.ts` (19 theme lấy từ `src/theme/*.png`, hàm `computeThemeRoles()`), `components/theme/ThemeProvider.tsx` + `ThemePicker.tsx`, trang `/settings`, link "Cài đặt" trên nav. Đã rà toàn bộ component, bỏ hết màu cứng kiểu `bg-white/60`/`border-black/10`/`bg-foreground text-background`, chuyển sang dùng class theo theme như `bg-surface`/`border-border`/`bg-primary`/`text-primary-foreground` để cả app đổi màu đồng bộ khi đổi theme; cố tình giữ nguyên màu cố định cho các trạng thái đặc biệt (xóa = đỏ, vòng quay đang chạy/đã chọn = xanh dương/xanh ngọc). Đã được review ở Milestone 4 Bước 1 xác nhận sạch (không còn class màu cứng nào sót lại).
- [x] Sửa lỗi ở Milestone 4 Bước 1: hàm chọn màu chữ `primaryForeground` trong `computeThemeRoles` trước đây chỉ dựa vào ngưỡng độ sáng `relativeLuminance > 0.5`, khiến 7/19 theme không đạt độ tương phản chuẩn WCAG AA (3 trong số đó còn dưới cả ngưỡng tối thiểu 3:1 cho chữ lớn/UI) — đã sửa để chọn màu nào trong `#111111`/`#ffffff` cho độ tương phản với `primary` cao hơn. Xem mục "Milestone 4, Step 1" trong `document.txt`.

## Việc còn chờ / chưa làm (xem `document.txt` để biết đầy đủ bối cảnh từng việc)

- [ ] UI chỉnh `baseRatio` cho Writing (Task 1/2) và Listening (Block A/B) — hiện chỉ Speaking/Reading có, đúng theo phạm vi ban đầu
- [ ] UI cấu hình riêng cho các hằng số của engine (`decay_exponent`, `weekly_threshold_days`, v.v.) — hiện chỉ chỉnh được qua API/DB trực tiếp
- [ ] `USER_GUIDE.md` của Milestone 4 có thể phát sinh thêm vài việc cải thiện UX sau khi viết xong

## Thêm việc mới

Việc mới thuộc phạm vi frontend (trang mới, component mới, sửa lỗi UI) thì ghi thêm 1 dòng vào đây ngay trong bước làm việc đó, không dồn lại ghi sau.
