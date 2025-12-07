import schedule
import time
import subprocess
import datetime
import os

# Cấu hình log đơn giản
def log(message):
    print(f"[{datetime.datetime.now()}] {message}")

def run_predict_job():
    log("🚀 Bắt đầu chạy Predict...")
    try:
        # Gọi script predict.py
        result = subprocess.run(["python", "predict.py"], check=True, capture_output=True, text=True)
        log("✅ Predict hoàn tất.")
        # In ra output của script con nếu cần debug
        # print(result.stdout) 
    except subprocess.CalledProcessError as e:
        log(f"❌ Lỗi khi chạy Predict: {e}")
        log(e.stderr)

def run_train_job():
    log("🏋️‍♀️ Bắt đầu chạy Train GNN (Lịch 2 ngày/lần)...")
    try:
        # Gọi script train_gnn.py
        subprocess.run(["python", "train_gnn.py"], check=True)
        log("✅ Train GNN hoàn tất. Model mới đã được lưu.")
    except subprocess.CalledProcessError as e:
        log(f"❌ Lỗi khi chạy Train: {e}")

# --- CẤU HÌNH LỊCH TRÌNH ---

# 1. Chạy Predict liên tục (ví dụ: mỗi 10 phút hoặc 1 tiếng một lần)
# Tùy nhu cầu thực tế của bạn muốn cập nhật AQI bao lâu 1 lần
schedule.every(15).minutes.do(run_predict_job)
# Hoặc nếu muốn nhanh hơn: schedule.every(10).minutes.do(run_predict_job)

# 2. Chạy Train lại mỗi 2 ngày
schedule.every(2).days.at("02:00").do(run_train_job) # Chạy lúc 2h sáng cho đỡ lag server

# --- KHỞI ĐỘNG ---
if __name__ == "__main__":
    log("🤖 AI Worker đã khởi động...")
    
    # Chạy predict ngay lập tức khi container bật lên (không cần đợi 1 tiếng)
    run_predict_job()

    # Vòng lặp vô tận để giữ container sống và check lịch
    while True:
        schedule.run_pending()
        time.sleep(60) # Ngủ 60s để tiết kiệm CPU