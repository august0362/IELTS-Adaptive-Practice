# AI_CHATBOT_PLAN.md — Kế hoạch Chatbot AI (Milestone 6/7/8)

> **Trạng thái: MILESTONE 6 ĐÃ XONG (review chốt đã qua, xem `ai/AI_TASKS.md`). MILESTONE 7 — kế hoạch chi tiết ở mục 12 dưới đây, ĐÃ VIẾT XONG NHƯNG CHỜ USER DUYỆT ("check xong mới được thực thi") — CHƯA TẢI/CHẠY/TẠO FILE NÀO CHO MILESTONE 7.**
> File này là bản ghi đầy đủ để bất kỳ phiên làm việc nào (kể cả phiên mới hoàn toàn, không còn ngữ cảnh hội thoại cũ) đọc vào là tiếp tục được ngay, không cần hỏi lại user từ đầu.
>
> Mục 2–8 mô tả Milestone 6 (đã code xong, xem log đầy đủ ở `document.txt` cuối file — mục "[2026-09-19] Milestone 6..."). Mục 12 mô tả kế hoạch thực thi Milestone 7 — **đọc mục 12 trước khi động vào bất cứ file nào của Milestone 7**.

---

## 0. Việc kế tiếp thực tế (đọc trước tiên)

Hỏi user (nguyên văn ý): *"đồng ý với kế hoạch chưa, hay còn muốn sửa?"* — user trả lời **"báo cáo trước tôi xem đã"**, tức là muốn đọc kỹ bản báo cáo trước, **chưa phải là đồng ý cũng chưa phải là từ chối**. Phiên sau khi đọc file này việc đầu tiên là hỏi lại user đúng câu đó (đồng ý bắt đầu Milestone 6, hay còn muốn chỉnh gì) — **không tự ý bắt đầu dời file/tải model khi chưa có xác nhận rõ ràng.**

---

## 1. Ngữ cảnh xuất phát (nguyên văn yêu cầu của user)

> Milestone 6. Muốn có 1 chatbot trên web, tải model mã nguồn mở mới nhất, tách thư mục cho rõ ràng để module hóa toàn bộ dự án (module chatbot không ảnh hưởng module khác). Thêm 1 Agent AI nữa để pretrain/thao tác model chuyên nghiệp hơn. Chatbot chuyên về dự án — pretrain model sẵn có + train với data sẵn có. User chưa có nhiều kinh nghiệm LLM nên cần hỏi kỹ trước khi làm.

Sau đó qua nhiều vòng hỏi đáp, user bổ sung thêm: **muốn có model chấm Writing và Speaking theo đúng tiêu chí IELTS** (yêu cầu phát sinh giữa chừng, đã gộp vào kế hoạch thành Milestone 8 riêng).

---

## 2. Phạm vi chatbot (đã chốt)

Chatbot làm được:
- Hỏi đáp về chính app (vòng quay, công thức Band/EWMA, ý nghĩa từng trang) — nguồn: `PROJECT_CONTEXT.md`, `USER_GUIDE.md`.
- Gia sư IELTS ở mức kiến thức chung (**chưa có** tài liệu IELTS ngoài để nạp — user xác nhận chưa có file nào, dùng kiến thức chung của model).
- Tư vấn dựa trên dữ liệu cá nhân trong DB (nhật ký, lịch sử quay, điểm Cambridge) — kiểu "tuần này nên luyện gì".

Chatbot **không** làm (ngoài phạm vi lần này):
- Không điều khiển app qua chat (không tự ghi/sửa DB thay user).

---

## 3. Cấu trúc thư mục (đã chốt — thay đổi lớn nhất, làm trong Milestone 6)

Dời **toàn bộ app hiện tại** vào `web/` bằng `git mv` (giữ lịch sử git), tạo `ai/` ngang hàng:

```
EL/
├─ web/     ← app Next.js hiện tại: src/, drizzle/, dev.db, public/, tests, mọi config, 3 file .bat
├─ ai/      ← toàn bộ chatbot: models/ (gitignore), data/ (raw gitignore), training/, server/, AI_TASKS.md
```

Đã kiểm tra trước khi chốt phương án này:
- 149 file đang track trong git (root hiện tại).
- 147 chỗ tham chiếu đường dẫn kiểu `src/`, `drizzle/`, `dev.db`, tên các file `.md` trong các file `.md`/`.txt` của dự án (đếm bằng grep) — phải rà và sửa hết khi dời.
- Các file có đường dẫn cứng cần sửa khi dời: `drizzle.config.ts` (`./src/lib/db/schema.ts`, `./drizzle/migrations`, `./dev.db`), `playwright.config.ts` (import `./src/tests/e2e/testDbPath`, `testDir: ./src/tests/e2e`), `vitest.config.mts` (alias `@` → `./src`, include paths), `start-app.bat`/`push-to-github.bat`/`pull-from-github.bat` (dùng `cd /d "%~dp0"` nên phải đặt lại đúng script nằm trong `web/` hay chạy từ root — cần quyết lúc code), `.gitignore` (các rule `*.db`, `/node_modules`, `/.next/` vẫn đúng nhưng path gốc đổi), `src/lib/db/client.ts` dùng `process.env.DATABASE_PATH ?? "./dev.db"` (đường dẫn tương đối, phụ thuộc cwd lúc chạy — cần kiểm lại khi dời).
- `.claude/` hiện tại rỗng (không có `agents/` con) — tạo mới hoàn toàn `.claude/agents/ai-engineer.md`.
- Máy user: `node_modules` 590MB, `.next` 496MB — 2 thư mục này **không** track git (đã ignored), không cần lo khi `git mv`, chỉ cần build lại sau khi dời.

---

## 4. Vai trò mới (đã chốt)

- Thêm hàng **AI/ML** vào bảng vai trò trong `CLAUDE.md` (sở hữu `ai/**`, checklist riêng `ai/AI_TASKS.md`).
- Tạo `.claude/agents/ai-engineer.md` — Agent thật, gọi khi cần thao tác chuyên sâu: chuẩn bị dữ liệu, chạy train, đánh giá, nén model.
- Agent này vẫn tự-kiểm bằng `typecheck`/`lint`/`test` như mọi bước khác, và **chỉ tham gia đúng 1 lần review chốt/milestone** — không phải lớp review thứ hai (giống hệt cơ chế "Exception — Design/UI-UX agent" đã có sẵn trong `CLAUDE.md`).

---

## 5. Model đã chọn (đã chốt, có tra cứu thực tế trên Hugging Face lúc lập kế hoạch — 2026-09-19)

| Việc | Model | Vì sao |
|---|---|---|
| Chạy chatbot thật trên máy user | **Qwen3.5-4B-Instruct**, bản GGUF nén 4-bit (~2.7GB), chạy qua `llama.cpp`/`Ollama` | Apache 2.0, kiến trúc hybrid (Gated Delta Networks + sparse MoE), 262K context, đa ngôn ngữ (Qwen công bố 201 ngôn ngữ, không nêu rõ tiếng Việt — cần tự kiểm khi chạy thật). Có sẵn GGUF từ Unsloth/bartowski/lmstudio-community. |
| Sinh dữ liệu train (chỉ chạy trên Kaggle, không đóng gói vào app) | **Qwen3.5-9B-Instruct** | Model mở, không dùng Claude để tạo dữ liệu train (xem mục 6 — lý do pháp lý). |
| Chấm Speaking (Milestone 8) | **faster-whisper** (bản `small`/`medium`, chạy chủ yếu CPU) | Whisper `large-v3` cần ~10GB VRAM, không hợp máy user; bản nhỏ đủ cho bài nói ngắn, không cần realtime. |

**Máy user (đã đo lúc lập kế hoạch):** GPU RTX 3050 Laptop 4GB VRAM, RAM 15.7GB, CPU i5-12500H (12 core/16 thread), ổ C còn trống 143GB, Python 3.13.7, Node 24.19.0, chưa cài Ollama/Docker.

**Lưu ý kỹ thuật đã ghi nhận lúc research (chưa xác minh lại lúc code — phải recheck vì mốc thời gian model mở thay đổi nhanh):**
- Model mới nhất họ Qwen lúc lập kế hoạch là Qwen3.8 (8/2026) nhưng chỉ có bản ≥27B → quá nặng, không chọn.
- Qwen3.5 (2/2026) có đủ cỡ 0.8B/2B/4B/9B, mỗi cỡ có Base + Instruct — chọn 4B làm điểm cân bằng tốc độ/chất lượng theo yêu cầu user.
- Không nên QLoRA 4-bit trực tiếp trên Qwen3.5 theo khuyến cáo cộng đồng (chênh lệch lượng tử hoá cao hơn bình thường) — ưu tiên LoRA thường hoặc train ở 8-bit/16-bit trên Kaggle rồi mới nén GGUF 4-bit để chạy local.

---

## 6. Dữ liệu train chatbot — ĐÃ SỬA LẠI sau khi tra điều khoản Anthropic (quan trọng, đừng làm lại theo hướng cũ)

**Lý do:** tra trực tiếp `anthropic.com/legal/aup` lúc lập kế hoạch, nguyên văn: *"Utilization of inputs and outputs to train an AI model (e.g., "model scraping" or "model distillation") without prior authorization from Anthropic"* bị cấm trong mục "Không được lạm dụng nền tảng" — **cấm dùng input/output của Claude để train BẤT KỲ AI model nào**, không giới hạn ở "model cạnh tranh", không có ngoại lệ cho cá nhân/phi thương mại được nêu rõ. Vì vậy phương án "Claude tự viết dữ liệu train" đã bị loại — **không dùng Claude sinh dữ liệu train dưới bất kỳ hình thức nào**, kể cả khi user đã từng chọn phương án đó trước khi biết điều khoản này.

**Cách làm đã chốt:**
1. Soạn **template câu hỏi**, tự động điền số liệu/công thức thật lấy từ `PROJECT_CONTEXT.md`/`USER_GUIDE.md` (ghép chuỗi máy móc, không phải nội dung "sáng tác" bởi Claude).
2. Phần đa dạng hơn (diễn giải, gia sư IELTS): chạy **Qwen3.5-9B trên Kaggle** (không phải Claude) đọc tài liệu, tự đặt câu hỏi và viết đáp án.
3. Lọc trùng lặp, sai, quá ngắn/dài.
4. **User duyệt khoảng 30 mẫu ngẫu nhiên** trước khi đưa vào train — nếu chất lượng không đạt, chỉ dùng riêng phương án template.

---

## 7. Giao diện & ngôn ngữ (đã chốt)

- Trang `/chat` riêng làm trước (thêm mục vào menu điều hướng hiện có của `web/src/app/layout.tsx`).
- Nút chat nổi trên mọi trang làm **sau**, sau khi `/chat` ổn định — tránh đụng layout chung ngay từ đầu.
- Ngôn ngữ trả lời: **theo ngôn ngữ người hỏi** (hỏi tiếng Việt → đáp tiếng Việt, thuật ngữ/ví dụ IELTS giữ tiếng Anh khi cần).

---

## 8. Tính năng mới — chấm Writing & Speaking theo tiêu chí IELTS (Milestone 8, tách riêng)

- **Writing**: user dán bài luận → model chấm theo 4 tiêu chí công khai IELTS (Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy) — tiêu chí công bố công khai bởi British Council/IDP, dùng làm rubric prompt được, không phải nội dung độc quyền.
- **Speaking**: user **thu âm thật** → faster-whisper chuyển thành chữ → model chấm 4 tiêu chí (Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation). Pronunciation chỉ chấm tương đối (suy luận qua transcript + đặc điểm âm cơ bản, không phân tích ngữ âm chuyên sâu).
- **Không** ghi kết quả vào DB, **không** ảnh hưởng công thức Band ở `PROJECT_CONTEXT.md` §5 — chỉ hiển thị điểm/nhận xét tại chỗ. Lý do user đưa ra: *"chưa vì chắc gì model đã chấm đúng"* — để sau khi có cách kiểm chứng độ chính xác.
- Tách hẳn Milestone 8 (không gộp vào 6/7) vì là bài toán khác bản chất (đầu vào audio, rubric riêng, có thể cần fine-tune riêng).

---

## 9. Chia mốc (số thứ tự đã đổi lại cho khớp — Milestone 6 hiện có trong `PROGRESS.md` chỉ là placeholder tên gọi ban đầu của user, thực tế chia thành 3 mốc)

| Milestone | Nội dung | Kết quả đạt được | Task list |
|---|---|---|---|
| **6** | Dời `web/` + tạo `ai/`, sửa mọi path/config/script/.bat/tài liệu, tải Qwen3.5-4B-GGUF, dựng RAG đọc tài liệu + DB, route API + trang `/chat` | Chatbot dùng được ngay, trả lời dựa trên model gốc + RAG (chưa fine-tune) | `ai/AI_TASKS.md` (tạo lúc bắt đầu code) |
| **7** | Sinh dữ liệu train (mục 6), user duyệt mẫu, fine-tune QLoRA/LoRA trên Kaggle, tải adapter về, tích hợp vào `ai/server/` | Chatbot bám sát giọng văn/dữ liệu dự án hơn | `ai/AI_TASKS.md` (tiếp) |
| **8** | faster-whisper (STT) + khung chấm Writing/Speaking theo tiêu chí IELTS, trang chấm riêng | Tính năng chấm điểm độc lập, không đụng DB/công thức Band | `ai/AI_TASKS.md` (tiếp) |

Mỗi milestone: tự-kiểm từng bước bằng `typecheck`/`lint`/`test`, đúng 1 lần review chốt (Agent Supervisor) khi cả milestone xong — theo quy trình `CLAUDE.md` hiện có, không đổi gì về quy trình review.

---

## 10. Rủi ro/lưu ý còn mở (xử lý lúc code, không cần hỏi lại user)

- `ai/models/` và `ai/data/raw/` phải vào `.gitignore` ngay từ đầu Milestone 6 — không đẩy model/dữ liệu nặng lên GitHub (repo đã có remote `origin` đang push thật).
- Qwen3.5 không nêu rõ hỗ trợ tiếng Việt trong tài liệu chính thức (chỉ ghi chung "201 ngôn ngữ") — thử vài câu hỏi tiếng Việt ngay sau khi tải xong, báo lại user nếu chất lượng kém, cân nhắc phương án khác (vd Gemma 4 hoặc SeaLLM) nếu quá tệ.
- Whisper + Qwen4B chạy cùng lúc có thể chật VRAM 4GB → mặc định STT chạy CPU, chỉ Qwen4B dùng GPU.
- Cần recheck lại phiên bản model mới nhất lúc thực sự bắt đầu code (thị trường model mở đổi rất nhanh — thông tin ở mục 5 là chốt tại thời điểm lập kế hoạch 2026-09-19, không phải chân lý vĩnh viễn).

---

## 11. Milestone 6 — kết quả thật (đã xong, review chốt đã qua)

Tóm tắt — chi tiết đầy đủ ở `document.txt` (mục "[2026-09-19] Milestone 6...", cuối file) và `ai/AI_TASKS.md`:

- Qwen3.5 tiếng Việt **tốt**, không cần đổi model.
- Ollama cài qua winget, `qwen3.5:4b` (3.4GB) + `nomic-embed-text` (274MB) đã pull, đã thử thật với câu hỏi tiếng Việt — trả lời đúng, có trích đúng nội dung tài liệu.
- **3 phát hiện quan trọng, ảnh hưởng trực tiếp tới cách làm Milestone 7 (đọc kỹ trước khi qua mục 12):**
  1. Qwen3.5 bật "thinking mode" mặc định, làm chậm ~65 lần (73.7s → 1.1s khi tắt qua `think: false`). **Dữ liệu train Milestone 7 phải sinh ra với thinking tắt** (nếu dùng Qwen3.5-9B sinh dữ liệu mà bật thinking, vừa chậm vừa tốn quota GPU Kaggle vô ích, vì phần "suy nghĩ" không phải là câu trả lời cần học).
  2. Ngay cả tắt thinking, câu hỏi thật có RAG mất ~46 giây trên máy user (RTX 3050 4GB). Đây là giới hạn phần cứng — fine-tune (Milestone 7) **không** giúp nhanh hơn (cùng cỡ model, cùng máy), chỉ giúp trả lời đúng giọng văn/nội dung hơn. Đừng hứa hẹn tốc độ với user ở Milestone 7.
  3. `nomic-embed-text` có giới hạn độ dài input cứng — bất kỳ script nào tái sử dụng logic chunk (`ai/server/chunking.py`) để chuẩn bị dữ liệu train cũng thừa hưởng đúng cách xử lý đoạn văn quá dài đã sửa, không cần sửa lại.
- Whisper (Milestone 8) chưa đụng tới — không liên quan Milestone 7.

---

## 12. Milestone 7 — Fine-tune: KẾ HOẠCH THỰC THI CHI TIẾT (chờ user duyệt, chưa làm gì)

> Mục này trả lời "làm thế nào, bằng gì, tốn bao lâu" — cụ thể hơn nhiều so với mục 6/9 (chỉ nêu hướng chung lúc lập kế hoạch Milestone 6). Đã tra cứu lại thực tế trước khi viết mục này (2026-09-19): hạn mức GPU Kaggle miễn phí, cách gắn LoRA vào Ollama.

### 12.1 Mục tiêu

Chatbot (Qwen3.5-4B, đã chạy ở Milestone 6 qua RAG) trả lời **đúng giọng văn của dự án hơn** — ngắn gọn, đúng cấu trúc, ít lan man — bằng cách học thêm từ vài trăm cặp hỏi–đáp mẫu, **không phải để nhồi thêm kiến thức mới** (kiến thức đã có qua RAG rồi). Nếu sau khi train mà không thấy khác biệt rõ so với bản RAG-only, **được phép dừng lại, giữ bản Milestone 6** — Milestone 7 không bắt buộc phải "thành công" mới coi là xong.

### 12.2 Dữ liệu train — quy trình cụ thể

**Ranh giới bắt buộc (nhắc lại từ mục 6, quan trọng nên nhắc lại ở đây):** dữ liệu train **chỉ** lấy từ nội dung công khai của dự án (`PROJECT_CONTEXT.md`, `USER_GUIDE.md`) + kiến thức IELTS chung. **Không bao giờ** đưa dữ liệu cá nhân của user (nhật ký, lịch sử luyện tập, điểm Cambridge thật) vào tập train hay upload lên Kaggle — khác với RAG (mục 11.4 `PROJECT_CONTEXT.md`), nơi dữ liệu cá nhân chỉ được đọc **lúc trả lời trực tiếp**, không bao giờ "nướng" (bake) vào trọng số model.

1. **Phần template (làm trên máy, không cần Kaggle):** viết script Python trong `ai/training/`, quét trực tiếp `PROJECT_CONTEXT.md`/`USER_GUIDE.md` theo mục (`##`/`###`), với ~10–15 mẫu câu hỏi cố định (vd *"{Mục} nói gì về {chủ đề}?"*, *"Công thức tính {X} là gì?"*) ghép với nội dung mục tương ứng làm câu trả lời mẫu (rút gọn, đúng giọng văn ngắn gọn). Ước lượng: **~40–60 cặp**.
2. **Phần model-generated (chạy trên Kaggle, dùng Qwen3.5-9B, `think: false`):** tái sử dụng đúng 139 đoạn đã chunk sẵn ở `ai/data/processed/doc_index.json` (Milestone 6) — với mỗi đoạn, prompt Qwen3.5-9B: *"Đọc đoạn sau, đặt 1–2 câu hỏi tự nhiên mà đoạn này trả lời được, kèm đáp án ngắn gọn dựa đúng nội dung đoạn."* Ước lượng: **~150–250 cặp** (139 đoạn × 1–2 câu hỏi).
3. **Lọc (làm trên máy sau khi tải kết quả về):** bỏ cặp trùng lặp gần giống nhau (cosine similarity câu hỏi > 0.9, dùng lại `ai/server/retrieval.py`), bỏ đáp án quá ngắn (<15 từ) hoặc có dấu hiệu model "bịa" (đáp án không chứa từ khóa nào trùng với đoạn nguồn — kiểm tra thô bằng overlap từ).
4. **Định dạng lưu:** JSONL, mỗi dòng `{"messages": [{"role": "system", "content": ...}, {"role": "user", "content": "<câu hỏi>"}, {"role": "assistant", "content": "<đáp án>"}]}` — đúng chuẩn instruction-tuning, khớp chat template Qwen.
5. **Cổng duyệt (bắt buộc, đúng như đã chốt ở mục 6):** sau khi lọc xong, hiện **30 mẫu ngẫu nhiên trực tiếp trong chat** (mặc định — nếu bạn thích đọc file hơn, nói tôi ghi ra `ai/data/processed/review_sample.jsonl` thay vào đó) để bạn duyệt. Nếu tỷ lệ lỗi/dở ở nhóm nào cao, bỏ hẳn nhóm đó (vd chỉ giữ template, bỏ model-generated) — **train chỉ bắt đầu sau khi bạn đồng ý rõ ràng với mẫu đã xem**.

### 12.3 Huấn luyện trên Kaggle — cụ thể

- **Notebook**: tôi viết sẵn 1 file `.ipynb` trong `ai/training/`, bạn chỉ cần: đăng nhập Kaggle (cần tài khoản — xem câu hỏi bên dưới), tạo notebook mới, dán/tải file này lên, bật **GPU T4** (Settings → Accelerator), bấm **Run All**. Notebook tự cài Unsloth + PEFT, tải Qwen3.5-4B-Instruct (bản gốc HuggingFace, không phải bản GGUF) + dataset đã duyệt, train LoRA, xuất adapter.
- **Phương pháp**: LoRA thường (**không QLoRA 4-bit**) — cộng đồng khuyến cáo không QLoRA cho Qwen3.5 vì lệch lượng tử hoá cao hơn bình thường (đã ghi ở mục 5). Rank LoRA thấp (r=16–32), 2–3 epoch, batch nhỏ — đủ cho vài trăm mẫu, không cần nhiều.
- **Thời lượng ước tính**: sinh dữ liệu model-generated (bước 12.2.2) ~20–40 phút GPU; train LoRA ~30–90 phút tùy số mẫu cuối cùng. Tổng nằm gọn trong 1 phiên Kaggle (giới hạn 12 giờ/phiên) và trong hạn mức 30 giờ GPU/tuần miễn phí — dư dả, không cần lo hết quota (đã tra cứu lại, xem nguồn cuối file).
- **Kết quả tải về**: file adapter (`adapter_model.safetensors` + `adapter_config.json`, vài chục MB — nhẹ hơn nhiều so với cả model) → đặt vào `ai/training/output/` (gitignore, không đẩy GitHub).

### 12.4 Gắn adapter vào Ollama — cụ thể

Không cần merge lại toàn bộ model (nặng, mất thời gian requantize). Ollama hỗ trợ trực tiếp qua `Modelfile`:

1. Convert adapter sang GGUF bằng script `convert_lora_to_gguf.py` của llama.cpp (chạy 1 lần trên máy, không cần GPU).
2. Tạo `ai/training/Modelfile`:
   ```
   FROM qwen3.5:4b
   ADAPTER ./qwen3.5-4b-project-lora.gguf
   ```
3. `ollama create qwen3.5-4b-project -f Modelfile` → có model mới `qwen3.5-4b-project` cạnh `qwen3.5:4b` gốc (không ghi đè, **rollback dễ dàng** — chỉ cần đổi biến môi trường `CHAT_MODEL` trong `ai/server/ollama_client.py` quay lại `qwen3.5:4b` nếu muốn bỏ fine-tune).

### 12.5 Đánh giá trước khi "chốt" dùng bản fine-tune

Giữ lại ~10 câu hỏi **không** đưa vào tập train (held-out) — tôi hỏi cả bản gốc (`qwen3.5:4b`) và bản fine-tune (`qwen3.5-4b-project`), hiện 2 câu trả lời song song cho bạn tự so sánh, bạn quyết định có đổi `CHAT_MODEL` sang bản mới hay giữ bản gốc.

### 12.6 Câu hỏi cần bạn xác nhận trước khi tôi thực thi

1. **Bạn đã có tài khoản Kaggle chưa?** Nếu chưa, cần tạo trước (miễn phí, bằng Google/email) — tôi không thể tạo hộ.
2. **Xác nhận lại ranh giới ở mục 12.2**: đồng ý dữ liệu train chỉ lấy từ tài liệu dự án + kiến thức IELTS chung, **không** đưa nhật ký/lịch sử luyện tập/điểm thi thật của bạn lên Kaggle, đúng không?
3. **Cách xem 30 mẫu duyệt**: hiện trong chat (mặc định) hay ghi ra file để bạn tự mở?
4. **Số lượng mẫu mục tiêu** (~200–300 cặp tổng cộng theo ước lượng ở 12.2) có ổn không, hay bạn muốn nhiều/ít hơn?

Nguồn tra cứu lúc viết mục này (2026-09-19): hạn mức GPU Kaggle — [Kaggle Docs: Efficient GPU Usage](https://www.kaggle.com/docs/efficient-gpu-usage); gắn LoRA vào Ollama qua `Modelfile` `ADAPTER` + `convert_lora_to_gguf.py` — [ví dụ chuyển đổi LoRA sang GGUF cho Ollama](https://github.com/hrishi-008/LoRA-adapter-to-GGUF-for-Ollama-with-code).
