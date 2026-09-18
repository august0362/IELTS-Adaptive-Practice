# Backend & Engine tính toán — Danh sách việc

> Phạm vi: `src/lib/**` (engine, db, types) + `src/app/api/**`. Chi tiết kỹ thuật (schema, công thức, hình dạng API) nằm ở `PROJECT_CONTEXT.md` — file này chỉ theo dõi *việc nào xong, việc nào chưa*, dạng checklist. Đọc `PROGRESS.md` ở gốc dự án trước để biết trạng thái tổng quan.

## Đã xong

- [x] Đổi công nghệ: Prisma → Drizzle ORM + better-sqlite3 (xem `PROJECT_CONTEXT.md` mục 2.1)
- [x] Schema Drizzle — 7 bảng (`db/schema.ts`)
- [x] Client DB dùng chung 1 instance (`db/client.ts`)
- [x] Dữ liệu khởi tạo — 4 kỹ năng, 8 phần, 6 config mặc định (hàm `seedDatabase()` trong `db/seed.ts`, dùng chung cho cả `db/seedCli.ts` lẫn phần setup test e2e)
- [x] Hàm query dùng chung (`db/queries.ts`): `getSkillsWithParts`, `getAllNotes`, `getCambridgeResults`, `getRecentRollHistory`, `getPredictionData`
- [x] `db/configHelpers.ts` — hàm đọc `EngineConfig` có kiểu rõ ràng (dùng được cả trong `db.transaction()` đồng bộ lẫn trong route handler bình thường)
- [x] `api/../requestJson.ts` — hàm parse JSON body an toàn, dùng chung cho các route có thay đổi dữ liệu
- [x] Công thức 1 — `engine/weightedRandom.ts`
- [x] Công thức 2 — `engine/weeklyConstraint.ts`
- [x] Công thức 3 — `engine/bandPrediction.ts` (kèm tùy chọn `overall_prediction_rounding_mode`)
- [x] `engine/ieltsRounding.ts` — quy tắc làm tròn Band tổng chính thức của IELTS
- [x] `engine/countSoftReset.ts` — cơ chế tự giảm bớt bộ đếm khi quá cao
- [x] `POST /api/roll` — gói gọn trong 1 transaction đồng bộ (Công thức 2 → Công thức 1 cho từng kỹ năng → cập nhật bộ đếm → soft-reset)
- [x] `GET /api/skills`
- [x] `PATCH /api/skills/parts/:id/ratio`
- [x] `GET /api/history`
- [x] `GET/POST /api/notes`, `PATCH/DELETE /api/notes/:id`
- [x] `GET/POST /api/cambridge`, `PATCH/DELETE /api/cambridge/:id`
- [x] `GET /api/prediction` (Milestone 2 Bước 5 bổ sung thêm `practiceCount30dPerSkill`)
- [x] `GET/PATCH /api/config`

### Milestone 5 (backend) — Dạng bài, xóa lượt quay, cộng luyện thủ công, thống kê, chủ đề

- [x] Schema: bảng `questionTypes`, `rollResultQuestionTypes`, `topics`; cột `questionTypeRollCount` trên `skillParts`; cột `source` (`$type<"roll"|"manual">`) trên `rollSessions` — migration `drizzle/migrations/0001_clean_aaron_stack.sql`
- [x] Seed: 10 dạng Reading, 7 dạng Listening, 7 dạng Writing (tỉ lệ theo `PROJECT_CONTEXT.md` 5.7) + `questionTypeRollCount` đúng cho từng part
- [x] `engine/weightedRandom.ts` — thêm `pickWeightedIndependent()` (random N lần độc lập, cho phép trùng)
- [x] `POST /api/roll` — mở rộng: random thêm dạng bài sau khi chọn part, cộng count + soft-reset cho pool dạng bài, response có `questionTypes` per kết quả
- [x] `DELETE /api/history/:id` — xóa + hoàn tác bộ đếm (mục 5.9), đã smoke-test qua curl
- [x] `POST /api/practice` — cộng luyện thủ công (mục 5.8), đã smoke-test qua curl
- [x] `GET /api/stats/:skillCode` — dữ liệu trang thống kê (mục 5.10), đã smoke-test qua curl
- [x] `GET/POST /api/topics`, `DELETE /api/topics/:id` (mục 5.11), đã smoke-test qua curl
- [x] `GET /api/skills`, `GET /api/history` — mở rộng response (`questionTypes`, `source`)
- [x] Cập nhật `PROJECT_CONTEXT.md` mục 3/4/5 (thêm 5.7–5.11)/6 cùng bước

### Milestone 5 mở rộng — Công thức Band v2 (EWMA + % đúng luyện tập), sửa lỗi random tuần

- [x] Schema: cột `questionsAnswered`/`questionsCorrect` (nullable) trên `rollResults` — migration `0002_colorful_dexter_bennett.sql`
- [x] Config mới: `cambridge_ewma_alpha`, `accuracy_ewma_alpha` (mặc định 0.5); bỏ `frequency_adjustment_cap` (không còn dùng — mức trần giờ tính từ trọng số tần suất theo từng kỹ năng)
- [x] Engine mới: `engine/ewma.ts` — hàm thuần túy tính EWMA
- [x] Viết lại `engine/bandPrediction.ts` theo Công thức 3 v2: 65% Cambridge EWMA + 30% % đúng luyện tập EWMA + 5% tần suất (Reading/Listening); 65% Cambridge EWMA + 35% tần suất (Writing/Speaking) — xem `PROJECT_CONTEXT.md` mục 5.4
- [x] `queries.ts`'s `getPredictionData()` — build input theo thứ tự thời gian (cũ→mới) cho EWMA, thêm truy vấn % đúng luyện tập Reading/Listening
- [x] `PATCH /api/results/:id/accuracy` (route mới) — ghi số câu đúng cho 1 kết quả Reading/Listening, validate chỉ Reading/Listening + `questionsCorrect <= questionsAnswered`
- [x] `POST /api/roll`, `POST /api/practice`, `GET /api/history` — response giờ có `id` mỗi result (để PATCH accuracy) + `questionsAnswered`/`questionsCorrect`
- [x] Verify qua script gọi thẳng DB layer (không đụng dev.db thật của user — dùng DB tạm riêng), xác nhận EWMA kéo về điểm gần đây đúng như thiết kế
- [x] Sửa lỗi thật (không phải phần công thức Band, phát hiện khi user đang dùng app): `weeklyConstraint.ts`'s tie-break luôn chọn Reading rồi Listening do NaN comparator — xem commit riêng "Fix weekly-overdue tie-break..."
- [x] Cập nhật `PROJECT_CONTEXT.md` mục 3/4/5.4/5.12/6 cùng bước

## Việc còn chờ / chưa làm (xem `document.txt` để biết đầy đủ bối cảnh từng việc)

- [ ] Cơ chế đảm bảo tần suất tối thiểu hàng tuần ở cấp Part/Block (hiện chỉ áp dụng ở cấp kỹ năng)
- [ ] Tinh chỉnh `count_soft_reset_threshold` khi đã có dữ liệu dùng thực tế
- [ ] Đăng nhập / nhiều người dùng (chưa có kế hoạch làm — app chỉ chạy local)
- [ ] Cấu hình deploy lên cloud (chưa có kế hoạch làm)

## Thêm việc mới

Việc mới thuộc phạm vi backend (route API mới, module engine mới, đổi schema) thì ghi thêm 1 dòng vào mục liên quan ở đây — ghi ngay trong bước làm việc đó, không dồn lại ghi sau.
