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
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import joblib
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from sklearn.preprocessing import MinMaxScaler
from gnn_model import ST_GNN  

# Cấu hình
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Đủ 9 trạm như yêu cầu
HCMC_GRID = [
  { 'id': 'ThuDuc', 'lat': 10.8231, 'lon': 106.7711 },
  { 'id': 'District12', 'lat': 10.8672, 'lon': 106.6415 },
  { 'id': 'HocMon', 'lat': 10.8763, 'lon': 106.5941 },
  { 'id': 'District1', 'lat': 10.7769, 'lon': 106.7009 },
  { 'id': 'BinhTan', 'lat': 10.7656, 'lon': 106.6031 },
  { 'id': 'District2', 'lat': 10.7877, 'lon': 106.7407 },
  { 'id': 'District7', 'lat': 10.734, 'lon': 106.7206 },
  { 'id': 'BinhChanh', 'lat': 10.718, 'lon': 106.6067 },
  { 'id': 'CanGio', 'lat': 10.518, 'lon': 106.8776 },
]
NUM_NODES = len(HCMC_GRID) # = 9
SEQ_LENGTH = 4  
EPOCHS = 100     # Tăng epoch lên để học kỹ hơn với dữ liệu ít
LEARNING_RATE = 0.005 # Giảm learning rate để hội tụ ổn định

def get_db_engine():
    env_path = os.path.join(BASE_DIR, '..', '..', '.env')
    load_dotenv(env_path)
    
    db_host = os.getenv('DB_HOST') or 'postgres-db'
    db_user = os.getenv('DB_USER') or 'admin'
    db_pass = os.getenv('DB_PASS') or 'admin123'
    db_port = os.getenv('DB_PORT') or '5432'
    db_name = os.getenv('DB_NAME') or 'green_aqi_db'
    
    db_url = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
    return create_engine(db_url)

def load_data_from_db(engine):
    print("📥 Đang tải dữ liệu từ Database...")
    dfs = []
    for point in HCMC_GRID:
        entity_id = f"urn:ngsi-ld:AirQualityStation:OWM-{point['id']}"
        query = text(f"""
            SELECT time, pm2_5 
            FROM air_quality_observations 
            WHERE entity_id = '{entity_id}'
            ORDER BY time ASC
        """)
        with engine.connect() as conn:
            df = pd.read_sql(query, conn)
            
            # Nếu trạm nào chưa có dữ liệu thì bỏ qua (hoặc xử lý fill sau)
            if df.empty:
                print(f"⚠️ Cảnh báo: Trạm {point['id']} chưa có dữ liệu!")
                return None

            df = df.rename(columns={'pm2_5': point['id']})
            df = df.set_index('time')
            # Fix Warning: Dùng '1h' thay vì '1H'
            df = df.resample('1h').mean().interpolate(method='linear') 
            dfs.append(df)
    
    if not dfs: return None

    # Gộp tất cả lại thành 1 bảng lớn
    dataset = pd.concat(dfs, axis=1).dropna()
    print(f"📊 Dữ liệu sạch để train: {dataset.shape} (Thời gian x 9 Trạm)")
    return dataset.values

def create_sequences(data, seq_length):
    # data shape: (Time_Steps, Num_Nodes) -> (381, 9)
    xs, ys = [], []
    for i in range(len(data) - seq_length):
        x = data[i:(i + seq_length)]      # Input: 4 giờ liên tiếp
        y = data[i + seq_length]          # Target: Giờ thứ 5
        xs.append(x)
        ys.append(y)
    return np.array(xs), np.array(ys)

def train():
    engine = get_db_engine()
    
    # 1. Load Data
    raw_data = load_data_from_db(engine)
    if raw_data is None or len(raw_data) < SEQ_LENGTH + 2:
        print("❌ Dữ liệu quá ít để train! Hãy đợi Crawler chạy thêm.")
        return

    # 2. Scale Data
    scaler = MinMaxScaler()
    data_scaled = scaler.fit_transform(raw_data)
    
    joblib.dump(scaler, os.path.join(BASE_DIR, 'gnn_scaler.joblib'))
    print("💾 Đã lưu Scaler.")

    # 3. Tạo Sequence
    # X shape ban đầu: (Samples, Seq_Len, Nodes) = (N, 4, 9)
    X, y = create_sequences(data_scaled, SEQ_LENGTH)
    
    # 🛑 FIX QUAN TRỌNG: Đổi trục để khớp với Model
    # Model GNN yêu cầu: (Nodes, Seq_Len, Features) = (9, 4, 1) cho mỗi lần chạy
    # Ta chuyển X thành: (Samples, Nodes, Seq_Len) = (N, 9, 4)
    X = np.transpose(X, (0, 2, 1)) 
    
    # Thêm trục Features cuối cùng -> (Samples, Nodes, Seq_Len, 1) = (N, 9, 4, 1)
    X = X[..., np.newaxis]         
    
    # Chuyển sang Tensor
    X_tensor = torch.tensor(X, dtype=torch.float32)
    y_tensor = torch.tensor(y, dtype=torch.float32)
    
    # Load cấu trúc đồ thị
    try:
        edge_index, edge_weight = torch.load(os.path.join(BASE_DIR, 'graph_structure.pt'))
    except:
        print("⚠️ Không tìm thấy graph_structure.pt, vui lòng chạy script tạo graph trước!")
        return

    # 4. Khởi tạo Model
    model = ST_GNN(num_nodes=NUM_NODES, input_dim=1, hidden_dim=16, output_dim=1)
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

    print(f"🏋️‍♀️ Bắt đầu Train ({EPOCHS} epochs) trên {len(X_tensor)} mẫu dữ liệu...")
    model.train()
    
    # 🛑 VÒNG LẶP TRAIN (Sửa lỗi 4D Input)
    for epoch in range(EPOCHS):
        total_loss = 0
        
        # Duyệt qua từng mẫu thời gian (Stochastic Gradient Descent)
        for i in range(len(X_tensor)):
            # Lấy 1 mẫu ra: X_tensor[i] có shape (9, 4, 1) -> ĐÚNG CHUẨN 3D
            x_sample = X_tensor[i] 
            y_sample = y_tensor[i] # (9,)
            
            optimizer.zero_grad()
            
            # Forward pass
            output = model(x_sample, edge_index, edge_weight)
            
            # Tính loss: output shape (9, 1) vs y_sample (9,)
            loss = criterion(output.squeeze(), y_sample)
            
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
        
        # In log mỗi 10 epoch
        if (epoch+1) % 10 == 0:
            avg_loss = total_loss / len(X_tensor)
            print(f"   Epoch {epoch+1}/{EPOCHS}, Avg Loss: {avg_loss:.6f}")

    # 5. Lưu Model
    torch.save(model.state_dict(), os.path.join(BASE_DIR, 'gnn_model.pth'))
    print("✅ Train hoàn tất! Đã lưu model mới vào gnn_model.pth")

if __name__ == "__main__":
    train()