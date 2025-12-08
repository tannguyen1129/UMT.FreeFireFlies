# Changelog

Mọi thay đổi đáng chú ý của dự án sẽ được ghi lại trong file này.

## [Unreleased] - 08/12/2025

Giai đoạn tập trung vào hoàn thiện tài liệu, tái cấu trúc thư mục dự án và sửa lỗi mô hình dự báo cuối cùng.

### ♻️ Changed (Thay đổi/Cải thiện)
- **Refactor Structure:** Chuyển các `submodules` ra thư mục gốc (root directory) để tối ưu hóa cấu trúc dự án.
- **Documentation:**
    - Cập nhật toàn diện `README.md` (chỉnh sửa CSS, nội dung).
    - Bổ sung và chỉnh sửa tài liệu hướng dẫn cài đặt/sử dụng (Header, hướng dẫn chưa lưu).
    - Thêm hướng dẫn tích hợp **Firebase**.
    - Bổ sung hướng dẫn cài đặt **Docker**.
- **License:** Thêm thông tin bản quyền (License header) vào đầu các file code.

### 🐛 Fixed (Sửa lỗi)
- **AI/Forecasting:** Sửa lỗi tính năng dự báo (Fix dự báo).
- **General:** Các bản sửa lỗi nhỏ và cập nhật docs khác.

---

## [07/12/2025] - Ổn định Hạ tầng & Tính năng Báo cáo

### ✨ Added (Tính năng mới)
- **Reporting:** Thêm mẫu vấn đề (Issue templates) và tính năng tạo báo cáo.
- **Pagination:** Bổ sung tính năng phân trang cho danh sách dữ liệu.

### 👷 DevOps & Infrastructure
- **Docker:**
    - Fix `Dockerfile` cho `noti-service`.
    - Cập nhật `Dockerfile` chung và `requirements.txt`.
- **Config:** Cập nhật file cấu hình `.env` mới nhất.

### 📚 Documentation
- Cập nhật hướng dẫn cài đặt chi tiết cho phía Backend.

---

## [29/11/2025 - 06/12/2025] - Nâng cấp AI & Chuẩn bị Deploy

### 🚀 Major Changes (Thay đổi lớn)
- **AI Model Upgrade:** Nâng cấp mô hình dự báo từ Linear -> LSTM -> **GNN (Graph Neural Networks)** để tăng độ chính xác theo không gian và thời gian.

### 👷 DevOps
- **Deployment:** Chuẩn bị server và cấu hình môi trường để deploy (Prepare deploy server).
- **Docker:** Cập nhật Dockerfile và tài liệu liên quan.

---

## [23/11/2025 - 24/11/2025] - Dashboard Analytics & Health Advisor

### ✨ Added
- **Analytics Dashboard:** Hoàn thiện Dashboard phân tích dữ liệu bao gồm:
    - Biểu đồ xu hướng (Trends).
    - Biểu đồ tương quan (Correlation).
    - Thống kê sự cố (Incidents).
- **Health Advisor:** Phát triển tính năng tư vấn sức khỏe (Health Advisor backend).

### 🐛 Fixed
- Retrain lại model AI và sửa lỗi dịch vụ thông báo (Notification Service).
- Fix lỗi hiển thị trên Dashboard Analytics.

---

## [19/11/2025] - Hệ thống Thông báo & Khu vực Nhạy cảm

### ✨ Added
- **Notification:**
    - Tích hợp **Firebase Cloud Messaging (FCM)** có bảo mật (secured).
    - Cải thiện hệ thống Notification backend và tích hợp với AI Model.
- **Sensitive Areas:** Tích hợp dữ liệu và API cho các khu vực nhạy cảm (Trường học, Bệnh viện...) vào `aqi-service` và Frontend.

### ⚖️ License
- Cập nhật định dạng chuẩn cho License Apache 2.0.

---

## [12/11/2025 - 18/11/2025] - Core Backend & Thu thập Dữ liệu

### ✨ Added
- **AQI Service:**
    - Hoàn thành backend cho tính năng thu thập dữ liệu không khí.
    - Thêm API Recommendation (Gợi ý/Khuyến nghị).
    - Tích hợp Agent thu thập dữ liệu từ **OpenAQ** và **OpenWeatherMap (OWM)**.
    - Xây dựng nền tảng cho tính năng Cảnh báo AQI (Warning System).
- **Community:** Thêm `CODE_OF_CONDUCT.md` và `CONTRIBUTING.md`.

### 🐛 Fixed
- Sửa lỗi tìm kiếm đường đi (search road) trong `aqi-service`.

---

## [06/11/2025 - 11/11/2025] - Khởi tạo Dự án & Tích hợp NGSI-LD

### ✨ Added
- **Infrastructure:**
    - Thiết lập cấu trúc dự án hoàn chỉnh (Project structure).
    - Thiết lập hạ tầng AI và Backend cơ bản.
- **Integration:**
    - Tích hợp **Orion-LD Context Broker** để đồng bộ hóa sự cố (incident sync).
    - Tích hợp `ConfigModule` và `.env` cho toàn bộ backend.
- **License:** Thêm Apache License 2.0 cho dự án.