# PROJECT_CONTEXT.md — App luyện thi IELTS thích ứng

> **File này để làm gì**: đây là nguồn thông tin duy nhất, đáng tin cậy nhất về kiến trúc dự án. Bất kỳ ai (người hoặc AI) mở repo này lần đầu, đọc file này từ đầu tới cuối là phải hiểu được app đang có gì, tại sao lại làm như vậy, và làm sao để tiếp tục xây dựng — không cần phải biết cuộc trò chuyện gốc đã thiết kế ra nó.
>
> **Quy tắc cập nhật**: bất kỳ thay đổi nào về schema DB, 1 công thức, 1 hợp đồng API, hay quy ước thư mục đều PHẢI được cập nhật vào file này ngay trong cùng bước/commit thực hiện thay đổi đó. File này mà lỗi thời thì coi như là 1 lỗi (bug).

Cập nhật lần cuối: 2026-09-19 (Milestone 6 — dời toàn bộ app Next.js vào `web/`, thêm module `ai/` cho chatbot; xem mục 3 và mục 11 mới). Trước đó: cả 4 milestone theo kế hoạch ban đầu đã xong — backend/engine/API, frontend, test, và Milestone 4 gồm hệ thống theme + review toàn bộ + `TESTING_GUIDE.md`/`USER_GUIDE.md`. Xem `PROGRESS.md` để biết trạng thái hiện tại, mục 2.1 để biết 1 thay đổi công nghệ quan trọng từ Milestone 1, mục 9 để biết về hệ thống theme.

> **Quy ước đường dẫn từ Milestone 6:** mọi đường dẫn `src/...`, `drizzle/...`, `dev.db`, và mọi lệnh `npm run ...` trong các mục **1–9** dưới đây (viết trước khi dời file) đều thực hiện **bên trong thư mục `web/`** — ví dụ `src/lib/engine/ewma.ts` nay là `web/src/lib/engine/ewma.ts`, `npm run dev` nay chạy với cwd = `web/`. Giữ nguyên đường dẫn ngắn trong các mục đó cho dễ đọc/dễ so khớp với lịch sử; chỉ mục 3 (sơ đồ thư mục) và mục 11 (chatbot) dùng đường dẫn đầy đủ có `web/`/`ai/`.

---

## 1. Tổng quan sản phẩm

App web cá nhân, chạy hoàn toàn trên máy, dùng để lên kế hoạch và theo dõi việc luyện thi IELTS ở cả 4 kỹ năng (Reading, Listening, Writing, Speaking), dùng **engine chọn ngẫu nhiên có trọng số, tự thích ứng** — kỹ năng/phần nào lâu chưa luyện thì càng dễ được chọn ở lần sau. App có 3 phần chính cho người dùng:

1. **Vòng quay** — chọn 2 trong 4 kỹ năng cho mỗi buổi luyện, sau đó chọn tiếp part/task/block cụ thể cho từng kỹ năng đã chọn.
2. **Nhật ký hằng ngày** — ghi chú tự do theo ngày, gắn được tag (ví dụ `#Reading`, `#Vocabulary`).
3. **Bảng dự đoán điểm** — dự đoán Band điểm cho từng kỹ năng (và điểm tổng), chủ yếu dựa vào kết quả thi thử Cambridge đã ghi nhận, cộng thêm 1 chút điều chỉnh nhỏ theo tần suất luyện tập; hiển thị lịch sử thi thử Cambridge gần đây (5 lần gần nhất + nút "xem tất cả") và biểu đồ tần suất luyện tập theo từng kỹ năng.
4. **Cài đặt** (`/settings`) — nơi chọn bảng màu giao diện cho toàn app; xem mục 9.

Chỉ 1 người dùng, không cần đăng nhập, chạy hoàn toàn local. Việc hỗ trợ nhiều người dùng/đăng nhập/deploy cloud được cố tình để sau — xem [`document.txt`](./document.txt).

---

## 2. Công nghệ sử dụng

| Tầng | Chọn dùng | Vì sao |
|---|---|---|
| Framework | **Next.js 16 (App Router)**, 1 repo duy nhất | Full-stack gọn trong 1 dự án: frontend React + Route Handler làm backend luôn. Không cần chạy/deploy server riêng. |
| Ngôn ngữ | **TypeScript** | Phần tính toán ngẫu nhiên có trọng số và dự đoán Band điểm là giá trị cốt lõi của app — kiểm tra kiểu dữ liệu (type) trên model DB và input/output công thức giúp bắt lỗi ngay lúc build. |
| Database | **SQLite** qua **Drizzle ORM** + `better-sqlite3` | Lưu dạng file (`./dev.db`), không cần cài server DB riêng, đúng yêu cầu "database rất đơn giản", chạy hoàn toàn local. Xem mục 2.1 — ban đầu định dùng Prisma, đã đổi trong lúc làm Milestone 1. |
| Giao diện | **Tailwind CSS v4** | Xây UI đơn giản, đồng nhất nhanh mà không cần cả 1 design system. |
| Biểu đồ | **Recharts** | Vẽ biểu đồ đơn giản, khai báo kiểu declarative cho bảng dự đoán (cột tần suất kỹ năng, xu hướng Band điểm). |
| Test | **Vitest** + **React Testing Library** (unit/component), **Playwright** (e2e) | Hợp với quy ước Next.js/TS; Vitest chạy nhanh khi test các hàm công thức thuần túy. |
| Đăng nhập | Không có (chỉ 1 user ngầm định) | Hiện chỉ chạy local. Để sau trong `document.txt`. |
| Deploy | Chỉ chạy dev local (`npm run dev`) | Chưa deploy lên cloud. Để sau trong `document.txt`. |

### 2.1 Vì sao dùng Drizzle thay vì Prisma (đọc mục này trước khi định "sửa lại" cho giống ban đầu)

Kế hoạch gốc ở Phase 0 định dùng Prisma ORM. Trong lúc làm Milestone 1 Bước 1, lệnh `npx create-next-app@latest` cài ra **Next.js 16.3.5 / React 19.2.8**, và khi cài Prisma thì kéo theo **Prisma 8.0.0-rc.15** — bản này hóa ra đã chuyển hướng mạnh sang sản phẩm nền tảng cloud ("Prisma Platform": Composer/Compute/Prisma Postgres, lệnh `prisma deploy`, branch, v.v.). Ở phiên bản đó:

- Lệnh `prisma orm init --target` chỉ nhận `postgres` hoặc `mongodb` — **SQLite không còn là lựa chọn** trong phần setup hướng dẫn.
- Các lệnh cũ quen thuộc (`prisma generate`, `prisma migrate dev`) **không còn tồn tại** trong CLI nữa; mọi thứ giờ đi qua các nhóm lệnh mới `contract` / `db` / `migration` / `composer`.
- Bộ công cụ dev local riêng của nền tảng này (`prisma dev`) **chưa hỗ trợ Windows** — mà đây lại đúng là hệ điều hành của dự án này.

Không cái nào trong số đó phù hợp với 1 app chỉ chạy local, dùng database 1-file, không cần tài khoản cloud. Thay vì cố dùng 1 công cụ đã chuyển hướng sang bài toán khác (hosting cloud có quản lý) hoặc ghim cứng vào 1 bản Prisma cũ đã ngừng cập nhật, dự án chuyển sang dùng **Drizzle ORM** (`drizzle-orm` + `drizzle-kit`) với driver **`better-sqlite3`** — hỗ trợ SQLite đầy đủ, chạy hoàn toàn local, nhẹ, không cần tài khoản hay CLI thu thập dữ liệu sử dụng nặng nề. Mô hình dữ liệu (bảng/trường/quan hệ) không đổi so với thiết kế gốc ở Phase 0 — chỉ khác cú pháp viết schema và lệnh migration. Nếu 1 phiên làm việc sau này thấy Prisma được nhắc tới ở đâu đó trong lịch sử/tài liệu của repo, đây chính là lý do vì sao nó không được dùng thật — đừng thử lại hướng Prisma mà không kiểm tra lại xem hỗ trợ SQLite của nó đã quay lại chưa.

---

## 3. Cấu trúc thư mục

Từ Milestone 6, dự án là 1 monorepo 2 module độc lập — `web/` (app Next.js, không đổi gì bên trong ngoài vị trí) và `ai/` (chatbot, xem mục 11) — cộng các tài liệu dùng chung ở gốc:

```
/ (gốc project)
  CLAUDE.md, PROGRESS.md, PROJECT_CONTEXT.md, document.txt   # tài liệu dùng chung cho cả 2 module
  AI_CHATBOT_PLAN.md           # log quyết định/phạm vi đầy đủ của chatbot (Milestone 6/7/8)
  push-to-github.bat, pull-from-github.bat, start-app.bat    # script tiện ích, thao tác cả repo
  /web                         # === App Next.js (Milestone 1-5) — mọi thứ dưới đây y hệt trước khi dời ===
  /ai                          # === Chatbot AI (Milestone 6/7/8) — xem mục 11 ===
```

Chi tiết bên trong `/web`:

```
web/drizzle.config.ts          # config của drizzle-kit (dialect: sqlite, đường dẫn schema, thư mục migration)
web/drizzle
  /migrations                  # file SQL migration được sinh ra bởi `npm run db:generate`
web/src
  /app
    /api
      /roll/route.ts           # POST: thực hiện 1 lượt quay (kỹ năng + part + random thêm dạng bài, mục 5.7)
      /skills/route.ts         # GET: kỹ năng + part + dạng bài + bộ đếm + tỉ lệ
      /skills/parts/[id]/ratio/route.ts   # PATCH: đổi baseRatio của 1 part
      /history/route.ts        # GET: lịch sử quay (cả roll lẫn manual), có phân trang
      /history/[id]/route.ts   # DELETE: xóa 1 lượt quay/tự học, hoàn tác bộ đếm (mục 5.9)
      /practice/route.ts       # POST: cộng luyện thủ công, không qua vòng quay (mục 5.8)
      /results/[id]/accuracy/route.ts  # PATCH: ghi số câu đúng cho 1 kết quả Reading/Listening (mục 5.12)
      /stats/[skillCode]/route.ts   # GET: lịch sử luyện + thống kê dạng bài theo kỹ năng (mục 5.10)
      /notes/route.ts          # GET/POST ghi chú hằng ngày
      /notes/[id]/route.ts     # PATCH/DELETE 1 ghi chú
      /cambridge/route.ts      # GET (?limit=5 cho gần đây, ?all=true cho toàn bộ) / POST
      /cambridge/[id]/route.ts # PATCH/DELETE 1 kết quả thi thử
      /prediction/route.ts     # GET: kết quả dự đoán Band điểm (gọi hàm getPredictionData() trong lib/db/queries.ts,
                                #      hàm này bọc quanh lib/engine/bandPrediction.ts — dùng chung với Server Component
                                #      của /prediction để cả 2 nơi tính Công thức 3 giống hệt nhau; thêm ở Milestone 2 Bước 5)
      /config/route.ts         # GET/PATCH các giá trị cấu hình của engine
      /topics/route.ts         # GET/POST chủ đề (mục 5.11)
      /topics/[id]/route.ts    # DELETE 1 chủ đề
    page.tsx                   # Trang chủ: Vòng quay (cũng hiện "lượt quay gần đây" — xem Milestone 2 Bước 2;
                                # không có trang /history riêng, chỉ có route GET /api/history ở trên)
    /journal/page.tsx
    /prediction/page.tsx
    /settings/page.tsx         # trang chọn theme (ThemePicker.tsx) + chủ đề (Topics.tsx) — xem mục 9, 5.11
    /stats/[skillCode]/page.tsx   # trang thống kê theo kỹ năng (mục 5.10) — dùng chung getSkillStats() với route API
    layout.tsx
    # `page.tsx`, `journal/page.tsx`, và `prediction/page.tsx` đều khai báo
    # `export const dynamic = "force-dynamic"` — thêm vào ở Milestone 3 Bước 2 sau khi
    # `next build` âm thầm dựng sẵn các trang này thành HTML *tĩnh* (vì chúng không gọi
    # API nào báo hiệu "cần render động" như cookies()/headers(), nên Next đoán mặc định
    # là tĩnh) và đưa ra 1 bản dữ liệu đông cứng mãi mãi, đúng như DB lúc build.
    # Bất kỳ trang Server Component nào sau này đọc DB trực tiếp đều cần khai báo
    # export này, nếu không sẽ chạy đúng khi `next dev` (không bao giờ dựng sẵn tĩnh)
    # nhưng lại lỗi khi chạy `next build`/`next start` thật.
  /components
    /layout                    # Nav.tsx — thanh điều hướng trên cùng, tô sáng link đang active
    /spinner                   # UI vòng quay may mắn, hiện lần lượt kỹ năng -> part -> dạng bài (0..2 lần, mục 5.7);
                                # RecentRolls.tsx (có nút xóa, mục 5.9), ManualPractice.tsx (cộng luyện thủ công, mục 5.8),
                                # AccuracyEntry.tsx (nhập số câu đúng Reading/Listening, mục 5.12)
    /journal                   # Ô soạn ghi chú + nhập tag + danh sách ghi chú
    /prediction                # Thẻ dự đoán, nút chuyển cách làm tròn, thanh trượt tỉ lệ, biểu đồ tần suất,
                                # theo dõi Cambridge (thêm/sửa/xóa + gần đây/"xem tất cả"), ghép lại trong
                                # PredictionPageClient.tsx (component client, nhận dữ liệu từ Server Component
                                # của /prediction/page.tsx)
    /theme                     # ThemeProvider.tsx (context + áp CSS-var), ThemePicker.tsx
    /stats                     # QuestionTypeBarChart.tsx (cột ngang, 1 màu — xem dataviz), QuestionTypeRadarChart.tsx,
                                # PracticeLog.tsx — dùng ở /stats/[skillCode]
    /settings                  # Topics.tsx — CRUD chủ đề (mục 5.11)
  /lib
    theme.ts                   # THEMES + computeThemeRoles() — xem mục 9
    /engine
      weightedRandom.ts        # Công thức 1: chọn ngẫu nhiên có trọng số từ 1 pool
      weeklyConstraint.ts      # Công thức 2: quy tắc bắt buộc hàng tuần cho pool 4 kỹ năng
      bandPrediction.ts        # Công thức 3: trung bình Cambridge + điều chỉnh theo tần suất, từng kỹ năng
      ieltsRounding.ts         # Quy tắc làm tròn Band tổng chính thức của IELTS
      countSoftReset.ts        # Cơ chế an toàn: giảm bớt bộ đếm khi count lớn nhất vượt ngưỡng
    /db
      schema.ts                # Định nghĩa bảng Drizzle (nguồn thông tin gốc cho cấu trúc DB)
      client.ts                # Client dùng chung 1 instance của better-sqlite3 + drizzle
      seed.ts                  # export hàm seedDatabase(db) — nhận bất kỳ instance db Drizzle nào, nên cả seedCli.ts
                                # (dùng cho ./dev.db thật) lẫn phần setup test e2e (dùng ./e2e-test.db dùng-rồi-bỏ)
                                # đều seed dữ liệu kỹ năng/part/config giống hệt nhau, không phải viết lặp lại
      seedCli.ts                # điểm vào của `npm run db:seed` — gọi seedDatabase(instance db thật)
    /types
      index.ts                 # Các type TS dùng chung (Skill, SkillPart, RollResult, v.v.)
  /tests
    setup.ts                   # dọn dẹp RTL + jest-dom matchers, chỉ dùng cho project "component" của vitest
    /unit                      # project "unit" của Vitest (môi trường node): mỗi file lib/*.ts là 1 file test riêng
    /component                 # project "component" của Vitest (môi trường jsdom): test RTL cho từng component tương tác
    /e2e                       # file test Playwright + testDbPath.ts (hằng số dùng chung) + setupDb.ts (xóa/migrate/seed
                                # DB e2e dùng-rồi-bỏ, nối vào lệnh webServer trong playwright.config.ts)
web/playwright.config.ts
web/package.json
web/tsconfig.json
web/README.md                  # README gốc của create-next-app (Milestone 6: dời từ gốc project vào đây)
```

`document.txt`, `PROJECT_CONTEXT.md`, `CLAUDE.md`, `TESTING_GUIDE.md`, `USER_GUIDE.md` **ở gốc project**, không nằm trong `web/` (dùng chung cho cả `web/` và `ai/`, xem mục 3 phần đầu).

Chi tiết bên trong `/ai` — xem mục 11.

---

## 4. Schema database (Drizzle ORM / SQLite)

Định nghĩa trong `src/lib/db/schema.ts` (đây mới là nguồn gốc thật sự — bảng dưới đây chỉ là mô tả lại):

```ts
skills               (id, code duy nhất, name, occurrenceCount mặc định 0, lastAppearedAt có thể null)
skillParts           (id, skillId -> skills.id, code duy nhất, name, baseRatio mặc định 0.5,
                       occurrenceCount mặc định 0, lastAppearedAt có thể null,
                       questionTypeRollCount mặc định 0 [số lần random dạng bài khi part này được
                       chọn — xem mục 5.7])
questionTypes        (id, skillId -> skills.id, code duy nhất, name, baseRatio mặc định 1.0,
                       occurrenceCount mặc định 0, lastAppearedAt có thể null)
                       // Pool dạng bài của 1 kỹ năng — dùng chung cho mọi part/block của kỹ năng đó,
                       // không tách riêng theo block. Speaking không có dòng nào ở bảng này. Xem mục 5.7.
rollSessions         (id, rolledAt mặc định là thời điểm hiện tại,
                       source mặc định "roll" ["roll" = qua Vòng quay | "manual" = tự ghi luyện tập, mục 5.8])
rollResults          (id, rollSessionId -> rollSessions.id, skillId -> skills.id,
                       skillPartId -> skillParts.id,
                       questionsAnswered có thể null, questionsCorrect có thể null)
                       // Đúng 2 dòng cho mỗi rollSession có source="roll" (1 dòng/kỹ năng được chọn);
                       // đúng 1 dòng cho mỗi rollSession có source="manual".
                       // questionsAnswered/questionsCorrect: chỉ điền sau, qua PATCH /api/results/:id/accuracy,
                       // chỉ áp dụng cho kết quả Reading/Listening (Formula 3 v2, mục 5.4).
rollResultQuestionTypes (id, rollResultId -> rollResults.id, questionTypeId -> questionTypes.id)
                       // 0..N dòng cho mỗi rollResult — N = questionTypeRollCount của part đó lúc quay
                       // (0 hoặc 1 với 1 lượt "manual", vì tự ghi chỉ chọn tối đa 1 dạng bài).
cambridgeTestResults (id, testDate, testName, readingBand, listeningBand, writingBand,
                       speakingBand, overallBand [tự tính bằng ieltsRound() ngay lúc ghi],
                       note có thể null, createdAt mặc định là thời điểm hiện tại)
dailyNotes           (id, noteDate, tags [cách nhau bằng dấu phẩy, ví dụ "Reading,Vocabulary"],
                       content, createdAt và updatedAt mặc định là thời điểm hiện tại)
config               (id, key duy nhất, value [dạng chuỗi; engine tự parse thành số/bool])
topics               (id, name, createdAt mặc định là thời điểm hiện tại)
                       // Chủ đề tự thêm của user (nút "+" ở Cài đặt) — hiện chỉ có tên, CHƯA gắn vào
                       // vòng quay. Sẽ mở rộng thêm trường sau. Xem mục 5.9.
```

Mọi khóa chính đều là `text` (sinh bằng `crypto.randomUUID()`), mọi cột thời gian đều lưu dạng số nguyên SQLite ở chế độ `{ mode: "timestamp" }` (tức là ra vào Drizzle dưới dạng `Date` của JS). Khóa ngoại dùng `.references()`; quan hệ để dùng query-builder (ví dụ `db.query.skills.findMany({ with: { parts: true } })`) được khai báo cùng mỗi bảng bằng helper `relations()` của Drizzle.

**Migration**: `npm run db:generate` (sinh file SQL vào `drizzle/migrations/`) → `npm run db:migrate` (áp dụng vào `./dev.db`). `npm run db:studio` mở Drizzle Studio (giao diện xem DB local) trên `./dev.db`. File `./dev.db` không được git track — ai lấy lại repo này thì chạy `db:migrate` rồi `db:seed` để tạo lại từ đầu.

**Dữ liệu khởi tạo (seed)** (hàm `seedDatabase()` trong `src/lib/db/seed.ts`, chạy trên DB thật qua `npm run db:seed` → `seedCli.ts`):

| Mã kỹ năng | Mã part | Tên | baseRatio |
|---|---|---|---|
| READING | READING_BLOCK_A | Block A (Passage 1+2) | 0.6 |
| READING | READING_BLOCK_B | Block B (Passage 3) | 0.4 |
| LISTENING | LISTENING_BLOCK_A | Block A (Part 1+4) | 0.5 |
| LISTENING | LISTENING_BLOCK_B | Block B (Part 2+3) | 0.5 |
| WRITING | WRITING_TASK1 | Task 1 | 0.5 |
| WRITING | WRITING_TASK2 | Task 2 | 0.5 |
| SPEAKING | SPEAKING_BLOCK_A | Block A (Part 1+2) | 0.6 |
| SPEAKING | SPEAKING_BLOCK_B | Block B (Part 3) | 0.4 |

**Dạng bài (question types)** — xem đầy đủ danh sách + tỉ lệ ở mục 5.7. Reading 10 dạng, Listening 7 dạng (`baseRatio` bằng nhau, `1.0`/dạng), Writing 7 dạng (4 dạng biểu đồ phổ biến `baseRatio 2.0`, 3 dạng hiếm hơn `baseRatio 1.0`), Speaking không có dòng nào.

**Config mặc định** (được seed vào bảng `Config`):

| key | mặc định | ý nghĩa |
|---|---|---|
| `decay_exponent` | `1.0` | `k` trong Công thức 1 |
| `weekly_threshold_days` | `7` | ngưỡng để kích hoạt quy tắc bắt buộc của Công thức 2 |
| `frequency_adjustment_factor` | `0.05` | độ dốc điều chỉnh theo tần suất trong Công thức 3 (mức trần ± giờ tính từ tỉ lệ trọng số tần suất × 9, không còn là 1 hằng số cố định — xem mục 5.4) |
| `overall_prediction_rounding_mode` | `per_skill_rounded` | cách tính Công thức 3: `per_skill_rounded` hoặc `raw_average` — xem mục 5.4 |
| `count_soft_reset_threshold` | `50` | ngưỡng kích hoạt cơ chế an toàn của Công thức 1 |
| `cambridge_ewma_alpha` | `0.5` | hệ số làm mờ EWMA cho điểm Cambridge trong Công thức 3 v2 — xem mục 5.4 |
| `accuracy_ewma_alpha` | `0.5` | hệ số làm mờ EWMA cho % câu đúng khi luyện tập trong Công thức 3 v2 — xem mục 5.4 |

(`frequency_adjustment_cap` của v1 đã bị loại bỏ — Công thức 3 v2 tự tính mức trần từ trọng số tần suất theo từng kỹ năng thay vì 1 hằng số cố định. Nếu DB cũ còn sót dòng key này thì vô hại, chỉ là không còn được đọc.)

---

## 5. Logic tính toán cốt lõi

### 5.1 Cách chia nhỏ Kỹ năng/Part

- **Writing**: 2 task (Task 1, Task 2) — chọn ngẫu nhiên 1 trong buổi luyện, tỉ lệ ban đầu bằng nhau (50/50).
- **Speaking**: 2 block — Block A (Part 1+2), Block B (Part 3) — tỉ lệ ban đầu 60/40 (ưu tiên Block A hơn; Part 3 khó hơn nên mặc định ra ít hơn). Người dùng chỉnh được qua UI (`PATCH /api/skills/parts/:id/ratio`).
- **Reading**: 2 block — Block A (Passage 1+2), Block B (Passage 3) — tỉ lệ ban đầu 60/40, lý do và cách chỉnh giống Speaking.
- **Listening**: 2 block — Block A (Part 1+4), Block B (Part 2+3) — tỉ lệ ban đầu bằng nhau (50/50).
- **Pool 4 kỹ năng**: mỗi buổi luyện chọn đúng 2 trong 4 {Reading, Listening, Writing, Speaking}, không lặp lại trong cùng 1 buổi, tỉ lệ ban đầu bằng nhau (1.0), chỉ bị thay đổi theo số lần đã xuất hiện.

### 5.2 Công thức 1 — Engine chọn ngẫu nhiên có trọng số

Dùng cho mọi pool ở trên (pool 4 kỹ năng, và pool 2 part của mỗi kỹ năng).

```
w_i = baseRatio_i * (1 / (count_i + 1)) ^ k
p_i = w_i / Σ_j w_j
```

- `baseRatio_i` = `SkillPart.baseRatio` (hoặc `1.0` với kỹ năng, vì kỹ năng không có trường ratio).
- `count_i` = `occurrenceCount` tại thời điểm quay.
- `k` = `Config.decay_exponent` (mặc định `1.0`).
- Cách chọn: quay kiểu "vòng quay may mắn" cộng dồn theo `p_i` — chọn 1 số ngẫu nhiên đều `r ∈ [0, Σw)`, duyệt qua tổng dồn trọng số, trả về mục đầu tiên có tổng dồn ≥ `r`. Cách này ánh xạ thẳng vào UI vòng quay (kích thước lát cắt = `p_i`).

**Quy trình chọn 2 trong 4 kỹ năng, không lặp:**
1. Tính Công thức 2 trước (quy tắc bắt buộc hàng tuần) — xem mục 5.3. Bước này có thể đã ép buộc chọn sẵn 0, 1, hoặc 2 kỹ năng.
2. Với (các) suất còn lại: tính `p_i` theo Công thức 1 trên các kỹ năng chưa được chọn, quay, loại kỹ năng vừa quay ra khỏi pool, tính lại `p_i` trên phần còn lại (count vẫn giữ nguyên — **không** cộng thêm giữa các lần quay), quay tiếp nếu còn 1 suất nữa.
3. Khi cả 2 kỹ năng đã chốt xong, với **từng** kỹ năng đã chọn, chạy Công thức 1 riêng trên pool 2 part của kỹ năng đó để chọn part/task.
4. Tăng `occurrenceCount` và đặt `lastAppearedAt = thời điểm hiện tại` cho cả 2 kỹ năng và 2 part đã chọn (tổng cộng 4 dòng được cập nhật). Ghi 1 dòng `RollSession` + 2 dòng `RollResult`.
5. Chạy `countSoftReset.ts` (xem mục 5.2.1) trên các pool liên quan sau khi đã tăng count.

**5.2.1 Cơ chế an toàn soft-reset bộ đếm**

Sau khi tăng count, với mỗi pool (pool 4 kỹ năng; pool part của từng kỹ năng), nếu `max(occurrenceCount)` trong pool đó ≥ `Config.count_soft_reset_threshold` (mặc định 50): thay mọi `occurrenceCount` trong pool đó bằng `floor(occurrenceCount / 2)`. Cách này giữ cho các con số không tăng vô hạn theo thời gian dùng app, mà vẫn giữ nguyên thứ tự công bằng tương đối. Cơ chế này **không** đụng vào lịch sử `RollResult` — log đó vĩnh viễn không đổi.

**Đánh giá (ghi rõ có chủ đích, không phải để "sửa lại" sau này mà không bàn trước):**
- Không bao giờ xác suất về đúng 0%; tự chuẩn hóa; xác định rõ ràng, dễ viết test đơn vị.
- Cố tình bỏ qua yếu tố thời gian gần đây — chỉ số lần thô mới quyết định hình dạng xác suất. Yếu tố thời gian gần đây chỉ được xử lý riêng ở Công thức 2.

### 5.3 Công thức 2 — Quy tắc bắt buộc hàng tuần (chỉ áp dụng cho pool kỹ năng)

```
overdue_i = (hôm nay - Skill.lastAppearedAt) >= Config.weekly_threshold_days ngày   // lastAppearedAt là null thì coi như "luôn quá hạn"
```

- Nếu có ≥1 kỹ năng quá hạn: sắp xếp các kỹ năng quá hạn theo số ngày chưa xuất hiện giảm dần, ép chọn tối đa 2 kỹ năng quá hạn nhất vào buổi luyện này.
- Suất còn lại (cần 0, 1, hoặc 2) được lấp bằng cách quay bình thường theo Công thức 1 trong số các kỹ năng không bị ép chọn, không lặp lại.
- Ràng buộc này **chỉ** áp dụng cho pool 4 kỹ năng, không áp dụng cho part/block (part chưa có đảm bảo tần suất tối thiểu ở bản v1 — xem `document.txt`).

### 5.4 Công thức 3 — Dự đoán Band điểm (v2 — Milestone 5 mở rộng)

> **v1 (mean phẳng 30 bài + nudge tần suất nhỏ) đã bị thay bằng v2 dưới đây** — lý do: điểm thi thật có thể dao động mạnh (hôm nay 2.5, tuần sau 4.5), lấy trung bình phẳng làm "mờ" thông tin mới nhất quá nhiều. v2 dùng EWMA (trung bình trọng số giảm dần) để quá khứ mờ dần, hiện tại chiếm ưu thế, và thêm thành phần "% câu đúng khi luyện tập" cho Reading/Listening.

Tính riêng cho từng kỹ năng:

```
cambridgeEwma_skill    = EWMA(lịch sử điểm <kỹ năng> của tối đa 30 kết quả thi thử Cambridge gần nhất, theo thứ tự thời gian, alpha = Config.cambridge_ewma_alpha)
accuracyEwma_skill     = (chỉ Reading/Listening) EWMA(lịch sử % câu đúng của tối đa 30 lượt luyện gần nhất có ghi số câu đúng,
                          theo thứ tự thời gian, alpha = Config.accuracy_ewma_alpha) — quy đổi sang thang 0-9 (× 9 / 100)
practiceCount30d_skill = số lần luyện kỹ năng này (roll hoặc manual) trong 30 ngày gần đây
avgPracticeCount30d    = trung bình practiceCount30d của cả 4 kỹ năng
frequencyDelta_skill   = giới hạn trong [-frequencyCap, +frequencyCap] của (practiceCount30d_skill - avgPracticeCount30d) * factor

// Reading & Listening (có accuracyEwma):
frequencyCap           = 0.05 × 9 = 0.45
weightedBase_skill     = 0.65 × cambridgeEwma_skill + 0.30 × (accuracyEwma_skill, hoặc cambridgeEwma_skill nếu chưa có dữ liệu % đúng)

// Writing & Speaking (không có accuracyEwma — không có tín hiệu đúng/sai khách quan):
frequencyCap           = 0.35 × 9 = 3.15
weightedBase_skill     = 0.65 × cambridgeEwma_skill

rawPredictedBand_skill = giới hạn trong [0, 9] của (weightedBase_skill + frequencyDelta_skill)
predictedBand_skill    = rawPredictedBand_skill được làm tròn tới 0.5 gần nhất, để hiển thị
```

**EWMA (Exponentially-Weighted Moving Average)** — `src/lib/engine/ewma.ts`:
```
EWMA₁ = giá trị đầu tiên (cũ nhất)
EWMAₜ = alpha × giá trị mới + (1 - alpha) × EWMAₜ₋₁
kết quả = EWMA của điểm mới nhất
```
`alpha` mặc định `0.5` cho cả `cambridge_ewma_alpha` và `accuracy_ewma_alpha` — nghĩa là mỗi điểm dữ liệu mới có trọng số ngang bằng TOÀN BỘ lịch sử trước đó cộng lại, phản ứng khá nhanh với thay đổi mới, đúng tinh thần "quá khứ mờ dần, hiện tại chủ yếu" mà không bao giờ loại bỏ hoàn toàn dữ liệu cũ (khác với "chỉ lấy N bài gần nhất rồi bỏ hẳn phần còn lại").

**Vì sao dùng EWMA, không dùng model học máy (GRU/LSTM)**: đã cân nhắc và loại bỏ theo yêu cầu — dữ liệu thực tế của app (1 user, mỗi kỹ năng có thể chỉ vài chục điểm thi) quá nhỏ để huấn luyện 1 mạng nơ-ron hồi quy mà không overfit, và app không có hạ tầng ML (Python/GPU/pipeline huấn luyện). EWMA đạt đúng yêu cầu "quá khứ mờ dần, hiện tại chủ yếu" bằng 1 công thức đóng, không cần huấn luyện, tính tức thì, giải thích được rõ ràng — đúng cỡ với quy mô dữ liệu thật của app.

**Nếu chưa có dữ liệu % đúng cho Reading/Listening**: `accuracyEwma_skill` trả về `null` (UI hiện "chưa có dữ liệu"), nhưng bên trong công thức tự động dùng `cambridgeEwma_skill` thay thế cho phần 30% đó — về mặt toán học tương đương `weightedBase = 0.95 × cambridgeEwma` (dồn trọng số về Cambridge cho tới khi có dữ liệu thật), không mất trọng số cũng không bịa số.

Nếu 1 kỹ năng **chưa có** kết quả thi thử Cambridge nào, cả `predictedBand_skill` và `rawPredictedBand_skill` đều là `null`, và UI hiện "chưa đủ dữ liệu" thay vì bịa ra 1 con số.

**Band tổng dự đoán — 2 cách tính, người dùng tự chọn** (qua `Config.overall_prediction_rounding_mode`, mặc định `per_skill_rounded`):

```
per_skill_rounded (mặc định): overallPredicted = ieltsOfficialRound( trung bình(predictedBand_reading, predictedBand_listening, predictedBand_writing, predictedBand_speaking) )
raw_average:                  overallPredicted = ieltsOfficialRound( trung bình(rawPredictedBand_reading, rawPredictedBand_listening, rawPredictedBand_writing, rawPredictedBand_speaking) )
```

(chỉ tính khi cả 4 dự đoán của từng kỹ năng đều khác null, ở bất kỳ cách nào).

Đây là 1 điểm mơ hồ thật sự trong thiết kế, phát hiện ra trong lúc review Milestone 1 Bước 2 (làm tròn từng kỹ năng trước, hay lấy trung bình chính xác rồi làm tròn 1 lần?) — được xử lý bằng cách cho user chọn qua công tắc bật/tắt thay vì chốt cứng 1 cách, vì cả 2 cách đều có lý riêng: `per_skill_rounded` giống cách chứng chỉ IELTS thật hoạt động (điểm từng kỹ năng luôn đã là 1 giá trị rời rạc, bước nhảy 0.5, trước khi tính điểm tổng từ đó), còn `raw_average` tránh việc làm tròn 2 lần chồng lên nhau. **Milestone 2 (Frontend/UI) phải đưa cái này thành 1 công tắc trên Bảng dự đoán** — xem mục Milestone 2 trong `CLAUDE.md` và trong `document.txt`.

### 5.5 Quy tắc làm tròn chính thức của IELTS (`ieltsRounding.ts`)

```ts
function ieltsRound(mean: number): number {
  const whole = Math.floor(mean);
  const frac = mean - whole;
  if (frac < 0.25) return whole;
  if (frac < 0.75) return whole + 0.5;
  return whole + 1;
}
```

Dùng cho cả `CambridgeTestResult.overallBand` (tính từ 4 điểm kỹ năng vừa nhập, ngay lúc ghi) và cho `overallPredicted` trong Công thức 3.

### 5.6 Chưa làm: Dự đoán Band v3 (Hồi quy tuyến tính OLS)

Mục 5.4 đã thay trung bình phẳng bằng EWMA — đó là "v2" (Milestone 5 mở rộng, đã xong). Bước tiếp theo (chưa làm): khi đã có đủ lịch sử `CambridgeTestResult` cho từng kỹ năng, sẽ thay (hoặc kết hợp) `cambridgeEwma_skill` bằng **hồi quy tuyến tính bình phương tối thiểu (OLS) riêng cho từng kỹ năng** (`band ~ testDate` hoặc `band ~ testIndex`), dùng giá trị dự đoán từ hồi quy đó thay cho (hoặc kết hợp với) EWMA. Đây sẽ là 1 bản thay thế trực tiếp cho `cambridgeEwma_skill` trong Công thức 3 — phần điều chỉnh theo tần suất/% đúng giữ nguyên không đổi. Đã ghi vào `document.txt`; chưa làm cho tới khi có đủ dữ liệu (xem điều kiện kích hoạt trong `document.txt`).

### 5.7 Dạng bài (question types) — Milestone 5

Mỗi kỹ năng (trừ Speaking) có 1 pool "dạng bài" riêng, dùng chung cho mọi block/part của kỹ năng đó (không tách theo block):

- **Reading** (10 dạng, `baseRatio 1.0`/dạng): Matching Headings, True-False-Not Given, Yes-No-Not Given, Multiple Choice (One Answer), Matching Information, Matching Features, Multiple Choice (Many Answers), Map/Diagram Label, Gap Filling, Other Types.
- **Listening** (7 dạng, `baseRatio 1.0`/dạng): Gap Filling, Map/Diagram Label, Multiple Choice (One Answer), Matching Information, Multiple Choice (Many Answers), Matching, Other Types.
- **Writing** (7 dạng, tỉ lệ lệch): Line Graph / Bar Chart / Pie Chart / Table (`baseRatio 2.0` — phổ biến hơn), Mixed Graph / Map / Process (`baseRatio 1.0` — hiếm hơn). **Chỉ áp dụng khi part được chọn là Task 1** — Task 2 luôn là bài luận, không có "dạng biểu đồ" (`WRITING_TASK2.questionTypeRollCount = 0`).
- **Speaking**: không có dạng bài, không có dòng nào trong `questionTypes`.

**Số lần random dạng bài mỗi khi 1 part được chọn** = `SkillPart.questionTypeRollCount`, khớp đúng số passage/part con gộp trong block đó (không phải 1 con số cố định cho mọi block):

| Part | questionTypeRollCount | Vì sao |
|---|---|---|
| READING_BLOCK_A | 2 | Gồm Passage 1+2 |
| READING_BLOCK_B | 1 | Chỉ có Passage 3 |
| LISTENING_BLOCK_A | 2 | Gồm Part 1+4 |
| LISTENING_BLOCK_B | 2 | Gồm Part 2+3 |
| WRITING_TASK1 | 1 | 1 biểu đồ/bài |
| WRITING_TASK2 | 0 | Bài luận, không có dạng |
| SPEAKING_BLOCK_A / B | 0 | Speaking không có dạng bài |

**Cách random**: dùng lại đúng Công thức 1 (`pickWeightedIndependent` trong `weightedRandom.ts`) trên pool `questionTypes` của kỹ năng đó, chạy N lần **độc lập** (N = `questionTypeRollCount`) — **cho phép trùng** giữa các lần (ví dụ 2 passage của Reading Block A có thể ra cùng 1 dạng câu hỏi, giống thực tế đề thi). Không tăng count giữa các lần random trong cùng 1 lượt quay (giống cách pool 4 kỹ năng không tăng count giữa 2 lượt chọn). Sau khi chốt, mỗi dạng bài được chọn cộng `occurrenceCount +1`/`lastAppearedAt = now`, rồi áp `countSoftReset.ts` cho pool dạng bài của kỹ năng đó (ngưỡng dùng chung `Config.count_soft_reset_threshold`).

Chưa có UI chỉnh tỉ lệ dạng bài ở milestone này — giống các hằng số engine khác, chỉ sửa được qua API/DB trực tiếp.

### 5.8 Cộng luyện thủ công (không qua vòng quay) — Milestone 5

`POST /api/practice`: cho lúc user tự học 1 kỹ năng mà không dùng Vòng quay. User tự chọn Kỹ năng + Part + (Dạng bài, nếu part đó có `questionTypeRollCount > 0`) — không random. Ghi vào đúng `rollSessions`/`rollResults`/`rollResultQuestionTypes` như 1 lượt quay thật, chỉ khác `rollSessions.source = "manual"` thay vì `"roll"`. Nhờ dùng chung bảng, lượt này tự động:
- Tính vào `occurrenceCount`/`lastAppearedAt` của Formula 1 (công bằng lâu dài) và Formula 2 (quy tắc hàng tuần) y hệt 1 lượt quay thật.
- Tính vào `practiceCount30d` của Formula 3 (điều chỉnh tần suất trong Bảng dự đoán) — không cần sửa `getPredictionData()`, vì hàm đó vốn đã đếm mọi dòng `rollResults` trong 30 ngày, không lọc theo `source`.
- Hiện trong `GET /api/history` cùng các lượt quay thật (phân biệt bằng `source`, UI gắn nhãn "Tự học").

### 5.9 Xóa lượt quay (hoàn tác) — Milestone 5

`DELETE /api/history/:sessionId` — xóa 1 `rollSession` (cả loại `"roll"` lẫn `"manual"`) và hoàn tác đúng những gì lượt đó đã cộng vào bộ đếm:

- Trừ lại `occurrenceCount` của skill/part/dạng bài liên quan (không cho xuống dưới 0).
- Tính lại `lastAppearedAt` bằng cách tra lịch sử còn lại (lượt gần nhất **sau khi đã xóa** lượt này) — không chỉ để nguyên giá trị cũ.
- Xóa `rollResultQuestionTypes` → `rollResults` → `rollSessions` (thủ công trong 1 transaction, không dùng `ON DELETE CASCADE` — nhất quán với cách các bảng khác trong schema đang quản lý xóa thủ công).

**Giới hạn đã biết (ghi chủ đích, không phải bug):** nếu `countSoftReset` (mục 5.2.1) đã chạy sau lượt quay bị xóa, việc trừ lại chỉ là "cố gắng tốt nhất" trên số đã bị giảm nửa — không thể tái tạo chính xác 100%. Chỉ ảnh hưởng sau 50+ lần xuất hiện của cùng 1 pool nên chấp nhận được, không chặn tính năng.

### 5.10 Trang thống kê theo kỹ năng — Milestone 5

`GET /api/stats/:skillCode` phục vụ trang `/stats/[skillCode]`: trả về `practiceLog` (mọi lần luyện kỹ năng đó — cả "roll" lẫn "manual" — kèm ngày và part) và `questionTypeStats` (số lần + % theo từng dạng bài; `null` với Speaking vì không có dạng bài). Xem `SkillStatsResponse` trong `src/lib/types/index.ts`.

### 5.11 Chủ đề (topics) — Milestone 5

`topics` (id, name, createdAt) — CRUD cơ bản qua `GET/POST /api/topics` và `DELETE /api/topics/:id`. Cố tình tối giản: chỉ có tên, **chưa** gắn vào vòng quay (không random chủ đề, không liên kết với skill/roll). Sẽ mở rộng thêm trường và (có thể) tích hợp vào vòng quay ở milestone sau, theo yêu cầu cụ thể hơn từ user.

### 5.12 Ghi số câu đúng khi luyện Reading/Listening — Milestone 5 mở rộng

`PATCH /api/results/:id/accuracy` — gắn `questionsAnswered`/`questionsCorrect` vào 1 `rollResult` đã tạo (từ 1 lượt quay hoặc tự học), điền **sau khi** luyện xong, không phải lúc quay. Chỉ áp dụng cho kết quả Reading/Listening (validate qua `skill.code`, trả 400 nếu không phải); `questionsAnswered > 0`, `0 <= questionsCorrect <= questionsAnswered`. Dữ liệu này nuôi `accuracyEwma_skill` trong Công thức 3 v2 (mục 5.4).

**2 điểm vào (entry point) cho UI nhập số câu đúng** (`AccuracyEntry.tsx`, tái dùng cho cả 2):
1. Ngay sau khi quay/tự học xong Reading/Listening (`Spinner.tsx`/`ManualPractice.tsx`) — tùy chọn, có thể bỏ qua lúc đó.
2. **Sau này, từ "Lượt quay gần đây"** (`RecentRolls.tsx`) — mỗi kết quả Reading/Listening chưa có `questionsAnswered` hiện nút "+ Nhập số câu đúng"; bấm vào mở form ngay trong dòng lịch sử đó. Thêm ở đây vì nếu bỏ qua lúc (1), trước đó **không có cách nào khác để quay lại nhập** — đây là điểm vào duy nhất cho các lượt đã qua.

`onSaved` của `AccuracyEntry` trả về `{ questionsAnswered, questionsCorrect }` vừa lưu, để nơi gọi (như `RecentRolls`) hiện lại đúng số ngay lập tức mà không cần tải lại toàn bộ lịch sử.

---

## 6. Hợp đồng API

| Method | Đường dẫn | Body / Query | Response |
|---|---|---|---|
| POST | `/api/roll` | — | `{ sessionId, results: [{ id, skill, part, questionTypes: [{id,code,name}], questionsAnswered: null, questionsCorrect: null }, ...] }` |
| GET | `/api/skills` | — | `[{ id, code, name, occurrenceCount, lastAppearedAt, parts: [{ id, code, name, baseRatio, occurrenceCount, lastAppearedAt, questionTypeRollCount }], questionTypes: [{ id, code, name, baseRatio, occurrenceCount, lastAppearedAt }] }]` |
| PATCH | `/api/skills/parts/:id/ratio` | `{ baseRatio: number }` (0–1; part còn lại tự chỉnh thành `1 - baseRatio`) | `SkillPart[]` — cả 2 part của kỹ năng (part vừa sửa và part còn lại), để UI cập nhật cả 2 thanh trượt từ 1 response, khỏi phải gọi lần 2 |
| GET | `/api/history` | `?limit=&offset=` | `{ total, items: [{ id, rolledAt, source, results: [{id, skill, part, questionTypes, questionsAnswered, questionsCorrect}, ...] }] }` |
| DELETE | `/api/history/:id` | — | `{ ok: true }` — xóa lượt quay/lượt tự học và hoàn tác bộ đếm (mục 5.9); 404 nếu không tìm thấy |
| POST | `/api/practice` | `{ skillCode, partCode, questionTypeCode? }` | `{ sessionId, resultId, source: "manual", skill, part, questionType }` — cộng luyện thủ công (mục 5.8) |
| PATCH | `/api/results/:id/accuracy` | `{ questionsAnswered, questionsCorrect }` | `{ id, questionsAnswered, questionsCorrect }` — ghi số câu đúng (mục 5.12), chỉ Reading/Listening |
| GET | `/api/stats/:skillCode` | — | `{ skill, practiceLog: [{rolledAt, source, part, questionsAnswered, questionsCorrect}, ...], questionTypeStats: [...] \| null }` (mục 5.10) |
| GET | `/api/notes` | `?date=` (tùy chọn) | `[{ id, noteDate, tags, content }]` |
| POST | `/api/notes` | `{ noteDate, tags, content }` | ghi chú vừa tạo |
| PATCH/DELETE | `/api/notes/:id` | `{ tags?, content? }` | ghi chú đã sửa/xóa |
| GET | `/api/cambridge` | `?limit=5` (mặc định, gần đây) hoặc `?all=true` | `[{ id, testDate, testName, readingBand, listeningBand, writingBand, speakingBand, overallBand, note }]` |
| POST | `/api/cambridge` | `{ testDate, testName, readingBand, listeningBand, writingBand, speakingBand, note? }` | dòng vừa tạo (`overallBand` tính ở server) |
| PATCH/DELETE | `/api/cambridge/:id` | các trường cần sửa | dòng đã sửa/xóa |
| GET | `/api/prediction` | — | `{ perSkill: { reading, listening, writing, speaking }, overall, sampleSizePerSkill, practiceCount30dPerSkill, hasEnoughData }` — mỗi phần tử `perSkill` giờ có `{ predictedBand, rawPredictedBand, cambridgeEwma, accuracyEwma, frequencyDelta, sampleSize }` theo Công thức 3 v2 (mục 5.4; thay cho `cambridgeAvg` của v1) |
| GET/PATCH | `/api/config` | body PATCH: `{ key, value }` | bảng config hiện tại (có `cambridge_ewma_alpha`, `accuracy_ewma_alpha` mới — mục 5.4) |
| GET/POST | `/api/topics` | POST body: `{ name }` | danh sách/tạo chủ đề (mục 5.11) |
| DELETE | `/api/topics/:id` | — | `{ ok: true }` |
| POST | `/api/chat` | `{ message: string, history?: {role: "user"\|"assistant", content: string}[] }` | `{ reply: string }` — route mỏng của AI/ML (Milestone 6), đọc DB qua `getChatContextSummary()` rồi gọi sang `ai/server/`; 503 nếu `ai/server/` chưa chạy, 502 nếu nó lỗi. Xem mục 11.4. |

---

## 7. Chiến lược test (tóm tắt — chi tiết đầy đủ ở [`TESTING_GUIDE.md`](./TESTING_GUIDE.md))

`vitest.config.mts` khai báo 2 **project** Vitest (cách hiện đại thay cho file workspace riêng / `environmentMatchGlobs` cũ), mỗi cái có môi trường riêng — `npm run test` chạy cả 2:

- **`unit`** (môi trường node, `src/tests/unit/**/*.test.ts`): mỗi hàm trong `lib/engine/*` và các module thuần túy khác (`tagUtils.ts`, `spinnerAnimation.ts`) đều có 1 file test riêng. Các trường hợp biên bắt buộc phải test: tất cả count bằng 0 (xác suất bằng nhau), 1 count vượt trội (tiệm cận nhưng không bao giờ về 0), ép chọn do quá hạn (0/1/2 kỹ năng quá hạn, 3+ kỹ năng quá hạn cùng lúc), kích hoạt soft-reset, ít hơn 30 và 0 dòng Cambridge, ranh giới clamp trong Công thức 3, mọi giá trị ranh giới của `ieltsRound` (.24/.25/.74/.75).
- **`component`** (môi trường jsdom qua React Testing Library, `src/tests/component/**/*.test.tsx`, setup ở `src/tests/setup.ts`): vòng quay hiện đúng cả 2 lựa chọn do server chọn (bản thân hiệu ứng quay được giả lập ở đây — độ đúng của thời gian/vị trí dừng là việc của project `unit`, không phải chỗ này); trích tag trong nhật ký + tương tác lọc theo tag; nút chuyển "5 gần nhất" và "Xem tất cả" của theo dõi Cambridge; các trạng thái của công tắc chuyển cách làm tròn. `src/tests/component/mockFetch.ts` là 1 hàm hỗ trợ dùng chung để giả lập chuỗi response `fetch` — bản thân nó không phải file test.
- **E2E (Playwright)**, `playwright.config.ts` + `src/tests/e2e/*.spec.ts`: quay đầy đủ 1 lượt (`roll.spec.ts`), tạo/lọc/sửa/xóa nhật ký (`journal.spec.ts`), thêm điểm Cambridge → bảng dự đoán cập nhật (`cambridge-prediction.spec.ts`), quay → xóa lượt quay → biến mất khỏi lịch sử (`delete-roll.spec.ts`), cộng luyện thủ công → hiện "Tự học" trong lịch sử (`manual-practice.spec.ts`), thêm/xóa chủ đề (`topics.spec.ts`), tự học Reading → nhập số câu đúng → lưu (`accuracy-entry.spec.ts`). **Lưu ý khi viết assertion cho Band dự đoán trong e2e**: đừng hard-code 1 con số Band cụ thể — mọi spec e2e dùng chung 1 `./e2e-test.db` (seed 1 lần trước khi build, không phải mỗi spec), nên tần suất luyện của 1 kỹ năng phụ thuộc vào spec nào chạy trước nó; `cambridge-prediction.spec.ts` từng hard-code `"6.5"` rồi vỡ khi `accuracy-entry.spec.ts` (chạy trước theo thứ tự alphabet) làm lệch tần suất Reading — sửa thành kiểm tra "có hiện 1 số Band hợp lệ", phần số học chính xác đã có unit test riêng ở `bandPrediction.test.ts`. Cascade dạng bài (mục 5.7) dùng animation nhanh hơn skill/part (`minSteps`/`baseDelayMs` nhỏ hơn trong lời gọi `runCycleAnimation` ở `Spinner.tsx`) — 1 lượt quay có thể xếp chồng tới 4 lần random dạng bài (2 kỹ năng × 2 đoạn), chạy ở tốc độ skill/part gốc từng khiến `roll.spec.ts`/`delete-roll.spec.ts` timeout không ổn định trong trường hợp "xui" (rơi đúng chỉ số cần nhiều bước quay nhất). Chạy trên **bản build production** (`next build && next start`), không phải `next dev` — Next 16 không cho chạy instance `next dev` thứ 2 cho cùng 1 thư mục dự án dù khác cổng (Next 16 khóa dev-server chỉ cho 1 instance), sẽ xung đột với `npm run dev` đang chạy tay trong lúc phát triển. Chuỗi lệnh webServer là `tsx src/tests/e2e/setupDb.ts && next build && next start -p 3100`: `setupDb.ts` xóa, migrate, và seed 1 file `./e2e-test.db` dùng-rồi-bỏ (qua `DATABASE_PATH`, cơ chế mà `client.ts` đã hỗ trợ sẵn) *trước khi* build, nên file `./dev.db` thật không bao giờ bị đụng tới, và mỗi lần chạy e2e đều bắt đầu từ đúng 1 trạng thái dữ liệu giống hệt nhau. (Có thử cách khác trước đó, dùng hook `globalSetup` của Playwright — nhưng thứ tự chạy so với lúc webServer khởi động không đảm bảo "luôn chạy xong trước" như tưởng, khiến DB test có 0 bảng lúc chạy. Nối setup vào chung 1 lệnh shell bằng `&&` giải quyết dứt điểm vấn đề này.) Chạy bằng `npm run test:e2e`.

---

## 8. Lộ trình / tính năng để sau

Xem [`document.txt`](./document.txt) để có danh sách đầy đủ, cập nhật liên tục (đăng nhập, deploy cloud, Dự đoán Band v2, tần suất tối thiểu hàng tuần ở cấp part, v.v.).

---

## 9. Hệ thống theme (giao diện màu)

Các bảng màu gốc nằm ở `src/theme/*.png` (6 dải màu sáng→tối có tên + 12 bảng 4-màu xuất từ Color Hunt — tên file của nhóm sau mã hóa thẳng mã hex, ví dụ `Color Hunt Palette 3368a066a3bfc8dfdbf2efe7.png` = `#3368a0/#66a3bf/#c8dfdb/#f2efe7`). `src/lib/theme.ts` định nghĩa `THEMES` (19 theme, kể cả 1 theme `"default"` giống giao diện gốc của app) và hàm `computeThemeRoles(colors)`, tính ra 9 vai trò màu UI dùng được từ 4 màu gốc của mỗi theme:

```
background, foreground     — 1 cặp màu sáng/tối trung tính, CỐ ĐỊNH THẬT SỰ cho MỌI theme kể cả theme tối
                              (không bao giờ lấy từ bảng màu gốc, không còn đổi theo isDark — xem "khung ngoài"
                              bên dưới); foreground được "pha" 1 chút màu chủ đạo của theme — xem đoạn dưới
surface, border             — màu trong bảng màu gần nhất với "tầng" độ sáng mục tiêu (tạo sắc nhẹ cho thẻ/card);
                              ĐÂY là nơi duy nhất 1 theme tối còn thể hiện — xem "khung ngoài" bên dưới
surfaceForeground            — màu chữ dùng CHO CHỮ NẰM TRONG 1 thẻ/card theo theme (khác với `foreground` ở
                              trên, vốn giờ chỉ dùng cho chữ nằm trực tiếp trên nền trang) — xem bên dưới
primary, primaryForeground — màu bão hòa/độ sáng vừa phải, dễ dùng nhất trong bảng màu, dùng cho nút/điểm nhấn;
                             tự tạo ra (giữ nguyên tông màu, tăng độ bão hòa/giới hạn độ sáng) nếu không màu nào
                             trong 4 màu gốc đạt yêu cầu — vài bảng màu gốc là 4 màu pastel gần giống độ sáng,
                             không có màu nào đủ tối/đủ bão hòa để làm nút cho dễ đọc
input, inputForeground    — 1 cặp màu "mặt giấy viết" cho ô nhập liệu (chữ/số/ngày, textarea)
                             LUÔN sáng, bất kể bản thân theme là sáng hay tối
```

`background`/`foreground` cố tình KHÔNG lấy từ màu sáng nhất/tối nhất của chính bảng màu: 1 số bảng màu gốc (ví dụ "Sorbet": `ffeecc/ffddcc/ffcccc/febbcc`) là 4 màu pastel, không hề có màu nào thật sự tối, nên nếu lấy thẳng 2 màu cực trị của bảng màu thì chữ sẽ không đọc được. `isDark` trong `ThemeRoles` **không** dựa vào độ sáng trung bình của bảng màu, mà dựa vào số lượng: `isDark` chỉ là true khi có ít hơn 2 trong 4 màu gốc của bảng màu tự nó đã sáng (`relativeLuminance >= 0.4`). Cách này thay cho ngưỡng độ sáng trung bình phẳng trước đây, sau khi có 1 báo lỗi: theme "Forest" (`499a13/bbdc12/8eca3c/276f27`) có độ sáng trung bình ~0.37 dù 2 trong 4 màu của nó là xanh lá tươi, sáng rõ, nên quy tắc dựa trên trung bình đã hiển thị nó thành chế độ tối hoàn toàn trong khi user mong đợi 1 theme thiên nhiên tươi sáng, dùng các màu đó làm điểm nhấn — quy tắc dựa trên số lượng đã phân loại lại nó thành theme sáng, mà vẫn giữ đúng các theme thật sự định làm tối ("Dark Cold", "Dark Winter", mỗi cái chỉ có 1 trong 4 màu đạt chuẩn sáng) không bị ảnh hưởng. **Từ Milestone 5 mở rộng trở đi, `isDark` chỉ còn quyết định 1 việc**: `surface` (nền thẻ/card) của theme đó tối hay sáng — không còn quyết định `background`/`foreground` nữa, xem đoạn "Tách giao diện web/ứng dụng" ngay dưới đây.

**Tách giao diện web/ứng dụng — "khung ngoài" luôn sáng cố định (Milestone 5 mở rộng)** — user báo: "khi tôi để web giao diện dark thì rất tối và khó nhìn". Trước đây `background`/`foreground` cũng đổi theo `isDark` giống `surface`, nên chọn 1 trong 2 theme tối ("Dark Cold"/"Dark Winter") làm cả trang — kể cả thanh nav — chuyển sang nền gần đen (`#0a0a0a`). User xác nhận hướng sửa cụ thể: "Khung ngoài (nav, nền trang) luôn sáng cố định, chỉ nội dung bên trong đổi theo theme". Cách sửa (`computeThemeRoles` trong `src/lib/theme.ts`):
- `background`/`foreground` bỏ hẳn nhánh theo `isDark` — luôn là cặp sáng cố định (`#ffffff` + `foreground` near-black đã tint hue) cho **mọi** theme. Đây là màu "khung ngoài"/"page shell": `<body>` và mọi chữ nằm trực tiếp trên nền trang (tiêu đề, đoạn mô tả ở đầu mỗi trang — không nằm trong `bg-surface`).
- `surface`/`border` **vẫn** đổi theo `isDark` như cũ — đây giờ là nơi DUY NHẤT giữ "chất tối" của 1 theme tối. Với theme tối, `surface` không còn lấy thẳng màu tối nhất trong 4 màu gốc nữa (hàm cũ `pickClosestLightness(colors, 0.16)` — gần đen, ví dụ "Dark Cold" ra `#0c1440` ở độ sáng ~0.15) mà dùng hàm mới `pickDarkSurface()`: giữ nguyên tông màu (hue) của màu tối nhất trong bảng màu gốc, nhưng tự tổng hợp lại ở độ sáng cố định `SURFACE_DARK_LIGHTNESS = 0.24` và giới hạn độ bão hòa `SURFACE_DARK_MAX_SATURATION = 0.32` — ra 1 màu XÁM ĐẬM có sắc (navy cho "Dark Cold" → `#2a3051`, xanh ngọc cho "Dark Winter" → `#2a4c51`), không còn gần đen, đúng theo yêu cầu "Nền tối sáng hơn (xám đậm thay vì gần đen)". Bảng màu gốc của 2 theme này (`src/theme/DarkColdColor.png`/`DarkWinterColor.png`) giữ nguyên không đổi — chỉ cách tổng hợp `surface` từ chúng thay đổi; sau khi rà lại không thấy cần thêm theme tối nào khác hay đổi phân loại `isDark` của theme nào (2 theme tối hiện có là đủ, các theme còn lại vẫn đúng là theme sáng theo đúng số liệu `lightComponentCount`).
- Vai trò mới `surfaceForeground`: vì `surface` vẫn có thể tối trong khi `background`/`foreground` giờ luôn cố định sáng, chữ nằm *bên trong* 1 thẻ/card không thể dùng `foreground` cố định nữa (chữ gần đen cố định trên 1 thẻ nền tối = gần như không đọc được — đúng rủi ro ngược mà việc tách khung ngoài/trong tạo ra). `surfaceForeground` được chọn theo đúng cách tối đa hóa độ tương phản mà `primaryForeground`/`inputForeground` đã dùng: `#111111` hay `#ffffff`, cái nào tương phản với `surface` cao hơn. Có test WCAG AA (`src/tests/unit/theme.test.ts`) đảm bảo `surface`/`surfaceForeground` đạt ≥ 4.5:1 cho cả 19 theme, giống hệt kiểu test đã có cho `input`/`primary`.
- `Nav.tsx` (thanh điều hướng — nửa còn lại của "khung ngoài"): đổi từ `bg-surface/80` sang `bg-background/80` — giờ `background` đã luôn cố định sáng nên nav bar tự động "luôn sáng" theo đúng yêu cầu mà không cần logic riêng; `text-foreground` giữ nguyên (đã an toàn vì `foreground` cũng cố định sáng-nền/tối-chữ rồi).
- Đã rà toàn bộ ~17 file dùng `text-foreground` (`grep -rl text-foreground src/components src/app`) để phân biệt chữ nằm trực tiếp trên nền trang (giữ `text-foreground`, ví dụ tiêu đề `<h1>` đầu mỗi trang) với chữ nằm trong 1 `bg-surface`/`bg-surface/NN`/`bg-border` (đổi sang `text-surface-foreground`, ví dụ toàn bộ `NoteCard.tsx`, `CambridgeRow.tsx`, `PickCard.tsx`, các form trong `bg-surface` của `Journal.tsx`/`CambridgeTracker.tsx`/`RatioSliders.tsx`/`RoundingModeToggle.tsx`/`ManualPractice.tsx`/`Topics.tsx`, các card trong `PredictionCards.tsx`/`RecentRolls.tsx`/`PracticeLog.tsx`/`stats/[skillCode]/page.tsx`). 2 phát hiện thêm ngoài việc grep đơn thuần theo class `text-foreground`: (1) `RecentRolls.tsx`/`PracticeLog.tsx` dùng `bg-surface/70` (trong suốt 1 phần) — trước đây ổn vì `background` cùng "tầng" sáng/tối với `surface`, nhưng giờ `background` luôn sáng nên 1 `surface` tối pha trong suốt sẽ bị nhạt loãng về phía nền trang sáng thay vì giữ tối — đổi sang `bg-surface` đặc hẳn; (2) `AccuracyEntry.tsx` được dùng ở 2 ngữ cảnh khác nhau (trực tiếp trên trang trong `Spinner.tsx`, và lồng trong thẻ `bg-surface` của `ManualPractice.tsx`) nên được thêm prop `variant?: "page" | "surface"` để chọn đúng vai trò màu chữ theo từng nơi gọi, thay vì đoán sai 1 trong 2 chỗ. `ThemePicker.tsx` (không dùng class `text-foreground` nên không lọt qua grep, nhưng dùng `computeThemeRoles` trực tiếp): đổi preview mỗi ô theme từ `roles.background`/`roles.foreground` sang `roles.surface`/`roles.surfaceForeground` — nếu không đổi, mọi ô preview sẽ trông giống hệt nhau (đều trắng) vì `background` giờ không đổi theo theme nữa, mất tác dụng "xem trước" đúng thứ người dùng chọn (giao diện thẻ/card).
- Hiệu ứng "phản quang"/glow cho thẻ tối: class `.surface-glow` mới trong `globals.css` (`@layer utilities`, cùng họ với `.input-paper` đã có) — 1 `box-shadow` nhiều lớp (bóng đổ mềm + quầng sáng mờ cùng màu `var(--surface)`) gắn thêm vào mọi container `bg-surface` chính (không đổi bố cục, không đổi `border`/`bg-surface` đang dùng). Với theme sáng (`surface` ~0.94 sáng), quầng sáng gần như không thấy — không cần hiệu ứng, thẻ vốn đã sáng gọn; với theme tối, quầng sáng giúp thẻ trông có chiều sâu thay vì 1 khối xám phẳng — nên 1 rule dùng chung cho cả 2 trường hợp, không cần rẽ nhánh sáng/tối riêng. Không gắn `.surface-glow` cho trạng thái "dimmed" của `PickCard.tsx` (`bg-surface/50`) vì trạng thái đó cố tình mờ dần về phía nền trang, thêm glow sẽ ngược lại chủ đích.

**Màu chữ theo theme (Milestone 5)** — trước đây `foreground` là hằng số phẳng (`#171717`/`#ededed`), giống hệt nhau cho cả 19 theme, dù nền/điểm nhấn đã đổi màu — bị báo là "màu chữ chỉ có trắng với đen, muốn đổi cho hợp theme". Hàm `tintNeutral()` giữ nguyên **độ sáng (lightness)** gốc của cặp đen/trắng cố định (để không đụng tới độ tương phản), chỉ đổi **tông màu (hue)** sang tông chủ đạo của theme đó (`dominantHue()` — màu bão hòa nhất trong 4 màu gốc, cùng tín hiệu mà `pickPrimary()` đã dùng), ở độ bão hòa rất thấp (`0.06`) — đủ để cảm nhận được sự khác biệt giữa các theme khi đặt cạnh nhau, nhưng vẫn đọc là "gần như đen/trắng" khi nhìn riêng lẻ. `background` cố tình **không** đổi (giữ nguyên hex cố định) — tô cả vùng nền lớn dễ khiến trang trông "có màu" thay vì trung tính, đi ngược lại đúng lý do `background`/`foreground` phải cố định ở trên. Có test riêng đảm bảo độ tương phản `background`/`foreground` vẫn ≥ 4.5:1 (WCAG AA) cho mọi theme, và test đảm bảo 2 theme khác tông màu (ví dụ "cold" và "ch-forest") ra `foreground` khác nhau — xem `src/tests/unit/theme.test.ts`.

`input`/`inputForeground` sinh ra để sửa 1 lỗi liên quan đã được báo: ô nhập liệu ban đầu dùng `bg-background` — chính là màu nền cố định của theme, gần đen với 1 theme bị phân loại tối — nên 1 ô textarea có thể hiện ra như 1 hộp tối gần như vô hình nằm trong 1 thẻ sáng hơn nhiều. Hàm `pickInputBackground()` chọn *màu sáng nhất trong 4 màu gốc của theme* (để ô nhập liệu vẫn mang cảm giác thuộc về theme đó), sau đó áp ngưỡng tối thiểu `0.85` cho độ sáng HSL — nếu ngay cả màu sáng nhất cũng chưa đạt (ví dụ "Dark Cold" có `#afcffa` ở mức ~0.833), màu đó sẽ được làm sáng thêm trong không gian HSL, vẫn giữ tông màu/độ bão hòa (giới hạn độ bão hòa tối đa `0.4`) thay vì giữ nguyên hoặc thay bằng trắng phẳng. Việc này chạy độc lập với `isDark`, nên ô nhập liệu vẫn sáng ngay cả với các theme thật sự tối về tổng thể. `inputForeground` sau đó được chọn theo cách tối đa hóa độ tương phản giống `primaryForeground` (bên dưới): chọn `#111111` hoặc `#ffffff`, cái nào cho tỉ lệ tương phản cao hơn so với `input` — xem `src/tests/unit/theme.test.ts` để thấy test "đảm bảo độ tương phản đạt chuẩn WCAG AA (>= 4.5:1) giữa input và inputForeground cho mọi theme đã định nghĩa".

**Lúc chạy thật**: `src/components/theme/ThemeProvider.tsx` bọc quanh toàn app (trong `layout.tsx`). Nó đọc lựa chọn đã lưu từ `localStorage` (key `ielts-app-theme`) bằng **lazy initializer** của `useState` — không dùng `useEffect` — để tránh đúng lỗi `react-hooks/set-state-in-effect` đã ghi ở lịch sử Milestone 2 Bước 2 trong mục 2.1; effect thật sự áp dụng theme (`document.documentElement.style.setProperty(...)` cho `--background`/`--foreground`/`--surface`/`--surface-foreground`/`--border`/`--primary`/`--primary-foreground`/`--input`/`--input-foreground`) không gọi `setState` nào, nên không bị lỗi đó. `src/app/globals.css` ánh xạ 9 CSS custom property này qua `@theme inline` thành các class Tailwind (`bg-surface`, `text-surface-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `bg-input`, `text-input-foreground`, v.v.) — code component chỉ dùng đúng các class đó, không bao giờ viết mã hex trực tiếp, nên mọi bề mặt có theme đều đổi màu khi user chọn theme khác. `src/components/theme/ThemePicker.tsx` (hiện ở trang `/settings`) là UI để chọn; bấm vào 1 ô màu sẽ gọi `setThemeId`, áp theme mới và lưu lại lựa chọn.

**Kiểu "tờ giấy" cho ô nhập liệu**: mọi ô nhập chữ/ngày/số và textarea (ô ngày và textarea trong `Journal.tsx`; các ô ngày/tên/điểm/ghi chú trong `CambridgeTracker.tsx`) dùng chung 1 class `.input-paper` (trong `globals.css`, thuộc `@layer utilities`) thay vì dùng thẳng `bg-input text-input-foreground` — có báo lỗi cho thấy nếu chỉ tô màu nền phẳng thì ô vẫn trông như 1 hộp phẳng, ít tương phản trên 1 thẻ nhiều màu. `.input-paper` thêm viền màu rõ ràng (`color-mix(in srgb, var(--primary) 35%, transparent)` — viền thật, không phải vai trò `border` gần như trong suốt) và 1 `box-shadow` nhiều lớp (1 bóng đổ mềm tạo cảm giác nổi lên + 1 quầng sáng rộng, mờ, cùng màu `var(--input)` của ô) để mỗi ô nhập liệu trông như 1 "tờ giấy" nổi bật, tách biệt, thay vì bị hòa lẫn vào màu phẳng của thẻ xung quanh. Trạng thái focus đổi viền thành `var(--primary)` đặc và làm quầng sáng rõ hơn. Trình duyệt không hỗ trợ `color-mix()` sẽ tự động dùng viền `var(--primary)` đặc làm phương án dự phòng (Lightning CSS tự sinh cả 2, có `@supports` kiểm soát).

Các màu trạng thái/ý nghĩa cố định (xóa = đỏ, trạng thái "đang quay"/"đã chọn" của Vòng quay = xanh dương/xanh ngọc) cố tình để là màu Tailwind cố định, không theo theme — cùng lý do với quy tắc "màu trạng thái luôn cố định" trong bảng màu dataviz. "Cố định" nghĩa là cố định thật: những màu này không bao giờ được dùng biến thể `dark:` của Tailwind. Cách `dark:` mặc định của Tailwind biên dịch ra `@media (prefers-color-scheme: dark)`, nên trước đây 1 vài chỗ vô tình có biến thể `dark:` khiến chúng (và, riêng biệt, 1 khối `@media (prefers-color-scheme: dark) { :root {...} }` còn sót lại từ create-next-app, đè lên `--background`/`--foreground`/v.v. của chính hệ thống theme) tự đổi theo lựa chọn sáng/tối của hệ điều hành/trình duyệt — đây là lỗi có thật, từng bị báo: 1 theme sáng chọn trong app vẫn hiện ra tối vì bản thân trình duyệt đang ở chế độ tối. Cả 2 chỗ đó đã được gỡ bỏ: hệ thống theme của app (chỉ do lựa chọn ở trang Cài đặt của user quyết định, lưu trong `localStorage`) giờ là nguồn duy nhất quyết định mọi màu trên trang, không phụ thuộc gì vào `prefers-color-scheme` nữa.

**`color-scheme`**: `layout.tsx` khai báo `viewport = { colorScheme: "light" }` (giá trị nền trước khi hydrate, đa số theme là sáng) và hàm `applyTheme()` của `ThemeProvider` đặt `documentElement.style.setProperty("color-scheme", roles.isDark ? "dark" : "light")` theo đúng theme đang dùng. Đây là 1 tín hiệu CSS/meta thật sự (đã kiểm chứng: `getComputedStyle(html).colorScheme` phản ánh đúng giá trị) báo cho trình duyệt biết là trang tự quản lý giao diện sáng/tối của chính nó — được thêm vào sau khi có báo lỗi tiếp theo: trang vẫn hiện tối trên 1 trình duyệt nền Chromium (Cốc Cốc) dù đã chọn theme sáng và đã gỡ bỏ phụ thuộc vào `prefers-color-scheme` ở trên. Nguyên nhân gốc rất có thể là tính năng "ép chế độ tối cho nội dung web" có sẵn trong chính trình duyệt đó (Cốc Cốc có nút này trên thanh công cụ, khác với *lựa chọn* sáng/tối của hệ điều hành/trình duyệt mà app đã ngừng theo ở trên) — đây là 1 bộ lọc ở cấp trình duyệt mà CSS của 1 trang web không thể ghi đè hoàn toàn; `color-scheme` là tín hiệu "xin phép không áp dụng" theo chuẩn mà 1 số (không phải tất cả) tính năng kiểu này có kiểm tra, nên đây chỉ là cách khắc phục ở mức cố gắng tối đa, không phải đảm bảo chắc chắn. Đã kiểm chứng bằng 1 trình duyệt Playwright mới hoàn toàn (không bật tính năng đó) rằng logic của app đã tự cho ra đúng nền sáng cho theme "Forest" — xác nhận lỗi phía app đã được sửa xong, và bất kỳ khác biệt nào còn lại là do tính năng tự tô lại màu trang riêng của trình duyệt đó, không phải do code của app.

---

## 10. Framework nhiều vai trò (multi-agent)

Xem [`CLAUDE.md`](./CLAUDE.md) để biết vai trò từng bên, quy trình review, và kế hoạch thực hiện theo milestone.

---

## 11. Chatbot AI (Milestone 6/7/8)

> Phạm vi/quyết định đầy đủ (vì sao chọn model này, vì sao không dùng Claude sinh dữ liệu train, các câu hỏi đã hỏi user...) nằm ở [`AI_CHATBOT_PLAN.md`](./AI_CHATBOT_PLAN.md). Mục này chỉ tóm tắt kiến trúc hiện có — cập nhật dần khi Milestone 6/7/8 tiến triển, đúng quy tắc "đổi kiến trúc/API thì sửa doc cùng bước" ở đầu file.

### 11.1 Vì sao tách hẳn thành module `ai/` riêng

Chatbot có bộ dependency hoàn toàn khác `web/` (chạy model AI, không phải Next.js) và có thể lỗi/chậm mà không được phép kéo app luyện thi IELTS đang chạy tốt xuống theo. Ranh giới module: `ai/` không import gì từ `web/src/` và ngược lại — 2 bên chỉ nói chuyện qua HTTP (route API mỏng ở `web/src/app/api/chat/` gọi sang server suy luận của `ai/server/`).

### 11.2 Model đang dùng

| Việc | Model | Ghi chú |
|---|---|---|
| Chatbot chạy local | Qwen3.5-4B-Instruct, GGUF 4-bit | Apache 2.0. Xem `AI_CHATBOT_PLAN.md` mục 5 để biết lý do chọn và các model đã cân nhắc. |
| Sinh dữ liệu train (chỉ chạy Kaggle, Milestone 7) | Qwen3.5-9B-Instruct | Không dùng Claude — lý do pháp lý ở `AI_CHATBOT_PLAN.md` mục 6. |
| Chấm Speaking — chuyển giọng nói thành chữ (Milestone 8) | faster-whisper (small/medium) | Chạy CPU để không giành VRAM với Qwen4B. |

### 11.3 Cấu trúc `ai/`

```
ai/
  models/           # file model đã tải (.gguf...) — gitignore, không track, quá nặng
  data/
    raw/            # tài liệu nguồn cho RAG/train — gitignore
    processed/      # dữ liệu đã xử lý (chunk cho RAG, cặp hỏi-đáp cho train) — gitignore
  training/         # script/notebook fine-tune (chạy trên Kaggle)
  server/           # server suy luận nội bộ, web/ gọi vào đây qua HTTP
  AI_TASKS.md        # checklist chi tiết, cập nhật theo từng bước
```

### 11.4 Hợp đồng API (nối vào `web/`)

**`POST web/src/app/api/chat/route.ts`** — cũng có ở bảng mục 6. Chi tiết luồng xử lý:

1. Validate `message` (string không rỗng) và `history` (mảng `{role, content}`, tùy chọn) — 400 nếu sai.
2. Gọi `getChatContextSummary()` (`web/src/lib/db/queries.ts`) — đọc DB của `web/` (10 lượt luyện gần nhất, 5 kết quả Cambridge gần nhất, 5 ghi chú gần nhất), gói thành 1 đoạn text ngắn. Đây là **lần đọc DB duy nhất** ở phía `web/` cho tính năng chat — `ai/` không bao giờ tự đọc `dev.db`.
3. `fetch` sang `ai/server/` (`POST {AI_SERVER_URL:-http://127.0.0.1:8787}/chat`) với `{ message, history, dbContext }`, timeout 60s.
4. `ai/server/` trả `{ reply: string }` — route chuyển tiếp nguyên văn. Không tới được / lỗi / timeout → 503; `ai/server/` trả lỗi → 502; response thiếu `reply` string → 502.

**`POST ai/server/` `/chat`** (nội bộ, không public, chỉ `web/` gọi tới) — request `{ message, history, dbContext }`, response `{ reply: string }`. Bên trong: embed `message` (model embedding của Ollama) → tìm top-k đoạn tài liệu liên quan (RAG trên `PROJECT_CONTEXT.md`/`USER_GUIDE.md`/`document.txt`, đã chunk+embed sẵn vào `ai/data/processed/`) → ghép prompt (chỉ dẫn hệ thống + đoạn tài liệu liên quan + `dbContext` + `history` + `message`) → gọi Ollama (`qwen3.5:4b`) sinh câu trả lời.

**Chưa làm (còn lại của Milestone 6):** `ai/server/` (FastAPI) + script build index RAG chưa viết; route/trang phía `web/` đã xong và tự-kiểm xanh (component test `ChatWindow.test.tsx` mock fetch), nhưng chưa test được đầu-cuối thật vì chưa có `ai/server/` để gọi tới — flag theo đúng tinh thần QA "không âm thầm bỏ qua": 1 e2e case cho luồng chat sẽ thêm sau khi `ai/server/` chạy ổn định, cuối Milestone 6.
