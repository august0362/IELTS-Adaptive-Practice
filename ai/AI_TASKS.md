# Chatbot AI — Danh sách việc

> Phạm vi: `ai/**` (model, RAG, training, server suy luận) + phần nối mỏng phía `web/` (`web/src/app/chat/`, `web/src/app/api/chat/`). Chi tiết đầy đủ (model chọn, lý do, cách sinh dữ liệu train, chia mốc) nằm ở [`AI_CHATBOT_PLAN.md`](../AI_CHATBOT_PLAN.md) và `PROJECT_CONTEXT.md` mục 11 — file này chỉ theo dõi *việc nào xong, việc nào chưa*. Đọc `PROGRESS.md` ở gốc dự án trước để biết trạng thái tổng quan.

## Milestone 6 — Hạ tầng + RAG (đang làm)

- [x] Dời app Next.js vào `web/`, tạo bộ khung `ai/`, sửa mọi path/config/script/tài liệu liên quan
- [x] Tự kiểm sau khi dời: `npm install` + `typecheck` + `lint` + `test` (148/148) + `test:e2e` (8/8) — tất cả xanh trong `web/`, việc dời không làm hỏng gì. Cài thêm Visual Studio Build Tools (workload C++) trên máy dev vì `better-sqlite3` cần biên dịch native và máy chưa có sẵn.
- [x] Cài Ollama (chạy model local qua HTTP API riêng, port 11434 mặc định) — dùng thay vì tự dựng llama.cpp thủ công, đơn giản hơn cho user chưa quen LLM
- [x] `ollama pull qwen3.5:4b` (3.4GB) + `ollama pull nomic-embed-text` (274MB) — cả 2 xác nhận có sẵn trên thư viện Ollama chính thức, tải xong thật trên máy user
- [x] Thử câu hỏi tiếng Việt qua `/chat` thật — chất lượng tốt, trả lời đúng và mạch lạc (xem ví dụ ở mục 11.4)
- [x] Route `POST web/src/app/api/chat/route.ts` — validate input, đọc `getChatContextSummary()` (DB của `web/`), gọi sang `ai/server/`, map lỗi 503/502 rõ ràng, timeout 120s (xem phát hiện độ trễ bên dưới). Tự kiểm: `typecheck`/`lint` xanh.
- [x] Trang `web/src/app/chat/page.tsx` + `ChatWindow.tsx` (có ghi chú "có thể mất khoảng 1 phút" khi đang chờ), thêm "Chatbot" vào Nav. Component test `ChatWindow.test.tsx` (5 case) — 153/153 test xanh.
- [x] `ai/server/` (Python/FastAPI): `main.py` (route `/chat` + `/health`), `ollama_client.py` (gọi Ollama `/api/chat` + `/api/embeddings`, `think: false` — xem phát hiện bên dưới), `chunking.py` + `retrieval.py` + `prompt.py` (RAG thuần, có test pytest không cần model thật — 19 test, xanh), `build_index.py` (chunk+embed `PROJECT_CONTEXT.md`/`USER_GUIDE.md`/`document.txt` → `ai/data/processed/doc_index.json`, 139 đoạn)
- [x] `ai/requirements.txt` + `ai/README.md` (hướng dẫn chạy) + `ai/start-server.bat` (script 1 chạm, theo đúng kiểu `start-app.bat` đã có)
- [x] Nối thật: chạy `ai/server/` + Ollama, thử `/chat` từ server thật (không phải mock) với câu hỏi về công thức Band — trả lời đúng, có trích dẫn đúng nội dung `PROJECT_CONTEXT.md`
- [x] Thêm e2e case cho luồng chat (`chat.spec.ts`) — dùng **AI server giả lập** (`mockAiServer.ts`, `playwright.config.ts` giờ chạy 2 `webServer` song song) thay vì Ollama thật, để bộ e2e không phụ thuộc máy khác có cài Ollama hay không và không bị chậm/không ổn định — xem "Phát hiện quan trọng" bên dưới về lý do
- [x] Tự kiểm cuối: `typecheck`/`lint` sạch, `test` 153/153, `test:e2e` 9/9 (thêm `chat.spec.ts`) xanh trong `web/`; `pytest` 19/19 xanh trong `ai/`
- [x] Review chốt Milestone 6 (Supervisor, theo `CLAUDE.md`) — 1 finding nhỏ (doc lỗi thời: `PROJECT_CONTEXT.md` mục 11.4 còn ghi "60s" thay vì "120s"), đã sửa, không cần vòng review thứ 2. **MILESTONE 6 XONG.**

### Phát hiện quan trọng khi nối thật (đọc trước khi đụng vào `ai/server/ollama_client.py`)

1. **Qwen3.5 bật "thinking mode" mặc định** — model tự sinh cả đoạn suy luận dài trước khi trả lời, kể cả câu hỏi cực đơn giản. Đo trực tiếp trên máy user (RTX 3050 4GB): cùng 1 câu hỏi ngắn mất **73.7 giây** (thinking bật) so với **1.1 giây** (thinking tắt qua tham số `"think": false` trong request `/api/chat` của Ollama) — nhanh hơn ~65 lần. `ollama_client.py` đã set `think: false` cứng — **đừng bỏ dòng này** nếu sau này sửa file đó.
2. **Độ trễ thật với RAG:** 1 câu hỏi thật về công thức Band (có kèm 4 đoạn tài liệu RAG trong prompt) mất **~46 giây** kể cả khi đã tắt thinking — do model 4B chạy trên GPU 4GB + phải xử lý prompt dài hơn. Timeout đã đặt 120s ở cả `web/`'s route và `ai/server/ollama_client.py` để có biên an toàn. Đây là đặc điểm thật của phần cứng, không phải lỗi — đã ghi UI (mục "đang trả lời...") để user không tưởng bị treo.
3. **`chunk_markdown` có 1 lỗi thật đã sửa:** đoạn văn đơn lẻ dài hơn `max_chars` (không có dòng trống bên trong) từng bị bỏ qua không tách nhỏ, khiến `nomic-embed-text` từ chối với lỗi "input length exceeds the context length" khi build index thật (gặp ở 1 đoạn trong mục 9 `PROJECT_CONTEXT.md`). Đã sửa + thêm test (`test_splits_a_single_oversized_paragraph_on_sentence_boundaries` và 2 test liên quan).

## Milestone 6 mở rộng — Đổi tên "Navita" + bình chat nổi + 3 chế độ + lịch sử nhiều cuộc hội thoại (đang làm)

> User quay lại sau khi Milestone 6 đã review chốt, yêu cầu thêm 4 việc. Tính là phần mở rộng của Milestone 6 (không phải milestone số riêng) vì cùng phạm vi `ai/server/` + `web/`'s chat route/UI.

- [x] Đổi tên chatbot thành **Navita** — hệ dẫn (`ai/server/prompt.py`), welcome message, tiêu đề trang, Nav, `USER_GUIDE.md`
- [x] Schema DB mới: `chatConversations` (title tự đặt, mode lưu riêng từng cuộc) + `chatMessages` — migration `0003_rich_night_thrasher.sql`. Cập nhật `PROJECT_CONTEXT.md` mục 4.
- [x] API mới: `GET/POST /api/chat/conversations`, `GET/PATCH/DELETE /api/chat/conversations/:id`. Viết lại `POST /api/chat` để lấy lịch sử từ DB (không nhận `history` từ client nữa — tránh lệch dữ liệu giữa bình nổi/trang /chat/tải lại trang). Cập nhật `PROJECT_CONTEXT.md` mục 6 + 11.4.
- [x] 3 chế độ **Flash/Thinking/Pro** — vẫn 1 model Qwen3.5-4B, khác `think`/`top_k`/hệ dẫn (`ai/server/main.py`'s `MODE_SETTINGS`, `ai/server/prompt.py`'s `PRO_INSTRUCTION_SUFFIX`). Lưu theo từng cuộc hội thoại.
- [x] `ChatWindow.tsx` viết lại: chọn/tạo/xóa cuộc hội thoại (dropdown + nút), nút chọn chế độ, dùng chung được cho cả trang đầy đủ và bình nổi (`compact` prop)
- [x] `ChatBubble.tsx` mới — bình 💬 nổi góc màn hình, gắn vào `layout.tsx` nên hiện mọi trang trừ `/chat` (tránh trùng lặp); dùng chung `ChatWindow`/API nên đồng bộ với trang đầy đủ
- [x] Sửa 2 lỗi thật phát hiện khi làm/test kỹ:
  1. **Race condition**: tạo cuộc hội thoại mới rồi gửi tin ngay → set `activeId` kích hoạt effect tải tin nhắn (rỗng, vì cuộc mới) → ghi đè mất tin nhắn vừa gửi lạc quan trên UI. Sửa bằng `skipNextMessageFetchForIdRef` — bỏ qua đúng 1 lần fetch cho cuộc vừa tự tạo cục bộ.
  2. **Timeout quá ngắn cho Thinking/Pro**: test thật chế độ Pro (think bật + top_k=6, tổ hợp chậm nhất) gặp `httpx.ReadTimeout` ở ~122s vì `ollama_client.py` đặt timeout 120s chung cho cả chat lẫn embed. Tách riêng `EMBED_TIMEOUT=30s` (embedding luôn nhanh) và `CHAT_TIMEOUT=300s`; nâng `AI_SERVER_TIMEOUT_MS` phía `web/` lên 300s cho khớp.
- [x] Sửa lint `react-hooks/set-state-in-effect` (React Compiler) — hiệu ứng tải danh sách/tin nhắn ban đầu phải tự chứa logic `setState` trong `.then()` ngay trong thân effect, không được gọi ra 1 hàm `useCallback` riêng rồi hàm đó mới `setState` (dù hàm đó là async) — linter coi đó là "effect gián tiếp gây setState đồng bộ".
- [x] Xác nhận Flash (30.5s) + Pro (244s, có bật thinking + top_k=6) chạy được thật với model thật (không phải mock), cả 2 đều tự giới thiệu đúng là "Navita", Pro đúng phong cách trang trọng/có cấu trúc như thiết kế
- [x] Tự kiểm cuối: `typecheck`/`lint` sạch, `test` 156/156, `test:e2e` 9/9 xanh trong `web/`; `pytest` 22/22 xanh trong `ai/`
- [x] Xem lại giao diện thật bằng Playwright (script tạm, đã xóa sau khi dùng) — chụp màn hình trang chủ (bình nổi đúng vị trí), bình nổi mở ra (welcome message + 3 nút chế độ + dropdown hội thoại), trang `/chat` đầy đủ (không hiện bình nổi trùng lặp, đúng như thiết kế mục 11.1.1) — không có lỗi console
- [x] Review chốt (Supervisor) phần mở rộng này — **5 finding thật, đã sửa hết, không phải chỉ ghi chú:**
  1. **[Nghiêm trọng]** Xóa cuộc hội thoại đang chờ trả lời → `addChatMessage` (assistant) insert vào cuộc đã xóa → SQLite chặn bằng FK constraint (`foreign_keys = ON`) → request crash 500, mất câu trả lời AI dù đã tốn GPU. Sửa: bọc try/catch ở `route.ts`, vẫn trả `reply` cho client dù lưu DB thất bại.
  2. **[Nghiêm trọng]** Chuyển sang xem cuộc hội thoại khác trong lúc đang chờ trả lời (Thinking/Pro tới ~4 phút, đủ thời gian thao tác) → câu trả lời "rò" vào cuộc đang xem + tự động kéo user quay lại cuộc cũ không báo trước. Sửa: khóa dropdown/nút "+"/nút xóa khi `isSending` (chặn từ UI) + `activeIdRef`/`setActiveIdAndRef` kiểm tra đúng cuộc trước khi cập nhật `messages`/lỗi (chặn ở tầng logic) + `refreshConversations()` không còn ép đổi `activeId`.
  3. **[Trung bình]** Bấm Gửi/Enter rất nhanh 2 lần trước khi `isSending` (state) kịp render → tạo trùng 2 cuộc hội thoại + gửi trùng. Sửa: `isSendingRef` (ref đồng bộ, không phụ thuộc chu kỳ render) kiểm tra ngay đầu `handleSend`.
  4. **[Nhỏ]** `PROJECT_CONTEXT.md` mục 11.4 còn ghi "timeout 120s" dù code đã tăng lên 300s — đã sửa.
  5. **[Nhỏ]** Test mới chưa phủ 3 race condition trên — đã thêm 2 test (`ChatWindow.test.tsx`): khóa nút khi đang chờ, không gửi trùng khi bấm 2 lần liên tiếp (dùng `fireEvent.click` bắn 2 lần không chờ giữa chừng để mô phỏng đúng race thật, không dùng `userEvent` vì nó tự chờ React render giữa các thao tác nên không tái hiện được race).
  
  **Tự sửa 1 lỗi phát sinh khi vá Finding 2**: lần sửa đầu dùng `useEffect` để đồng bộ `activeIdRef` theo `activeId`, nhưng `handleSend` vừa tạo cuộc hội thoại (set `activeId`) vừa cần đọc `activeIdRef` đã cập nhật ngay sau đó trong cùng 1 lần gọi — không có gì đảm bảo effect đã chạy kịp. Phát hiện qua 3 test tự dưng đỏ, sửa bằng cách gán `activeIdRef.current` trực tiếp, đồng thời với mọi lần gọi `setActiveId` (qua hàm `setActiveIdAndRef`), không qua effect nữa.
  
  Tự kiểm lại sau khi sửa: `typecheck`/`lint` sạch, `test` 158/158, `test:e2e` 9/9 (web/), `pytest` 22/22 (ai/) — tất cả xanh. **MILESTONE 6 MỞ RỘNG XONG.**

## Milestone 7 — Fine-tune (đang làm)

> User xác nhận (2026-09-19): đã có tài khoản Kaggle; đồng ý ranh giới không đưa dữ liệu cá nhân lên Kaggle; số lượng mẫu mục tiêu ~200–300 cặp giữ nguyên như kế hoạch. Cách xem mẫu duyệt trả lời ngắn gọn ("Thôi") — hiểu là dùng mặc định (hiện trong chat), đã nói rõ lại với user trước khi làm.

- [x] Soạn template câu hỏi tự động điền số liệu từ tài liệu dự án — `ai/training/generate_template_data.py` (+ `markdown_sections.py` thuần, 6 test), quét `PROJECT_CONTEXT.md`/`USER_GUIDE.md` theo mục đã chọn lọc (chỉ mục user-facing, bỏ mục dev-facing như schema/API/test strategy), cộng parse trực tiếp mục "Câu hỏi thường gặp" (đã sẵn dạng Q&A). Ra **26 cặp** (ít hơn ước tính 40–60, chấp nhận được — chất lượng hơn số lượng). `clean_answer()` **chỉ làm sạch cú pháp** (link markdown, dấu `---` thừa) — cố tình **không** rút gọn/viết lại nội dung, vì làm vậy tức là Claude "sáng tác" nội dung train, đúng điều bị cấm ở mục 6. Kết quả: một số câu trả lời dài/kỹ thuật (lẫn code, ghi chú dev) vì trích nguyên văn tài liệu — sẽ để user tự đánh giá ở cổng duyệt, không tự ý "sửa cho hay".
- [x] Viết notebook Kaggle sinh dữ liệu bằng Qwen3.5-9B (KHÔNG dùng Claude) — `ai/training/build_kaggle_notebook.py` sinh ra `generate_dataset_kaggle.ipynb` (gitignore, tái tạo bằng script), nhúng sẵn 139 đoạn tài liệu (đã strip embedding, chỉ giữ text — `doc_chunks_for_kaggle.json`) nên user chỉ cần tải notebook lên Kaggle chạy, không cần upload gì thêm. Có cell "smoke test" 2 đoạn trước khi chạy hết 139 đoạn (đỡ tốn GPU nếu có lỗi). Đã tự kiểm: notebook là JSON hợp lệ, dữ liệu nhúng parse đúng 139/139 đoạn, mọi cell code (trừ `!pip install` — cú pháp riêng Jupyter) biên dịch Python sạch. **CHƯA chạy thử thật trên Kaggle** (không có GPU 9B để tự kiểm) — khác với mọi phần code khác của dự án đến giờ, đã ghi rõ trong chính notebook.
- [ ] User chạy notebook trên Kaggle, tải kết quả về đưa lại cho tôi
- [ ] Lọc dữ liệu (trùng lặp, sai, quá ngắn/dài)
- [ ] User duyệt ~30 mẫu ngẫu nhiên trước khi train (hiện trong chat)
- [ ] Viết notebook Kaggle fine-tune LoRA, user chạy, tải adapter về
- [ ] Convert adapter sang GGUF, gắn vào Ollama qua Modelfile, tích hợp vào `ai/server/`
- [ ] So sánh chất lượng trước/sau bằng 10 câu hỏi held-out, user quyết định có dùng bản mới không
- [ ] Review chốt Milestone 7

## Milestone 8 — Chấm Writing/Speaking theo IELTS (chưa bắt đầu)

- [ ] Tải faster-whisper (small/medium) vào `ai/models/`
- [ ] Khung chấm Writing: rubric 4 tiêu chí (Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy)
- [ ] Khung chấm Speaking: thu âm → faster-whisper (STT) → chấm 4 tiêu chí (Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation ở mức tương đối)
- [ ] Trang chấm riêng (không ghi DB, không đụng công thức Band — hiển thị tại chỗ)
- [ ] Review chốt Milestone 8
