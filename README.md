<div align="center">

  <h1>🌿 Green-AQI Navigator</h1>
  <h3>Nền tảng Dự báo Chất lượng Không khí Siêu địa phương & Điều hướng Xanh</h3>

  <p><b>Team: UMT.FreeFireFiles</b></p>

  <p>
    <a href="https://www.olp.vn/">
      <img src="https://img.shields.io/badge/OLP_2025-HUTECH-red?style=for-the-badge&logo=viettel&logoColor=white" alt="OLP 2025">
    </a>
    <a href="https://opensource.org/licenses/Apache-2.0">
      <img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=for-the-badge" alt="License">
    </a>
    <a href="#">
      <img src="https://img.shields.io/badge/Tech-Microservices%20%7C%20AI%20%7C%20IoT-green?style=for-the-badge" alt="Tech Stack">
    </a>
    <a href="https://techgen.umt.edu.vn/">
      <img src="https://img.shields.io/badge/UMT-orange?style=for-the-badge" alt="UMT">
    </a>
  </p>

  <hr>

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

## 📖 1. Giới Thiệu

> **Green-AQI Navigator** là một hệ thống microservices đầy đủ, được xây dựng hoàn toàn trên các tiêu chuẩn **Dữ liệu Mở Liên kết (LOD)** và **Web Ngữ nghĩa**.

Hệ thống sử dụng **FIWARE Orion-LD Context Broker** làm trung tâm thần kinh. Dữ liệu được thu thập, xử lý, và truy vấn dưới dạng các thực thể (Entities) JSON-LD đã được chuẩn hóa (sử dụng ontology của [SmartDataModels](https://smartdatamodels.org/)).

### 🏆 Thông tin Cuộc thi

Dự án được thực hiện nhằm mục đích tham gia bảng **[Phần mềm Nguồn Mở](https://www.olp.vn/procon-pmmn/ph%E1%BA%A7n-m%E1%BB%81m-ngu%E1%BB%93n-m%E1%BB%9F)** trong khuôn khổ **Kỳ thi Olympic Tin học sinh viên Việt Nam lần thứ 34** tổ chức tại [Trường Đại học Công nghệ Thành phố Hồ Chí Minh (HUTECH)](https://www.hutech.edu.vn/) từ ngày 09/12/2025 đến ngày 12/12/2025.

### 📄 Bản quyền

Phần mềm được đội ngũ tác giả của **UMT.FreeFireFiles** open source theo giấy phép [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0).

-----

## 📑 Mục lục tài liệu

1.  [Giới Thiệu](https://www.google.com/search?q=%23-1-gi%E1%BB%9Bi-thi%E1%BB%87u)
2.  [Tổng quan hệ thống](https://www.google.com/search?q=%23-2-t%E1%BB%95ng-quan-h%E1%BB%87-th%E1%BB%91ng)
3.  [Chức năng](https://www.google.com/search?q=%23-3-ch%E1%BB%A9c-n%C4%83ng)
4.  [Kiến trúc của dự án](https://www.google.com/search?q=%23-4-ki%E1%BA%BFn-tr%C3%BAc-c%E1%BB%A7a-d%E1%BB%B1-%C3%A1n)
5.  [Hướng dẫn cài đặt](https://www.google.com/search?q=%23-5-h%C6%B0%E1%BB%9Bng-d%E1%BA%ABn-c%C3%A0i-%C4%91%E1%BA%B7t)
6.  [Quản lý Người dùng & Phân quyền](https://www.google.com/search?q=%23-6-qu%E1%BA%A3n-l%C3%BD-ng%C6%B0%E1%BB%9Di-d%C3%B9ng--ph%C3%A2n-quy%E1%BB%81n-user--roles)
7.  [Đóng góp](https://www.google.com/search?q=%23-7-%C4%91%C3%B3ng-g%C3%B3p)
8.  [Liên lạc](https://www.google.com/search?q=%23-8-li%C3%AAn-l%E1%BA%A1c)
9.  [Giấy phép (License)](https://www.google.com/search?q=%23-9-gi%E1%BA%A5y-ph%C3%A9p-license)
10. [Phụ lục](https://www.google.com/search?q=%23-10-ph%E1%BB%A5-l%E1%BB%A5c)

-----

## 🔭 2. Tổng quan hệ thống

Dự án áp dụng kiến trúc **Microservices** hiện đại, đảm bảo tính mở rộng và linh hoạt.

| Thành phần | Công nghệ & Vai trò |
| :--- | :--- |
| **Core** | **[FIWARE Orion-LD](https://github.com/FIWARE/context.Orion-LD)** (Quản lý ngữ cảnh & Dữ liệu liên kết). |
| **Backend** | **NestJS**: <br>• `api-gateway`: Cổng giao tiếp tập trung.<br>• `aqi-service`: Thu thập dữ liệu (Agents), Logic nghiệp vụ.<br>• `notification-service`: Cảnh báo thông minh (Polling & FCM).<br>• `user-service`: Quản lý người dùng & Gamification.<br>• `auth-service`: Xác thực JWT. |
| **AI Module** | **Python**: Mô hình **ST-GNN** dự báo PM2.5 dựa trên Graph & LSTM. |
| **Database** | **PostgreSQL** (PostGIS - Dữ liệu không gian), **MongoDB** (Context Data). |
| **Frontend** | • **Mobile App:** Flutter (Dành cho Công dân).<br>• **Web Dashboard:** Next.js (Dành cho Quản lý). |

-----

## 🛠 3. Chức năng

### A. Ứng dụng Công dân (Mobile App)

| Tính năng | Mô tả & Công nghệ |
| :--- | :--- |
| **🗺️ Bản đồ Nhiệt** | Hiển thị lớp phủ ô nhiễm mịn màng toàn thành phố nhờ thuật toán nội suy **IDW**. |
| **🌱 Tìm đường Xanh** | Gợi ý lộ trình đi tránh các vùng ô nhiễm cao, ưu tiên đi qua công viên/cây xanh. |
| **🚗 Dẫn đường Live** | Chế độ dẫn đường thời gian thực, tự động cảnh báo khi đi vào vùng ô nhiễm. |
| **🗣️ Khoa học Công dân** | Người dân gửi cảm nhận ("Mặt cười/Mếu") về không khí tại chỗ. |
| **⚠️ Báo cáo Sự cố** | Chụp ảnh, định vị và gửi báo cáo các điểm đốt rác, bụi bặm xây dựng. |
| **🏥 Trợ lý Sức khỏe** | Cảnh báo cá nhân hóa dựa trên hồ sơ bệnh lý (Người già, Hen suyễn...). |
| **🏆 Gamification** | Tích "Điểm Xanh" khi hoàn thành lộ trình sạch. Bảng xếp hạng thi đua. |

### B. Web Dashboard (Quản lý)

| Tính năng | Mô tả |
| :--- | :--- |
| **🖥️ Trung tâm Giám sát** | Cái nhìn toàn cảnh (God-mode) với các lớp dữ liệu: Trạm quan trắc, Sự cố, Cảm nhận dân sinh. |
| **📊 Phân tích Dữ liệu** | Biểu đồ xu hướng AQI, Tương quan giữa Mật độ giao thông và Ô nhiễm (Data-driven insights). |
| **⚙️ Quản lý Sự cố** | Quy trình duyệt/từ chối báo cáo khép kín. Hệ thống tự động gửi thông báo về App người dân khi xử lý xong. |

-----

## 🏗 4. Kiến trúc của dự án

![Kiến trúc PMNM](doc/Kien-truc-pmnm.png)

-----

## 💻 5. Hướng dẫn cài đặt

### 5.1. Yêu cầu - Prerequisites

#### 🐳 1. Cài đặt Docker và Docker Compose

**Bước 1: Gỡ bản Docker cũ (nếu có)**

```bash
sudo apt-get remove docker docker-engine docker.io containerd runc
```

**Bước 2: Cài các package hỗ trợ**

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release
```

**Bước 3: Thêm GPG key**

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

**Bước 4: Thêm repo Docker**

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

**Bước 5: Cài Docker Engine + Docker Compose plugin (v2)**

```bash
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

**Kiểm tra version:**

```bash
docker --version
docker compose version
```

### 5.2. Dựng APIs (Backend)

Chúng tôi cung cấp file `docker-compose.yml` để khởi chạy toàn bộ hạ tầng Backend một cách dễ dàng.

#### 1\. Lấy Key API các nền tảng cần thiết

🔑 Hướng dẫn lấy key OpenRouteService

1.  Vào website: [https://api.openrouteservice.org/](https://api.openrouteservice.org/)
2.  Chọn **Sign up**. Sau đó đăng ký tài khoản và kích hoạt tài khoản ở email.
3.  Đăng nhập bằng tài khoản mới tạo. Tại Dashboard bạn sẽ thấy chỗ lấy API Key.

🌦️ Hướng dẫn lấy key OpenWeatherMap

1.  Vào website: [https://home.openweathermap.org/users/sign\_up](https://home.openweathermap.org/users/sign_up) để tạo tài khoản.
2.  Đăng ký thành công và quay lại đăng nhập. Chọn tên tài khoản gốc trên bên phải sau đó chọn **"My API Keys"**.
3.  Copy API key có sẵn hoặc tự tạo mới bằng nút **"Generate"** phía bên phải.

#### 2\. Clone repository

```bash
git clone https://github.com/tannguyen1129/UMT.FreeFireFlies.git green-aqi-navigator 
cd green-aqi-navigator
```

#### 3\. Cấu hình biến môi trường

Copy `.env.example` thành `.env` và điền các API Key đã lấy ở bước 1.

#### 4\. Khởi chạy hệ thống

**Tạo network:**

```bash
docker network create green-net
```

**Khởi động Core (MongoDB, Orion-LD):**

```bash
docker compose -f docker-compose.fiware.yml up -d
```

**Khởi động Services (PostgreSQL, API Gateway, Microservices):**
*(Lệnh này sẽ khởi động phần còn lại của hệ thống)*

```bash
docker compose up -d --build
```

### 5.3. Dựng Frontend Web Admin Dashboard

Xem chi tiết tại đây: [Hướng dẫn cài đặt Web Admin Dashboard](https://tannguyen1129.github.io/UMT.FreeFireFiles-webdashboard/)

### 5.4. Dựng Frontend Citizen

Xem chi tiết tại đây: [Hướng dẫn cài đặt Frontend Citizen](https://tannguyen1129.github.io/UMT.FreeFireFlies-frontend/)

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

Nếu bạn xóa Database hoặc deploy mới, hãy chạy các lệnh sau để tạo tài khoản và phân quyền chuẩn.

🛠️ Bấm để xem lệnh tạo tài khoản và phân quyền

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
```

Đổi role cho admin và goverment staff

```bash
INSERT INTO user_roles (user_id, role_id) SELECT u.user_id, r.role_id FROM users u, roles r WHERE u.email = 'admin@green.aqi' AND r.role_name = 'admin' ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role_id) SELECT u.user_id, r.role_id FROM users u, roles r WHERE u.email = 'gov@green.aqi' AND r.role_name = 'government_official' ON CONFLICT DO NOTHING;
DELETE FROM user_roles WHERE role_id = (SELECT role_id FROM roles WHERE role_name = 'citizen') AND user_id IN (SELECT user_id FROM users WHERE email IN ('admin@green.aqi', 'gov@green.aqi'));
```

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

## 📜 9. Giấy phép (License)

Dự án được phân phối dưới giấy phép **Apache 2.0 License**.
Vui lòng xem file [LICENSE](https://www.google.com/search?q=LICENSE) để biết thêm thông tin chi tiết về quyền hạn và nghĩa vụ.

-----

## 📂 10. Phụ lục

### Hướng dẫn lấy Firebase Admin SDK Key (Service Account)

Tài liệu này hướng dẫn cách lấy file `json` xác thực từ Google Firebase để Backend (Notification Service) có thể gửi thông báo.

#### Bước 1: Truy cập Firebase Console

1.  Truy cập vào [Firebase Console](https://console.firebase.google.com/).
2.  Chọn dự án **Green AQI** (hoặc dự án bạn đang làm việc).

#### Bước 2: Vào phần Cài đặt dự án (Project Settings)

1.  Nhìn sang menu bên trái, bấm vào biểu tượng **Bánh răng (Settings)** ⚙️ bên cạnh dòng chữ "Project Overview".
2.  Chọn **Project settings** (Cài đặt dự án).

#### Bước 3: Tạo khóa bí mật (Service Account)

1.  Trên thanh menu ngang phía trên, chọn tab **Service accounts** (Tài khoản dịch vụ).
2.  Ở phần **Firebase Admin SDK**, hãy chắc chắn rằng tùy chọn **Node.js** đang được chọn.
3.  Bấm vào nút màu xanh **Generate new private key** (Tạo khóa riêng tư mới).

4.  Một cửa sổ cảnh báo hiện ra, bấm **Generate key** để xác nhận.
5.  Một file có đuôi `.json` sẽ tự động được tải xuống máy tính của bạn.

#### Bước 4: Cấu hình vào dự án (Quan trọng)

Theo cấu hình `docker-compose.yml` hiện tại của dự án, bạn cần thực hiện đổi tên và di chuyển file này đúng chỗ:

**1. Đổi tên file:**
File vừa tải về thường có tên dài (ví dụ: `project-name-firebase-adminsdk-xyz.json`).
👉 Hãy đổi tên nó thành: **`firebase-admin-key.json`**

**2. Di chuyển vào thư mục dự án:**
Di chuyển file `firebase-admin-key.json` vào đường dẫn sau trong source code của bạn:

```text
apps/notification-service/firebase-admin-key.json
```
-----
Distributed under the Apache 2.0 License. Built with ❤️ by UMT.FreeFireFiles