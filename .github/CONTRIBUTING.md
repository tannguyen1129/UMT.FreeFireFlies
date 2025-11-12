# 🧩 Hướng dẫn đóng góp (Contributing Guidelines)

Cảm ơn bạn đã quan tâm đóng góp vào dự án của chúng tôi!  
Hướng dẫn này sẽ giúp bạn tham gia một cách **dễ dàng và hiệu quả**.

---

## 🧭 Quy tắc chung

- Tôn trọng tất cả các thành viên trong cộng đồng.  
- Đọc và tuân thủ [Code of Conduct](./CODE_OF_CONDUCT.md).  
- Đảm bảo mã nguồn của bạn tuân thủ **tiêu chuẩn code** của dự án.  

---

## 🚀 Quy trình đóng góp

### 1. 🐛 Tạo một Issue

- **Tìm kiếm trước:** Kiểm tra xem vấn đề hoặc ý tưởng của bạn đã tồn tại trong danh sách Issues chưa.  
- **Tạo Issue mới:** Nếu chưa, hãy tạo một Issue để thảo luận trước khi bắt đầu làm việc.  
- **Mô tả chi tiết:**
  - Vấn đề là gì?  
  - Cách giải quyết hoặc đề xuất của bạn.  

---

### 2. 🍴 Fork repository

- Nhấn nút **Fork** để tạo bản sao của repository vào tài khoản của bạn.  
- Clone repository đó về máy:

```bash
git clone https://github.com/<username>/<repository>.git
cd <repository>
```

---

### 3. 🔗 Cấu hình Upstream

Để giữ cho bản fork của bạn luôn cập nhật với dự án gốc, hãy thêm repository gốc làm upstream:

```bash
git remote add upstream https://github.com/<original-owner>/<repository>.git
```

---

### 4. 🌿 Tạo Branch Mới

Không bao giờ làm việc trực tiếp trên branch `main` (hoặc `master/develop`).  
Luôn tạo một branch mới cho mỗi tính năng hoặc bản vá lỗi.

Cập nhật branch chính của bạn với dự án gốc:

```bash
git checkout main
git pull upstream main
```

Tạo branch mới với tên mô tả rõ ràng:

```bash
git checkout -b ten-tinh-nang-cua-ban
```

**Ví dụ:**

```bash
git checkout -b feature/them-tinh-nang-dang-nhap
git checkout -b fix/loi-hien-thi-menu
```

---

### 5. 🧑‍💻 Viết mã nguồn và Kiểm thử (Code & Test)

Thực hiện các thay đổi của bạn.  
Hãy đảm bảo bạn tuân thủ tiêu chuẩn code của dự án (sử dụng linter nếu có).

**Viết Tests:**

- Nếu bạn thêm tính năng mới, hãy viết các bài kiểm thử (unit tests) đi kèm.  
- Nếu bạn sửa lỗi, hãy thêm một bài kiểm thử để chứng minh lỗi đã được sửa và không tái diễn.  

Chạy toàn bộ bộ kiểm thử để đảm bảo bạn không làm hỏng bất cứ thứ gì:

```bash
# (Thay bằng lệnh chạy test của dự án, ví dụ:)
npm test
```

Cập nhật tài liệu (`README.md` hoặc thư mục `docs/`) nếu thay đổi của bạn ảnh hưởng đến người dùng hoặc cách cài đặt.

---

### 6. 💾 Commit và Push

Commit các thay đổi của bạn với một thông điệp rõ ràng.  
Chúng tôi khuyến khích tuân theo **Conventional Commits**.

```bash
git add .
git commit -m "feat: Thêm tính năng đăng nhập bằng Google"
# Hoặc:
git commit -m "fix: Sửa lỗi hiển thị sai ngày tháng"
```

Đẩy (push) branch của bạn lên fork trên GitHub:

```bash
git push origin ten-tinh-nang-cua-ban
```

---

### 7. 🔁 Tạo Pull Request (PR)

- Truy cập repository gốc trên GitHub.  
- Bạn sẽ thấy một thông báo màu vàng đề xuất tạo Pull Request từ branch bạn vừa push.  
- Nhấn vào **Compare & pull request**.  

Điền đầy đủ thông tin vào mẫu PR:

- **Tiêu đề:** Rõ ràng, súc tích.  
- **Mô tả:** Giải thích bạn đã thay đổi những gì và tại sao.  
- **Liên kết Issue:** Đảm bảo bạn liên kết đến Issue đã tạo ở Bước 1  
  *(ví dụ: `Closes #123` để tự động đóng Issue khi PR được merge).*

Nhấn **Create pull request**.

---

### 8. 👀 Đánh giá mã nguồn (Code Review)

Các maintainer (người bảo trì) sẽ xem xét PR của bạn.  
Hãy sẵn sàng nhận phản hồi và thực hiện các thay đổi nếu được yêu cầu.  
Sau khi PR của bạn được chấp thuận, một maintainer sẽ merge nó vào dự án.

---

## ✍️ Tiêu chuẩn Commit (Commit Style Guide)

Chúng tôi tuân thủ **Conventional Commits** để giữ cho lịch sử commit rõ ràng và dễ theo dõi.  
Vui lòng sử dụng các tiền tố sau:

| Tiền tố | Mô tả |
|----------|--------|
| feat: | Thêm tính năng mới |
| fix: | Sửa lỗi |
| docs: | Thay đổi liên quan đến tài liệu |
| style: | Thay đổi định dạng code, không ảnh hưởng logic |
| refactor: | Tái cấu trúc code, không thêm tính năng hay sửa lỗi |
| test: | Thêm hoặc sửa các bài kiểm thử |
| chore: | Các công việc vặt, bảo trì, cập nhật dependencies |

**Ví dụ:**

```bash
feat(api): Thêm endpoint /users/profile
fix(ui): Sửa lỗi nút bấm bị lệch trên Firefox
docs(readme): Cập nhật hướng dẫn cài đặt
```

---

❤️ **Cảm ơn bạn!**  
Chúng tôi rất trân trọng mọi đóng góp của bạn — dù là sửa lỗi nhỏ, viết tài liệu, hay thêm tính năng mới.  
Cùng nhau, chúng ta sẽ làm cho dự án này tốt hơn! 🚀
