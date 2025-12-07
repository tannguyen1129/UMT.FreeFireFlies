# apps/ai/Dockerfile
FROM python:3.9-slim

WORKDIR /app

# Cài đặt thư viện hệ thống cần thiết cho psycopg2
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# Copy requirements và cài đặt
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ code
COPY . .

# --- QUAN TRỌNG: Đổi lệnh CMD ---
# Chạy file worker thay vì chạy predict lẻ
CMD ["python", "-u", "main_worker.py"]