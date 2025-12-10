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
import joblib
import requests
import json
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from datetime import datetime, timedelta
from gnn_model import ST_GNN

# Cấu hình
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
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
NUM_NODES = len(HCMC_GRID)
SEQ_LENGTH = 4

def get_db_engine():
    # Load .env từ thư mục gốc (nếu có)
    env_path = os.path.join(BASE_DIR, '..', '..', '.env')
    load_dotenv(env_path)
    
    # 1. Xử lý DB URL
    db_host = os.getenv('DB_HOST') or 'postgres-db' # Fallback cho Docker
    db_user = os.getenv('DB_USER') or 'admin'
    db_pass = os.getenv('DB_PASS') or 'admin123'
    db_port = os.getenv('DB_PORT') or '5432'
    db_name = os.getenv('DB_NAME') or 'green_aqi_db'
    
    db_url = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
    print(f"🔌 Kết nối DB: {db_host}")

    # 2. Xử lý Orion URL (FIX LỖI NONE)
    orion_url = os.getenv('ORION_LD_URL')
    if not orion_url or orion_url == 'None':
        # Địa chỉ nội bộ của Orion trong mạng Docker thường là orion:1026
        print("⚠️ Không thấy biến ORION_LD_URL, dùng mặc định: http://orion:1026")
        orion_url = "http://orion:1026"
    else:
        print(f"🌍 Orion URL: {orion_url}")

    return create_engine(db_url), orion_url

def get_latest_network_data(engine):
    data_matrix = [] 
    latest_time = None

    for grid_point in HCMC_GRID:
        # Lấy dữ liệu mới nhất
        query = text(f"""
            SELECT time, pm2_5 
            FROM air_quality_observations 
            WHERE entity_id = 'urn:ngsi-ld:AirQualityStation:OWM-{grid_point['id']}' 
            ORDER BY time DESC 
            LIMIT {SEQ_LENGTH}
        """)
        with engine.connect() as conn:
            df = pd.read_sql(query, conn)
        
        if len(df) < SEQ_LENGTH:
            # Fill tạm để không crash (Dùng dòng cuối nhân bản)
            needed = SEQ_LENGTH - len(df)
            for _ in range(needed):
                val = df.iloc[-1]['pm2_5'] if len(df) > 0 else 30.0
                new_row = pd.DataFrame([{'time': datetime.now(), 'pm2_5': val}])
                df = pd.concat([df, new_row], ignore_index=True)
        
        # Đảo ngược để đúng thứ tự thời gian (Cũ -> Mới) cho LSTM/GNN
        values = df['pm2_5'].values[::-1]
        data_matrix.append(values)
        
        # Lấy thời gian của bản ghi mới nhất để làm mốc dự báo
        if len(df) > 0:
            current_node_time = pd.to_datetime(df['time'].iloc[0])
            if latest_time is None or current_node_time > latest_time:
                latest_time = current_node_time

    if latest_time is None:
        latest_time = datetime.now()

    return np.array(data_matrix)[..., np.newaxis], latest_time

def get_next_30min_slot():
    now = datetime.now()
    # Làm tròn lên mốc 30 phút tiếp theo
    # Ví dụ: 10:17 -> delta = 13p -> 10:30
    # Ví dụ: 10:35 -> delta = 25p -> 11:00
    delta = 30 - (now.minute % 30)
    if delta == 0: delta = 30 # Nếu đúng 10:30 thì dự báo cho 11:00
    
    target_time = now + timedelta(minutes=delta)
    # Reset giây về 0 cho đẹp
    target_time = target_time.replace(second=0, microsecond=0)
    return target_time

def sync_to_orion(orion_url, grid_point, value, last_db_time):
    # 1. Entity DỰ BÁO (Forecast)
    forecast_id = f"urn:ngsi-ld:AirQualityForecast:OWM-{grid_point['id']}"
    # 2. Entity QUAN TRẮC (Observed) - Để Route Planner dùng cái này vẽ đường
    observed_id = f"urn:ngsi-ld:AirQualityStation:OWM-{grid_point['id']}"
    
    forecast_time = get_next_30min_slot()
    
    # Payload chung
    common_data = {
        "pm25": { "type": "Property", "value": round(float(value), 2), "unitCode": "µg/m³" },
        "aqi": { "type": "Property", "value": int(value * 2.5) }, # Fake AQI tương đối
        "location": { "type": "GeoProperty", "value": { "type": "Point", "coordinates": [grid_point['lon'], grid_point['lat']] } },
        "@context": ["https://smartdatamodels.org/context.jsonld"]
    }

    # --- A. CẬP NHẬT FORECAST (Cho Popup Dự báo) ---
    payload_forecast = {
        "id": forecast_id,
        "type": "AirQualityForecast",
        "location": common_data["location"],
        "validFrom": { "type": "Property", "value": { "@type": "DateTime", "@value": forecast_time.isoformat() } },
        "forecastedPM25": { "type": "Property", "value": common_data["pm25"]["value"], "unitCode": "µg/m³" },
        "observationDateTime": { "type": "Property", "value": { "@type": "DateTime", "@value": last_db_time.isoformat() } }, 
        "@context": common_data["@context"]
    }
    
    # --- B. CẬP NHẬT OBSERVED (Cho Vẽ đường & Heatmap) ---
    # Hack: Ghi đè dữ liệu quan trắc bằng dữ liệu AI để App hiển thị đồng bộ
    payload_observed = {
        "id": observed_id,
        "type": "AirQualityObserved",
        "location": common_data["location"],
        "dateObserved": { "type": "Property", "value": { "@type": "DateTime", "@value": datetime.now().isoformat() } },
        "pm25": common_data["pm25"],
        "aqi": common_data["aqi"],
        "@context": common_data["@context"]
    }
    
    headers = { 'Content-Type': 'application/ld+json' }
    
    # Hàm gửi request
    def send_request(payload, entity_id):
        try:
            # Thử Patch trước
            patch_url = f"{orion_url}/ngsi-ld/v1/entities/{entity_id}/attrs"
            resp = requests.post(patch_url, headers=headers, data=json.dumps({k:v for k,v in payload.items() if k not in ['id', 'type']}))
            
            if resp.status_code not in [204, 200]:
                # Nếu Patch lỗi (do chưa có), thì POST tạo mới
                requests.post(f"{orion_url}/ngsi-ld/v1/entities", headers=headers, data=json.dumps(payload))
        except Exception as e:
            print(f"⚠️ Lỗi Sync {entity_id}: {e}")

    send_request(payload_forecast, forecast_id)
    send_request(payload_observed, observed_id)
    
    print(f"✅ [GNN] Đồng bộ {grid_point['id']} -> {payload_forecast['forecastedPM25']['value']}")

# ... (Hàm main giữ nguyên logic load model) ...
def main():
    engine, orion_url = get_db_engine()
    print(f"\n--- BẮT ĐẦU DỰ BÁO (Next 30m Slot) ---")

    try:
        # Load Model
        model = ST_GNN(num_nodes=NUM_NODES, input_dim=1, hidden_dim=16, output_dim=1)
        model.load_state_dict(torch.load(os.path.join(BASE_DIR, 'gnn_model.pth')))
        model.eval()
        
        scaler = joblib.load(os.path.join(BASE_DIR, 'gnn_scaler.joblib'))
        edge_index, edge_weight = torch.load(os.path.join(BASE_DIR, 'graph_structure.pt'))

        # Lấy dữ liệu
        raw_data, last_time = get_latest_network_data(engine)
        
        # Chuẩn hóa
        input_2d = raw_data.squeeze().T 
        input_scaled = scaler.transform(input_2d)
        input_tensor = torch.tensor(input_scaled.T[..., np.newaxis], dtype=torch.float)

        # Predict
        with torch.no_grad():
            out = model(input_tensor, edge_index, edge_weight)
            
        # Inverse Scale
        pred_dummy = np.zeros((1, NUM_NODES))
        pred_dummy[0] = out.squeeze().numpy()
        pred_actual = scaler.inverse_transform(pred_dummy)[0]

        # Sync
        print(f"🕒 Dữ liệu đầu vào: {last_time}")
        for i, val in enumerate(pred_actual):
            val = max(0.0, val) 
            sync_to_orion(orion_url, HCMC_GRID[i], val, last_time)

    except Exception as e:
        print(f"❌ Lỗi dự báo: {e}")

if __name__ == "__main__":
    main()