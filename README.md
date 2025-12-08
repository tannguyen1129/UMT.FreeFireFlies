<div align="center">

# 🌿 Green-AQI Navigator
### Nền tảng Dự báo Chất lượng Không khí Siêu địa phương & Điều hướng Xanh

**Team: UMT.FreeFireFiles**

[![OLP 2025](https://img.shields.io/badge/OLP_2025-HUTECH-red?style=for-the-badge&logo=viettel&logoColor=white)](https://olp.vn/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=for-the-badge)](https://opensource.org/licenses/Apache-2.0)
[![Tech Stack](https://img.shields.io/badge/Tech-Microservices%20%7C%20AI%20%7C%20IoT-green?style=for-the-badge)]()
[![Live Demo](https://img.shields.io/badge/Demo-Live_App-orange?style=for-the-badge)](https://olp.umtoj.edu.vn/app/rescue-app/citizenpage-673f7d3ae443011fab9eaaab?branch=main)

---

<p align="center">
  <a href="https://github.com/tannguyen1129/UMT.FreeFireFlies/issues/new?template=bao_cao_loi.md">
    <img src="https://img.shields.io/badge/🆘_Báo_cáo_Lỗi-(Bug_Report)-d9534f?style=flat-square" alt="Báo cáo lỗi" />
  </a>
  &nbsp;&nbsp;
  <a href="https://github.com/tannguyen1129/UMT.FreeFireFlies/issues/new?template=yeu_cau_tinh_nang.md">
    <img src="https://img.shields.io/badge/🧑‍🏫_Yêu_cầu_Tính_năng-(Feature_Request)-0275d8?style=flat-square" alt="Yêu cầu tính năng" />
  </a>
</p>

</div>

---

## 📑 Mục lục

1. [Giới Thiệu](#-1-giới-thiệu)
2. [Tổng quan hệ thống](#-2-tổng-quan-hệ-thống)
3. [Chức năng chi tiết](#-3-chức-năng)
4. [Kiến trúc & Luồng màn hình](#-4-kiến-trúc-của-dự-án)
5. [Hướng dẫn cài đặt](#-5-hướng-dẫn-cài-đặt)
    - [Yêu cầu (Prerequisites)](#51-yêu-cầu---prerequisites)
    - [Dựng Backend (APIs)](#52-dựng-apis-backend)
    - [Dựng Frontend (Web & Mobile)](#53-cài-đặt-web-admingoverment)
6. [Quản lý User & Test Credentials](#-6-quản-lý-người-dùng--phân-quyền-user--roles)
7. [Đóng góp (Contribution)](#-7-đóng-góp)
8. [Liên hệ & Tác giả](#-8-liên-lạc)
9. [Phụ lục: Firebase Key](#10-phụ-lục)

---

## 📖 1. Giới Thiệu

**Green-AQI Navigator** là một hệ thống microservices toàn diện, được xây dựng dựa trên tiêu chuẩn **Dữ liệu Mở Liên kết (LOD)** và **Web Ngữ nghĩa**. 

Hệ thống sử dụng **FIWARE Orion-LD Context Broker** làm "trung tâm thần kinh". Dữ liệu được thu thập, xử lý và truy vấn dưới dạng các thực thể (Entities) JSON-LD đã được chuẩn hóa (sử dụng ontology của [SmartDataModels](https://smartdatamodels.org/)).

### 🏆 Thông tin Cuộc thi
> Dự án tham gia bảng **Phần mềm Nguồn Mở** trong khuôn khổ **Kỳ thi Olympic Tin học sinh viên Việt Nam lần thứ 34** tổ chức tại [HUTECH](https://www.hutech.edu.vn/) (09/12/2025 - 12/12/2025).

### 📄 Bản quyền & Demo
* **Open Source:** [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0).
* **Live Demo:** [👉 Trải nghiệm ngay tại đây](https://olp.umtoj.edu.vn/app/rescue-app/citizenpage-673f7d3ae443011fab9eaaab?branch=main)

---

## 🧩 2. Tổng quan hệ thống

Dự án áp dụng kiến trúc **Microservices** hiện đại, đảm bảo tính mở rộng và linh hoạt.

* **🌐 Core:** [FIWARE Orion-LD Context Broker](https://github.com/FIWARE/context.Orion-LD) (Quản lý ngữ cảnh & Dữ liệu liên kết).
* **⚙️ Backend (NestJS):**
    * `api-gateway`: Cổng giao tiếp tập trung.
    * `aqi-service`: Thu thập dữ liệu (Agents), Logic nghiệp vụ.
    * `notification-service`: Hệ thống cảnh báo (Polling & FCM).
    * `user-service`: Quản lý người dùng & Gamification.
    * `auth-service`: Xác thực JWT.
* **🧠 AI Module (Python):** Mô hình **ST-GNN** dự báo PM2.5 (Graph + LSTM).
* **💾 Database:** PostgreSQL (PostGIS), MongoDB (Context Data).
* **🖥️ Frontend:**
    * **Mobile App:** Flutter (Công dân).
    * **Web Dashboard:** Next.js (Quản lý/Chính quyền).

---

## 🚀 3. Chức năng

### A. Ứng dụng Công dân (Mobile App)

| Tính năng | Mô tả & Công nghệ |
| :--- | :--- |
| **🗺️ Bản đồ Nhiệt (Heatmap)** | Hiển thị lớp phủ ô nhiễm mịn màng toàn thành phố nhờ thuật toán nội suy **IDW**. |
| **🌱 Tìm đường Xanh** | Gợi ý lộ trình tránh vùng ô nhiễm, ưu tiên đi qua công viên/cây xanh. |
| **🚗 Dẫn đường Real-time** | Chế độ dẫn đường thời gian thực, tự động cảnh báo khi đi vào vùng ô nhiễm. |
| **🗣️ Khoa học Công dân** | Gửi cảm nhận ("Mặt cười/Mếu") về không khí tại chỗ. |
| **⚠️ Báo cáo Sự cố** | Chụp ảnh, định vị và báo cáo điểm đốt rác, bụi xây dựng. |
| **🏥 Trợ lý Sức khỏe** | Cảnh báo cá nhân hóa (Người già, Hen suyễn...). |
| **🏆 Gamification** | Tích "Điểm Xanh", bảng xếp hạng thi đua. |

### B. Web Dashboard (Quản lý)

* **🔭 God-mode Monitoring:** Giám sát toàn cảnh (Trạm quan trắc, Sự cố, Cảm nhận dân sinh).
* **📊 Analytics:** Biểu đồ xu hướng AQI, Tương quan giao thông - ô nhiễm.
* **✅ Quản lý Sự cố:** Quy trình duyệt/từ chối báo cáo. Tự động thông báo về App người dân.

---

## 📐 4. Kiến trúc của dự án

![Kiến trúc phần mềm nguồn mở](doc/Kien-truc-pmnm.png)

*(Vui lòng đảm bảo file ảnh nằm đúng thư mục `doc/`)*

---

## 🛠️ 5. Hướng dẫn cài đặt

### 5.1. Yêu cầu - Prerequisites

<details>
<summary><b>🔻 Click để xem hướng dẫn cài Docker & Node.js</b></summary>

#### 1. Cài đặt Docker và Docker Compose

Gỡ bản Docker cũ (nếu có):
```bash
sudo apt-get remove docker docker-engine docker.io containerd runc
````

Cài các package hỗ trợ & GPG Key:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
curl -fsSL [https://download.docker.com/linux/ubuntu/gpg](https://download.docker.com/linux/ubuntu/gpg) | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

Thêm repo và cài đặt:

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  [https://download.docker.com/linux/ubuntu](https://download.docker.com/linux/ubuntu) \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

#### 2\. Cài Node.js 20+

```bash
curl -fsSL [https://deb.nodesource.com/setup_20.x](https://deb.nodesource.com/setup_20.x) | sudo -E bash -
sudo apt-get install -y nodejs
```

\</details\>

### 5.2. Dựng APIs (Backend)

**Bước 1: Lấy API Key**
Bạn cần đăng ký tài khoản và lấy Key tại:

  * [OpenRouteService](https://api.openrouteservice.org/) (Dẫn đường)
  * [OpenWeatherMap](https://home.openweathermap.org/users/sign_up) (Dữ liệu thời tiết)

**Bước 2: Clone & Cấu hình**

```bash
git clone [https://github.com/tannguyen1129/UMT.FreeFireFlies.git](https://github.com/tannguyen1129/UMT.FreeFireFlies.git) green-aqi-navigator
cd green-aqi-navigator
# Copy file môi trường và điền API Key vừa lấy vào file .env này
cp .env.example .env
```

**Bước 3: Khởi chạy hệ thống**

```bash
# Tạo network
docker network create green-net

# Chạy Core (MongoDB, Orion-LD)
docker compose -f docker-compose.fiware.yml up -d

# Chạy Services (PostgreSQL, APIs)
docker compose up --build -d
```

### 5.3. Cài đặt Web Admin/Goverment

```bash
git clone [https://github.com/tannguyen1129/UMT.FreeFireFlies-frontend.git](https://github.com/tannguyen1129/UMT.FreeFireFlies-frontend.git) green-aqi-dashboard
docker compose up --build -d
```

> Truy cập Dashboard tại `http://localhost:3000` (hoặc port bạn cấu hình).

### 5.4. Cài đặt Citizen Mobile App

👉 Xem chi tiết tại: [Hướng dẫn cài đặt Citizen Mobile](https://tannguyen1129.github.io/UMT.FreeFireFlies-frontend/)

-----

## 🔐 6. Quản lý Người dùng & Phân quyền (User & Roles)

Hệ thống sử dụng **RBAC** (Role-Based Access Control). Dưới đây là tài khoản mặc định để Ban giám khảo kiểm thử:

### 📋 Default Credentials

| Vai trò | Email | Mật khẩu | Nền tảng |
| :--- | :--- | :--- | :--- |
| **Công dân** | `user@gmail.com` | `Password123` | Mobile App |
| **Cán bộ** | `gov@green.aqi` | `Password123` | Web Dashboard |
| **Admin** | `admin@green.aqi`| `Password123` | Web Dashboard |

### ⚙️ Database Seeding (Khôi phục dữ liệu)

\<details\>
\<summary\>\<b\>🔻 Click để xem lệnh tạo lại tài khoản khi reset DB\</b\>\</summary\>

Nếu bạn xóa Database hoặc deploy mới, hãy chạy các lệnh sau để tạo tài khoản và phân quyền chuẩn:

**1. Đăng ký tài khoản qua API:**

```bash
# Admin
curl -X POST http://localhost:3003/auth/register -H 'Content-Type: application/json' \
-d '{"email":"admin@green.aqi", "password":"Password123", "fullName":"Super Admin", "phoneNumber":"0909000001", "agencyDepartment":"System Admin"}'

# Gov
curl -X POST http://localhost:3003/auth/register -H 'Content-Type: application/json' \
-d '{"email":"gov@green.aqi", "password":"Password123", "fullName":"Can Bo Moi Truong", "phoneNumber":"0909000002", "agencyDepartment":"So TNMT"}'

# Citizen
curl -X POST http://localhost:3003/auth/register -H 'Content-Type: application/json' \
-d '{"email":"user@gmail.com", "password":"Password123", "fullName":"Nguyen Van Dan", "phoneNumber":"0909000003"}'
```

**2. Cấp quyền trong PostgreSQL:**

```bash
sudo docker exec -it green-aqi-postgres psql -U postgres -d green_aqi_db -c "
INSERT INTO user_roles (user_id, role_id) SELECT u.user_id, r.role_id FROM users u, roles r WHERE u.email = 'admin@green.aqi' AND r.role_name = 'admin' ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role_id) SELECT u.user_id, r.role_id FROM users u, roles r WHERE u.email = 'gov@green.aqi' AND r.role_name = 'government_official' ON CONFLICT DO NOTHING;
DELETE FROM user_roles WHERE role_id = (SELECT role_id FROM roles WHERE role_name = 'citizen') AND user_id IN (SELECT user_id FROM users WHERE email IN ('admin@green.aqi', 'gov@green.aqi'));
"
```

\</details\>

-----

## 🤝 7. Đóng góp

Chúng tôi hoan nghênh mọi đóng góp (Pull Request)\!

1.  Fork dự án.
2.  Tạo nhánh (`git checkout -b feature/AmazingFeature`).
3.  Commit (`git commit -m 'Add AmazingFeature'`).
4.  Push (`git push origin feature/AmazingFeature`).
5.  Mở Pull Request.

-----

## 📞 8. Liên lạc

**Team UMT.FreeFireFiles** - Trường Đại học Quản lý và Công nghệ TP.HCM (UMT)

  * 👨‍💻 **Lead Developer:** Sơn Tân (`tandtnt15@gmail.com`)
  * 🤖 **AI Engineer:** Võ Ngọc Trâm Anh
  * 🎨 **Frontend Developer:** Phan Nguyễn Duy Kha

**Repositories:**

  * [Backend Repo](https://github.com/tannguyen1129/UMT.FreeFireFlies)
  * [Frontend Citizen](https://github.com/tannguyen1129/UMT.FreeFireFiles-webdashboard.git)
  * [Frontend Dashboard](https://github.com/tannguyen1129/UMT.FreeFireFlies-frontend.git)

-----

## 10\. Phụ lục

### 🔥 Cấu hình Firebase Admin SDK (Cho Notification)

Để chức năng thông báo hoạt động, bạn cần file Service Account từ Firebase:

1.  Truy cập [Firebase Console](https://console.firebase.google.com/) \> **Project Settings** \> **Service accounts**.
2.  Chọn **Node.js** \> Bấm **Generate new private key**.
3.  Đổi tên file tải về thành `firebase-admin-key.json`.
4.  Di chuyển file vào thư mục:
    ```text
    apps/notification-service/firebase-admin-key.json
    ```

-----

\<div align="center"\>
\<i\>Distributed under the Apache 2.0 License. Built with ❤️ by UMT.FreeFireFiles\</i\>
\</div\>

```
```