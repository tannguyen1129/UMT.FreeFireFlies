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
import joblib
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sklearn.preprocessing import MinMaxScaler

# Cấu hình
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HCMC_GRID_IDS = [
    'ThuDuc', 'District12', 'HocMon', 'District1', 'BinhTan',
    'District2', 'District7', 'BinhChanh', 'CanGio'
]
SEQ_LENGTH = 4 # Dùng 4 mốc quá khứ (1 giờ) để dự báo
HIDDEN_SIZE = 32
NUM_LAYERS = 2

# ---------------------------------------------------------
# 1. ĐỊNH NGHĨA MÔ HÌNH LSTM (PyTorch)
# ---------------------------------------------------------
class AirQualityLSTM(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers, output_size=1):
        super(AirQualityLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        
        # Layer LSTM
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        
        # Layer Fully Connected (đầu ra)
        self.fc = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        # Khởi tạo hidden state và cell state
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        
        # Forward pass
        out, _ = self.lstm(x, (h0, c0))
        
        # Lấy output ở bước thời gian cuối cùng
        out = self.fc(out[:, -1, :])
        return out

# ---------------------------------------------------------
# 2. HÀM XỬ LÝ DỮ LIỆU
# ---------------------------------------------------------
def get_db_engine():
    env_path = os.path.join(BASE_DIR, '..', '..', '.env')
    load_dotenv(env_path)
    db_url = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASS')}@" \
             f"{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    return create_engine(db_url)

def load_raw_data(engine, grid_id):
    """Tải dữ liệu thô, chưa tạo lag features"""
    print(f"\n--- Tải dữ liệu cho: {grid_id} ---")
    aqi_id = f"urn:ngsi-ld:AirQualityStation:OWM-{grid_id}"
    
    # Lấy AQI
    query_aqi = text("SELECT time, pm2_5 FROM air_quality_observations WHERE entity_id = :id ORDER BY time")
    with engine.connect() as conn:
        df = pd.read_sql(query_aqi, conn, params={'id': aqi_id})
    
    if df.empty: return None
    
    df['time'] = pd.to_datetime(df['time'])
    df.set_index('time', inplace=True)
    df = df.resample('15min').mean().interpolate(method='linear')
    
    # Lấy thêm Weather/Road (Ở đây ta demo với PM2.5 trước cho đơn giản, sau này thêm feature vào)
    # Để LSTM chạy ổn định, ta tạm thời chỉ dùng chuỗi PM2.5 univariate (đơn biến)
    # Sau này khi quen PyTorch, ta sẽ nối thêm cột Weather vào.
    
    return df

def create_sequences(data, seq_length):
    """Chuyển dữ liệu bảng thành chuỗi (Sliding Window)"""
    xs, ys = [], []
    for i in range(len(data) - seq_length):
        x = data[i:(i + seq_length)]
        y = data[i + seq_length]
        xs.append(x)
        ys.append(y)
    return np.array(xs), np.array(ys)

# ---------------------------------------------------------
# 3. MAIN TRAINING LOOP
# ---------------------------------------------------------
def main():
    engine = get_db_engine()
    
    for grid_id in HCMC_GRID_IDS:
        df = load_raw_data(engine, grid_id)
        if df is None or len(df) < 20:
            print(f"❌ {grid_id}: Không đủ dữ liệu.")
            continue

        # Chuẩn hóa dữ liệu (Bắt buộc cho LSTM)
        scaler = MinMaxScaler(feature_range=(0, 1))
        data_scaled = scaler.fit_transform(df[['pm2_5']].values)

        # Tạo Sequence
        X, y = create_sequences(data_scaled, SEQ_LENGTH)
        
        if len(X) < 5: continue

        # Chuyển sang Tensor
        X_train = torch.from_numpy(X).float()
        y_train = torch.from_numpy(y).float()

        # Khởi tạo mô hình
        model = AirQualityLSTM(input_size=1, hidden_size=HIDDEN_SIZE, num_layers=NUM_LAYERS)
        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

        # Huấn luyện
        print(f"🚀 Đang train LSTM cho {grid_id}...")
        model.train()
        for epoch in range(100): # Chạy 100 vòng
            optimizer.zero_grad()
            outputs = model(X_train)
            loss = criterion(outputs, y_train)
            loss.backward()
            optimizer.step()
            
            if (epoch+1) % 20 == 0:
                print(f"   Epoch {epoch+1}/100, Loss: {loss.item():.4f}")

        # Lưu mô hình (PyTorch save state_dict)
        model_path = os.path.join(BASE_DIR, f'lstm_model_{grid_id}.pth')
        scaler_path = os.path.join(BASE_DIR, f'scaler_{grid_id}.joblib')
        
        torch.save(model.state_dict(), model_path)
        joblib.dump(scaler, scaler_path) # Lưu scaler để lúc dự báo còn giải mã ngược lại
        
        print(f"✅ Đã lưu model LSTM: {model_path}")

if __name__ == "__main__":
    main()