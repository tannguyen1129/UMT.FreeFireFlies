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

import schedule
import time
import subprocess
import datetime
import os
import sys

# Lấy đường dẫn tuyệt đối của thư mục hiện tại (/app)
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

# Cấu hình log: Ép flush ngay lập tức để thấy log trong Docker
def log(message):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [Worker-PID:{os.getpid()}] {message}", flush=True)

def run_script(script_name):
    script_path = os.path.join(CURRENT_DIR, script_name)
    
    # Kiểm tra file có tồn tại không
    if not os.path.exists(script_path):
        log(f"❌ KHẨN CẤP: Không tìm thấy file {script_name} tại {script_path}")
        return

    log(f"▶️ Đang thực thi: {script_name} ...")
    start_time = time.time()
    
    try:
        # Sử dụng sys.executable để đảm bảo dùng đúng Python của môi trường hiện tại
        result = subprocess.run(
            [sys.executable, "-u", script_path], 
            check=True,
            cwd=CURRENT_DIR 
        )
        duration = round(time.time() - start_time, 2)
        log(f"✅ Hoàn tất {script_name} trong {duration}s.")
        
    except subprocess.CalledProcessError as e:
        log(f"❌ Lỗi khi chạy {script_name} (Exit Code: {e.returncode})")
    except Exception as e:
        log(f"❌ Lỗi không xác định khi gọi {script_name}: {e}")

def job_predict():
    log("🚀 [SCHEDULE] Kích hoạt Job Dự báo GNN (Theo mốc giờ cố định)...")
    run_script("predict_gnn.py")

def job_train():
    log("🏋️‍♀️ [SCHEDULE] Kích hoạt Job Train GNN (Chu kỳ hàng ngày)...")
    run_script("train_gnn.py")
    # Train xong thì dự báo lại ngay để cập nhật model mới
    log("🔄 Train xong -> Chạy dự báo ngay lập tức...")
    run_script("predict_gnn.py")

# --- CẤU HÌNH LỊCH TRÌNH ---

# 1. Chạy Predict chính xác vào các phút 00, 15, 30, 45 của mỗi giờ
# Cách này đảm bảo đồng bộ với các mốc giờ đẹp (VD: 11:15, 11:30)
schedule.every().hour.at(":00").do(job_predict)
schedule.every().hour.at(":15").do(job_predict)
schedule.every().hour.at(":30").do(job_predict)
schedule.every().hour.at(":45").do(job_predict)

# 2. Chạy Train mỗi ngày 1 lần vào lúc 02:00 sáng
schedule.every().day.at("02:00").do(job_train)

# --- KHỞI CHẠY ---

if __name__ == "__main__":
    log("--- 🤖 AI WORKER KHỞI ĐỘNG (FIXED TIME SLOTS) ---")
    log(f"📂 Thư mục làm việc: {CURRENT_DIR}")
    
    # Kiểm tra các file quan trọng
    files = os.listdir(CURRENT_DIR)
    if "predict_gnn.py" in files and "train_gnn.py" in files:
        log("✅ Đã tìm thấy đầy đủ script predict và train.")
    else:
        log(f"⚠️ Cảnh báo: File trong thư mục: {files}")

    # Chạy Train nhẹ 1 lần khi khởi động để đảm bảo có model (nếu chưa có)
    if not os.path.exists(os.path.join(CURRENT_DIR, "gnn_model.pth")):
        log("⚠️ Chưa thấy model GNN, chạy Train lần đầu...")
        job_train()
    else:
        # Nếu có model rồi thì chạy Predict luôn cho nóng
        log("🔥 Kích hoạt Predict ngay lập tức khi khởi động...")
        job_predict()
    
    log("⏳ Đang chờ đến mốc thời gian tiếp theo (:00, :15, :30, :45)...")
    
    # Vòng lặp chính
    while True:
        try:
            schedule.run_pending()
            time.sleep(1)
        except KeyboardInterrupt:
            log("🛑 Worker đang dừng...")
            break
        except Exception as e:
            log(f"❌ Lỗi trong vòng lặp chính: {e}")
            time.sleep(5)