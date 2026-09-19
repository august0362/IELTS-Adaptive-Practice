# ai/ — Chatbot AI

Module độc lập, không import gì từ `web/src/` và ngược lại — chỉ nói chuyện qua HTTP. Xem [`../AI_CHATBOT_PLAN.md`](../AI_CHATBOT_PLAN.md) cho toàn bộ phạm vi/quyết định, [`../PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md) mục 11 cho kiến trúc, [`AI_TASKS.md`](./AI_TASKS.md) cho checklist.

```
models/       # file model đã tải (.gguf...) — gitignore, không track
data/
  raw/        # tài liệu nguồn cho RAG/train — gitignore
  processed/  # dữ liệu đã xử lý — gitignore
training/     # script/notebook fine-tune (chạy trên Kaggle)
server/       # server suy luận nội bộ, web/ gọi vào đây qua HTTP
```

**Trạng thái:** Milestone 6 đang dựng hạ tầng (tải model, RAG, route/trang `/chat`) — xem `AI_TASKS.md`.
