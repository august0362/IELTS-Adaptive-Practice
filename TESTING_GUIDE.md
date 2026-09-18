# TESTING_GUIDE.md — Cách chạy và mở rộng bộ test

> Đây là hướng dẫn thao tác cho bộ test đã mô tả ở `PROJECT_CONTEXT.md` mục 7. Đọc mục đó trước để biết *bộ test bao phủ những gì* và *tại sao lại chia như vậy*; file này chỉ nói *cách làm* — lệnh chạy, quy ước, và cần thêm gì khi bạn sửa code.

---

## 1. Chạy test

| Lệnh | Chạy gì |
|---|---|
| `npm run test` | Vitest, cả 2 project (`unit` + `component`), chạy 1 lần |
| `npm run test:watch` | Vitest, cả 2 project, chế độ theo dõi liên tục |
| `npx vitest run --project unit` | Chỉ chạy test hàm thuần túy (nhanh, không có DOM) |
| `npx vitest run --project component` | Chỉ chạy test component bằng RTL |
| `npm run test:e2e` | Playwright — build app, chạy trên 1 DB riêng và cổng 3100, chạy hết các kịch bản |
| `npm run typecheck` | `tsc --noEmit` (chạy `next typegen` trước — xem ghi chú ở mục 3) |
| `npm run lint` | ESLint (bao gồm cả các rule hooks dựa trên React Compiler — xem mục 4) |

Chạy `typecheck` + `lint` + `test` trước mỗi lần commit. Chạy `test:e2e` trước khi chốt xong 1 milestone, hoặc sau khi đụng vào bất cứ gì trong `src/app/api/**`, cách 1 trang lấy dữ liệu, hoặc chính các file Playwright — lệnh này chậm hơn (build production đầy đủ) nên không nằm trong vòng kiểm tra nhanh sau mỗi bước.

---

## 2. Test mới thì để ở đâu

| Bạn sửa gì... | Thêm test ở đâu... |
|---|---|
| 1 hàm thuần túy trong `src/lib/engine/**` hoặc module `src/lib/*.ts` khác | `src/tests/unit/<module>.test.ts` (môi trường node — không có DOM, không có React) |
| 1 component React trong `src/components/**` | `src/tests/component/<Component>.test.tsx` (jsdom + React Testing Library) |
| 1 luồng người dùng đầy đủ, xuyên qua nhiều trang/API (quay, CRUD nhật ký, Cambridge → dự đoán) | `src/tests/e2e/<flow>.spec.ts` (Playwright, trình duyệt thật, build thật) |

Đặt tên file: test unit/component phải kết thúc bằng `.test.ts`/`.test.tsx` (khớp với glob `include` của từng project trong `vitest.config.mts`); test e2e phải kết thúc bằng `.spec.ts` (khớp `testMatch` của `playwright.config.ts`). File nào đặt tên sai đuôi sẽ âm thầm không bao giờ được chạy — nếu thêm file test mới mà không thấy số lượng test tăng lên, kiểm tra đuôi file trước tiên.

---

## 3. Vài cái "bẫy" môi trường đã từng gặp (đừng gặp lại)

- **Alias đường dẫn `@`**: Vitest thuần không đọc config bundler của Next.js, nên `vitest.config.mts` phải tự khai báo `resolve.alias` cho `@` → `src`. Nếu thêm alias mới vào `tsconfig.json`, nhớ khai báo tương tự ở đây.
- **Dọn dẹp RTL**: dự án này không bật `globals: true` của Vitest (mỗi file test đều tự import `describe`/`it`/`expect`/`vi` từ `"vitest"`), nên `afterEach(cleanup)` tự động của React Testing Library sẽ không tự đăng ký. `src/tests/setup.ts` (khai trong `setupFiles` của project `component`) làm việc này thủ công, cùng với `vi.unstubAllGlobals()` để hủy các mock `mockFetchSequence` giữa các test. Nếu thấy lỗi "found multiple elements" trong nhiều test *cùng 1 file* dù từng test chạy riêng lẻ vẫn qua, gần như chắc chắn là do lỗi này — kiểm tra `setup.ts` còn được khai trong `vitest.config.mts` không.
- **`typecheck` cần chạy `next typegen` trước**: App Router của Next 16 tự sinh type `LayoutProps`/`PageProps` vào `.next/types/` lúc build/dev. Chạy thẳng `tsc --noEmit` trên 1 checkout mới (chưa có thư mục `.next/`) sẽ báo lỗi giả ở `layout.tsx`. Luôn dùng `npm run typecheck`, đừng gọi `tsc` trực tiếp.
- **`react-hooks/set-state-in-effect`**: cấu hình ESLint của dự án (dựa trên React Compiler) báo lỗi *bất kỳ* lệnh gọi `setState` nào có thể chạy tới từ bên trong `useEffect`, kể cả trong phần code chạy sau 1 `await` của hàm async — không chỉ trường hợp đồng bộ đơn giản. Lỗi này đã từng gặp thật 2 lần (cách fetch dữ liệu ban đầu của Vòng quay ở Milestone 2, effect đồng bộ localStorage ban đầu của hệ thống theme lúc chuẩn bị Milestone 4). Cả 2 lần đều sửa theo 1 trong 2 cách: (a) chuyển logic đồng bộ state sang 1 Server Component lấy dữ liệu rồi truyền qua props (cho dữ liệu cấp trang), hoặc (b) dùng **lazy initializer** của `useState` để đọc 1 lần API trình duyệt như `localStorage`, giữ cho `useEffect` (nếu có) chỉ thao tác DOM thuần túy (không gọi `setState` bên trong). Nếu ESLint báo lỗi này, đừng dùng comment eslint-disable để né — sửa lại theo 1 trong 2 cách trên; xem `src/components/theme/ThemeProvider.tsx` làm ví dụ mẫu.
- **Test e2e chạy trên *bản build production*, không phải `next dev`**: Next 16 không cho chạy instance `next dev` thứ 2 cho cùng 1 thư mục dự án dù dùng cổng khác, nên sẽ xung đột với dev server đang chạy thủ công trong lúc phát triển bình thường. Lệnh `webServer.command` của `playwright.config.ts` chạy `tsx src/tests/e2e/setupDb.ts && next build && next start` thay vì `next dev`. Điều này cũng có nghĩa: **bất kỳ trang Server Component nào đọc dữ liệu DB trực tiếp phải có `export const dynamic = "force-dynamic"`**, nếu không `next build` sẽ âm thầm dựng sẵn nó thành HTML tĩnh, đóng băng dữ liệu tại thời điểm build — đây là lỗi thật, chỉ phát hiện được khi e2e chạy build thật lần đầu (xem `PROJECT_CONTEXT.md` mục 3). Nếu thêm 1 trang mới có đọc DB, nhớ thêm dòng export này, rồi xác nhận lại bằng `npm run test:e2e` (không chỉ `npm run dev`, vì lệnh đó không bao giờ dựng sẵn tĩnh nên sẽ không lộ ra lỗi).
- **Cô lập DB cho e2e**: `src/tests/e2e/setupDb.ts` xóa/migrate/seed 1 file `./e2e-test.db` riêng (qua biến môi trường `DATABASE_PATH` mà `client.ts` đã hỗ trợ sẵn), nối bằng `&&` *trước* `next build`/`next start` trong cùng 1 lệnh shell — không dùng hook `globalSetup` của Playwright (đã thử cách này trước, nhưng thứ tự chạy so với lúc webServer khởi động không đảm bảo như tưởng). File `./dev.db` thật không bao giờ bị e2e đụng vào. Nếu e2e báo lỗi `SQLITE_ERROR: no such table`, kiểm tra `setupDb.ts` còn là lệnh *đầu tiên* trong `webServer.command` không, chứ không phải tách ra `globalSetup` riêng.

---

## 4. "Xong" nghĩa là gì với 1 test (theo Định nghĩa hoàn thành của `CLAUDE.md`)

- 1 hàm thuần túy mới/sửa phải có ít nhất 1 test cho trường hợp bình thường ngay khi viết xong, trước khi review.
- Với code liên quan tới engine, nên thêm cả các trường hợp biên mà công thức trong PROJECT_CONTEXT.md nêu rõ (ví dụ: ngưỡng `.25`/`.75` của `ieltsRound`, ranh giới 7 ngày của quy tắc bắt buộc hàng tuần, các pool có count bằng 0 hết) — không chỉ 1 trường hợp bình thường.
- 1 test component phải chứng minh đúng cái nó tuyên bố kiểm tra — nếu comment bỏ tính năng đang test mà test vẫn pass thì đó không phải test thật. Dự án này từng bắt được 2 lỗ hổng kiểu này bằng cách cố tình đưa lại lỗi vào code rồi xác nhận test có báo fail không (xem test thu hẹp pool ứng viên của Spinner, và lần sửa cách định vị bằng substring trong `journal.spec.ts` trong lịch sử git) — khi không chắc 1 test mới có ý nghĩa hay không, làm tương tự: cố tình phá tính năng, xác nhận test bắt được lỗi, rồi khôi phục lại.
- Giả lập `fetch`: dùng `mockFetchSequence()` trong `src/tests/component/mockFetch.ts` thay vì tự viết stub mới. Hàm này khớp theo *thứ tự* gọi, không theo URL — phải biết chính xác thứ tự các request mà component gọi trước khi viết response giả lập.
