# 🌿 Nền tảng Dự báo Chất lượng Không khí Siêu địa phương và Điều hướng Xanh tại TP.HCM
**Team: UMT.FreeFireFiles**

[![OLP 2025](https://img.shields.io/badge/OLP-2025-red?style=for-the-badge&logo=viettel&logoColor=white)](https://olp.vn/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=for-the-badge)](https://opensource.org/licenses/Apache-2.0)
[![Tech Stack](https://img.shields.io/badge/Tech-Microservices%20%7C%20AI%20%7C%20IoT-green?style=for-the-badge)]()
[![Live Demo](https://img.shields.io/badge/Demo-Live_App-orange?style=for-the-badge)](https://olp.umtoj.edu.vn/app/rescue-app/citizenpage-673f7d3ae443011fab9eaaab?branch=main)

---

<div align="center">

  <a href="https://github.com/tannguyen1129/umtnewmountain/issues/new?assignees=&labels=bug&projects=&template=bug_report.md&title=%5BBug%5D%3A+%3CM%C3%B4+t%E1%BA%A3+ng%E1%BA%AFn+g%E1%BB%8Dn+v%E1%BB%81+l%E1%BB%97i%3E">
    <img src="https://img.shields.io/badge/🆘_Báo_cáo_Lỗi-(Bug_Report)-d9534f?style=for-the-badge" alt="Báo cáo lỗi" />
  </a>
  &nbsp;&nbsp;
  <a href="https://github.com/tannguyen1129/umtnewmountain/issues/new?assignees=&labels=enhancement&projects=&template=feature.md&title=Y%C3%AAu+c%E1%BA%A7u+t%C3%ADnh+n%C4%83ng%3A+%5BT%C3%AAn+t%C3%ADnh+n%C4%83ng%5D">
    <img src="https://img.shields.io/badge/🧑‍🏫_Yêu_cầu_Tính_năng-(Feature_Request)-0275d8?style=for-the-badge" alt="Yêu cầu tính năng" />
  </a>

</div>

---

## 📖 1. Giới Thiệu

**Green-AQI Navigator** là một hệ thống microservices đầy đủ, được xây dựng hoàn toàn trên các tiêu chuẩn **Dữ liệu Mở Liên kết (LOD)** và **Web Ngữ nghĩa**.

Hệ thống sử dụng **FIWARE Orion-LD Context Broker** làm trung tâm thần kinh. Dữ liệu được thu thập, xử lý, và truy vấn dưới dạng các thực thể (Entities) JSON-LD đã được chuẩn hóa (sử dụng ontology của [SmartDataModels](https://smartdatamodels.org/)).

### 🏆 Thông tin Cuộc thi
Dự án được thực hiện nhằm mục đích tham gia bảng [Phần mềm Nguồn Mở](https://www.olp.vn/procon-pmmn/ph%E1%BA%A7n-m%E1%BB%81m-ngu%E1%BB%93n-m%E1%BB%9F) trong khuôn khổ **Kỳ thi Olympic Tin học sinh viên Việt Nam lần thứ 34** tổ chức tại [Trường Đại học Công nghệ Thành phố Hồ Chí Minh (HUTECH)](https://www.hutech.edu.vn/) từ ngày 09/12/2025 đến ngày 12/12/2025.

### 📄 Bản quyền
Phần mềm được đội ngũ tác giả của **UMT.FreeFireFiles** open source theo giấy phép [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0).

**🔗 Live Demo:** [Bấm vào đây để trải nghiệm ngay](https://olp.umtoj.edu.vn/app/rescue-app/citizenpage-673f7d3ae443011fab9eaaab?branch=main)

---

## 📑 Mục lục tài liệu

1. [Giới Thiệu](#1-giới-thiệu)
2. [Tổng quan hệ thống](#2-tổng-quan-hệ-thống)
3. [Chức năng](#3-chức-năng)
4. [Screens Flow của dự án](#4-screens-flow-của-dự-án)
5. [Hướng dẫn cài đặt](#5-hướng-dẫn-cài-đặt)
    - [5.1. 📋 Yêu cầu - Prerequisites](#51-yêu-cầu---prerequisites)
    - [5.2. 🔥 Dựng APIs (Backend)](#52-dựng-apis-backend)
    - [5.3. 🔨 Cài đặt Client](#53-cài-đặt-client)
6. [Đóng góp](#6-đóng-góp)
7. [Liên lạc](#7-liên-lạc)
8. [License (Giấy phép)](#8-license-giấy-phép)

---

## 🏗️ 2. Tổng quan hệ thống

Dự án áp dụng kiến trúc **Microservices** hiện đại, đảm bảo tính mở rộng và linh hoạt.



[Image of microservices architecture diagram]


* **Core:** [FIWARE Orion-LD Context Broker](https://github.com/FIWARE/context.Orion-LD) (Quản lý ngữ cảnh & Dữ liệu liên kết).
* **Backend (NestJS):**
    * `api-gateway`: Cổng giao tiếp tập trung.
    * `aqi-service`: Thu thập dữ liệu đa nguồn (Agents), Logic nghiệp vụ.
    * `notification-service`: Hệ thống cảnh báo thông minh (Polling & FCM).
    * `user-service`: Quản lý người dùng & Gamification.
    * `auth-service`: Xác thực JWT.
* **AI Module (Python):** Mô hình **ST-GNN** (Spatio-Temporal Graph Neural Network) dự báo PM2.5 dựa trên Không gian (Graph) & Thời gian (LSTM).
* **Database:** PostgreSQL (PostGIS - Dữ liệu không gian), MongoDB (Context Data).
* **Frontend:**
    * **Mobile App:** Flutter (Dành cho Công dân).
    * **Web Dashboard:** Next.js (Dành cho Quản lý).

---

## 🚀 3. Chức năng

### 📱 A. Ứng dụng Công dân (Mobile App)

| Tính năng | Mô tả & Công nghệ |
| :--- | :--- |
| **🗺️ Bản đồ Nhiệt (Heatmap)** | Hiển thị lớp phủ ô nhiễm mịn màng toàn thành phố nhờ thuật toán nội suy **IDW**. |
| **🌱 Tìm đường Xanh** | Gợi ý lộ trình đi tránh các vùng ô nhiễm cao, ưu tiên đi qua công viên/cây xanh. |
| **🚗 Dẫn đường Real-time** | Chế độ dẫn đường thời gian thực, tự động cảnh báo khi đi vào vùng ô nhiễm. |
| **🗣️ Khoa học Công dân** | Người dân gửi cảm nhận ("Mặt cười/Mếu") về không khí tại chỗ. |
| **⚠️ Báo cáo Sự cố** | Chụp ảnh, định vị và gửi báo cáo các điểm đốt rác, bụi bặm xây dựng. |
| **🏥 Trợ lý Sức khỏe** | Cảnh báo cá nhân hóa dựa trên hồ sơ bệnh lý (Người già, Hen suyễn...). |
| **🏆 Gamification** | Tích "Điểm Xanh" khi hoàn thành lộ trình sạch. Bảng xếp hạng thi đua. |

### 💻 B. Web Dashboard (Quản lý)

* **Trung tâm Giám sát (Monitoring Map):** Cái nhìn toàn cảnh (God-mode) với các lớp dữ liệu: Trạm quan trắc, Sự cố, Cảm nhận dân sinh.
* **Phân tích Dữ liệu (Analytics):** Biểu đồ xu hướng AQI, Tương quan giữa Mật độ giao thông và Ô nhiễm (Data-driven insights).
* **Quản lý Sự cố:** Quy trình duyệt/từ chối báo cáo khép kín. Hệ thống tự động gửi thông báo về App người dân khi xử lý xong.

---

## 🖼️ 4. Screens Flow của dự án

### Mobile App
| Trang chủ (Heatmap) | Tìm đường & Dẫn đường | Báo cáo Sự cố | Thành tích & Hồ sơ |
| :---: | :---: | :---: | :---: |
| <img src="LINK_ANH_HOME_SCREEN" width="200" /> | <img src="LINK_ANH_NAVIGATION" width="200" /> | <img src="LINK_ANH_REPORT" width="200" /> | <img src="LINK_ANH_PROFILE" width="200" /> |

### Web Dashboard
<div align="center">
  <img src="LINK_ANH_WEB_DASHBOARD" width="800" />
</div>

---

## 🛠️ 5. Hướng dẫn cài đặt

### 5.1. 📋 Yêu cầu - Prerequisites
* Docker & Docker Compose
* Node.js 18+
* Python 3.10+
* Flutter SDK

### 5.2. 🔥 Dựng APIs (Backend)

Chúng tôi cung cấp file `docker-compose.yml` để khởi chạy toàn bộ hạ tầng Backend chỉ với 1 lệnh.

1.  **Clone repository:**
    ```bash
    git clone [https://github.com/tannguyen1129/green-aqi-navigator.git](https://github.com/tannguyen1129/green-aqi-navigator.git)
    cd green-aqi-navigator
    ```
2.  **Cấu hình biến môi trường:** Copy `.env.example` thành `.env` và điền API Key.
3.  **Khởi chạy hệ thống:**
    ```bash
    docker compose up --build -d
    ```
    *Lệnh này sẽ khởi động: PostgreSQL, MongoDB, Orion-LD, API Gateway, Microservices, Web Admin.*

### 5.3. 🔨 Cài đặt Client (Mobile)

1.  Vào thư mục Frontend: `cd apps/frontend`
2.  Cấu hình IP (Nếu chạy máy thật): Sửa `lib/core/api/api_client.dart`.
3.  Chạy:
    ```bash
    flutter pub get
    flutter run
    ```

---

## 🤝 6. Đóng góp
Dự án tuân thủ tinh thần nguồn mở. Mọi đóng góp (Pull Request) đều được hoan nghênh.
1.  Fork dự án.
2.  Tạo nhánh (`git checkout -b feature/AmazingFeature`).
3.  Commit (`git commit -m 'Add some AmazingFeature'`).
4.  Push (`git push origin feature/AmazingFeature`).
5.  Mở Pull Request.

---

## 📞 7. Liên lạc

**Team UMT.FreeFireFiles** - Đại học Quản lý và Công nghệ TP.HCM (UMT)

* **Lead Developer:** Nguyễn Nhật Tân
* **Email:** tannguyen1129@gmail.com
* **Repository:** [Github Link](https://github.com/tannguyen1129/green-aqi-navigator)

---

## 8. License (Giấy phép)

Distributed under the Apache 2.0 License. See `LICENSE` for more information.