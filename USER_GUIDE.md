# Hướng dẫn sử dụng — IELTS Adaptive Practice

Ứng dụng luyện thi IELTS cá nhân, chạy hoàn toàn trên máy của bạn (không cần đăng nhập, không cần internet sau khi đã cài đặt). Có 4 trang chính: **Vòng quay**, **Nhật ký**, **Dự đoán**, **Cài đặt**.

---

## Khởi động ứng dụng

**Cách nhanh nhất**: bấm đúp vào file **`start-app.bat`** ở thư mục gốc dự án. Script sẽ tự kiểm tra và cài dependencies nếu thiếu, tự tạo database nếu chưa có, khởi động server, và tự mở trình duyệt vào `http://localhost:3000` sau vài giây. Đóng cửa sổ đen (hoặc bấm Ctrl+C) để tắt ứng dụng.

**Cách thủ công**: trong thư mục dự án, chạy:

```bash
npm run dev
```

Rồi mở trình duyệt vào `http://localhost:3000`.

Toàn bộ dữ liệu (lịch sử quay, ghi chú, điểm thi thử) được lưu trong 1 file duy nhất: `dev.db` ở thư mục gốc dự án. Muốn sao lưu dữ liệu, chỉ cần copy file này ra chỗ khác. Muốn làm lại từ đầu (xóa sạch dữ liệu), xóa file `dev.db` rồi chạy `npm run db:migrate && npm run db:seed`.

---

## 1. Vòng quay (trang chủ `/`)

Đây là nơi bạn quay ngẫu nhiên để biết hôm nay nên luyện kỹ năng nào.

1. Bấm nút **"Quay"**.
2. App sẽ tự động chọn ngẫu nhiên **2 trong 4 kỹ năng** (Reading, Listening, Writing, Speaking) — kỹ năng nào bạn **lâu chưa luyện thì tỉ lệ ra càng cao** (con số % hiển thị trên mỗi thẻ là xác suất hiện tại của kỹ năng/phần đó).
3. Sau khi 1 kỹ năng được chọn, app tự động quay tiếp để chọn **part/task/passage cụ thể** của kỹ năng đó (ví dụ: Writing → Task 1 hay Task 2; Speaking → Part 1+2 hay Part 3).
4. Có 1 quy tắc bắt buộc: **mỗi kỹ năng phải xuất hiện ít nhất 1 lần/tuần** — nếu 1 kỹ năng đã hơn 7 ngày chưa được chọn, nó sẽ được ưu tiên chọn ngay lần quay tiếp theo, bất kể xác suất.
5. Phần **"Lượt quay gần đây"** phía dưới hiển thị lịch sử các lần quay trước.

Mẹo: xác suất chỉ dựa vào **số lần đã xuất hiện** (không tính thời gian), nên nếu bạn muốn xác suất "công bằng" hơn theo thời gian thực tế đã luyện, hãy quay đều đặn hằng ngày.

---

## 2. Nhật ký (`/journal`)

Nơi ghi chú từ vựng, bài học, cảm nhận theo từng ngày.

1. Chọn **ngày**, viết nội dung vào ô lớn.
2. Muốn gắn nhãn cho ghi chú, chỉ cần gõ `#` ngay trong nội dung, ví dụ: *"Học được idiom mới cho #Writing"* — app sẽ tự nhận diện `#Writing` thành 1 tag, không cần điền vào ô riêng.
3. Bấm **"Lưu ghi chú"**.
4. Các tag đã dùng sẽ hiện thành nút bấm phía trên danh sách — bấm vào 1 tag để lọc chỉ xem các ghi chú có tag đó, bấm **"Tất cả"** để xem lại toàn bộ.
5. Mỗi ghi chú có nút **"Sửa"** và **"Xóa"** riêng.

---

## 3. Dự đoán Band điểm (`/prediction`)

Trang này gồm 2 phần: **nhập điểm thi thử Cambridge** và **xem dự đoán Band điểm**.

### Nhập kết quả thi thử

1. Điền ngày thi, tên đề (ví dụ "Cambridge 18 - Test 2"), và điểm 4 kỹ năng (Reading/Listening/Writing/Speaking, từ 0 đến 9, cách nhau 0.5).
2. Bấm **"Thêm kết quả"** — Band tổng (Overall) sẽ được tự tính theo đúng công thức làm tròn chính thức của IELTS.
3. Danh sách mặc định chỉ hiện **5 kết quả gần nhất**; bấm **"Xem tất cả"** để xem toàn bộ lịch sử, **"Thu gọn"** để quay lại.
4. Mỗi kết quả có thể **Sửa** hoặc **Xóa**.

### Dự đoán Band điểm

- App dự đoán Band điểm cho từng kỹ năng dựa **chủ yếu vào điểm thi thử Cambridge** (trung bình 30 bài gần nhất), cộng thêm **một chút điều chỉnh nhỏ** dựa vào tần suất bạn luyện tập kỹ năng đó gần đây — luyện nhiều hơn mức trung bình thì được cộng thêm một chút, ít hơn thì bị trừ một chút. Phần này **chỉ là phụ**, không làm lệch nhiều so với điểm thi thử thật.
- Nếu 1 kỹ năng chưa có kết quả thi thử nào, ô đó hiện **"Chưa đủ dữ liệu"** thay vì bịa ra một con số.
- **Band tổng dự đoán** chỉ hiện khi cả 4 kỹ năng đều có dữ liệu.
- Có 1 tùy chọn: **"Cách tính Band tổng dự đoán"** — chọn giữa "làm tròn từng kỹ năng trước" (giống cách IELTS thật tính điểm) hoặc "tính trung bình rồi làm tròn 1 lần". Hai cách này thỉnh thoảng cho ra kết quả khác nhau một chút; bạn có thể thử cả 2 xem cách nào hợp lý hơn với bạn.
- Biểu đồ **"Tần suất luyện tập (30 ngày gần đây)"** cho biết bạn đã luyện mỗi kỹ năng bao nhiêu lần trong tháng qua — dùng để nhìn nhanh xem kỹ năng nào đang bị bỏ bê.
- Phần **"Tỉ lệ Block A / Block B"**: cho Speaking và Reading, bạn có thể tự kéo thanh trượt để chỉnh tỉ lệ ra Block A (Part 1+2 / Passage 1+2) so với Block B (Part 3 / Passage 3) — mặc định 60/40 vì Block B thường khó hơn nên ra ít hơn, nhưng bạn có thể chỉnh lại theo ý mình.

---

## 4. Cài đặt (`/settings`)

Chọn bảng màu giao diện bạn thích — có 19 bảng màu khác nhau (kể cả bảng "Mặc định" là giao diện gốc). Bấm vào 1 ô màu để áp dụng ngay lập tức cho toàn bộ ứng dụng; lựa chọn được ghi nhớ cho lần mở sau (lưu trên trình duyệt của bạn, không đồng bộ giữa các máy).

---

## Câu hỏi thường gặp

**Xác suất quay có tính theo ngày không, hay chỉ theo số lần?**
Chỉ theo **số lần xuất hiện**, không theo thời gian — trừ ràng buộc "tối thiểu 1 lần/tuần" ở trên là ngoại lệ duy nhất dựa vào thời gian.

**Sao đôi khi Band dự đoán không đổi dù mới thêm điểm thi mới?**
Dự đoán tính trung bình 30 bài gần nhất, nên nếu bạn đã có nhiều dữ liệu, 1 điểm mới sẽ chỉ ảnh hưởng nhẹ tới trung bình chung.

**Đổi máy tính khác thì dữ liệu có mất không?**
Có — dữ liệu lưu trong file `dev.db` trên máy hiện tại, và bảng màu đã chọn lưu trên trình duyệt hiện tại. Muốn mang sang máy khác, copy file `dev.db` sang.
