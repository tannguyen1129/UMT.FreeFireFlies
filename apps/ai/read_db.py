#
# Copyright 2025 Green-AQI Navigator Team
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#


import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import pandas as pd

def main():
    print("Khởi chạy Tác vụ AI: Đọc CSDL...")

    # 1. Tải file .env (từ thư mục GỐC của dự án)
    # Đường dẫn tương đối từ 'apps/ai' đi lùi 2 cấp ra gốc
    env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
    load_dotenv(env_path)

    # 2. Đọc cấu hình CSDL từ .env
    db_user = os.getenv('DB_USER')
    db_pass = os.getenv('DB_PASS')
    db_host = os.getenv('DB_HOST')
    db_port = os.getenv('DB_PORT')
    db_name = os.getenv('DB_NAME')

    if not db_user or not db_pass:
        print("❌ Lỗi: Biến môi trường CSDL (DB_USER/DB_PASS) chưa được đặt trong file .env gốc.")
        return

    # 3. Tạo chuỗi kết nối và Engine
    db_url = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
    
    try:
        engine = create_engine(db_url)
        with engine.connect() as connection:
            print("✅ Kết nối PostgreSQL thành công!")
            
            # 4. Chạy truy vấn
            query = text("SELECT * FROM air_quality_observations ORDER BY time DESC LIMIT 5")
            result = connection.execute(query)
            
            # 5. Đọc dữ liệu bằng Pandas 
            df = pd.DataFrame(result.fetchall(), columns=result.keys())
            
            if df.empty:
                print("🟡 Bảng 'air_quality_observations' đang trống. (Agent OWM chưa chạy?)")
            else:
                print("✅ Đọc 5 dòng dữ liệu AQI mới nhất từ CSDL:")
                print(df)

    except Exception as e:
        print(f"❌ Lỗi khi kết nối hoặc truy vấn CSDL: {e}")

# Chạy hàm main
if __name__ == "__main__":
    main()