import os
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import joblib
import requests
import json
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from datetime import datetime, timedelta

# 🚀 CẤU HÌNH ĐƯỜNG DẪN TUYỆT ĐỐI
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Danh sách 9 trạm
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

# ---------------------------------------------------------
# 1. ĐỊNH NGHĨA LẠI MÔ HÌNH LSTM (PHẢI KHỚP 100% VỚI TRAIN)
# ---------------------------------------------------------
class AirQualityLSTM(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers, output_size=1):
        super(AirQualityLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        # Khởi tạo hidden state (h0) và cell state (c0)
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        
        out, _ = self.lstm(x, (h0, c0))
        out = self.fc(out[:, -1, :])
        return out

# ---------------------------------------------------------
# 2. HÀM HỖ TRỢ
# ---------------------------------------------------------
def get_db_engine():
    env_path = os.path.join(BASE_DIR, '..', '..', '.env')
    load_dotenv(env_path)
    db_url = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASS')}@" \
             f"{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    return create_engine(db_url), os.getenv('ORION_LD_URL')

def format_forecast_to_ngsi_ld(forecast_value, forecast_time, grid_point):
    entity_id = f"urn:ngsi-ld:AirQualityForecast:OWM-{grid_point['id']}"
    return {
        "id": entity_id,
        "type": "AirQualityForecast",
        "location": { "type": "GeoProperty", "value": { "type": "Point", "coordinates": [grid_point['lon'], grid_point['lat']] } },
        "validFrom": { "type": "Property", "value": { "@type": "DateTime", "@value": forecast_time.isoformat() } },
        "validTo": { "type": "Property", "value": { "@type": "DateTime", "@value": (forecast_time + timedelta(minutes=15)).isoformat() } },
        "forecastedPM25": { "type": "Property", "value": round(forecast_value, 2), "unitCode": "µg/m³" },
        "@context": ["https://smartdatamodels.org/context.jsonld"]
    }

def sync_forecast_to_orion(orion_url, payload):
    headers = { 'Content-Type': 'application/ld+json' }
    try:
        requests.post(orion_url, headers=headers, data=json.dumps(payload)).raise_for_status()
        print(f"✅ Đã TẠO MỚI (POST): {payload['id']}")
    except requests.exceptions.HTTPError as e:
        if e.response.status_code in [409, 422]:
            try:
                patch_payload = { k: v for k, v in payload.items() if k not in ['id', 'type', '@context'] }
                requests.patch(f"{orion_url}/{payload['id']}/attrs", headers={ 'Content-Type': 'application/json' }, data=json.dumps(patch_payload)).raise_for_status()
                print(f"✅ Đã CẬP NHẬT (PATCH): {payload['id']}")
            except Exception as pe: print(f"❌ Lỗi PATCH {payload['id']}: {pe}")
        else: print(f"❌ Lỗi POST {payload['id']}: {e}")

# ---------------------------------------------------------
# 3. MAIN
# ---------------------------------------------------------
def main():
    engine, orion_url = get_db_engine()
    print(f"\n--- BẮT ĐẦU DỰ BÁO (LSTM - PyTorch) lúc {datetime.now()} ---")

    for grid_point in HCMC_GRID:
        grid_id = grid_point['id']
        
        # Đường dẫn file mô hình (.pth) và scaler (.joblib)
        model_path = os.path.join(BASE_DIR, f'lstm_model_{grid_id}.pth')
        scaler_path = os.path.join(BASE_DIR, f'scaler_{grid_id}.joblib')

        if not os.path.exists(model_path):
            print(f"⏩ Bỏ qua {grid_id}: Chưa có file .pth (Cần chạy train_model.py).")
            continue

        try:
            # 1. Lấy dữ liệu 4 mốc thời gian gần nhất (T-45, T-30, T-15, T)
            station_entity_id = f"urn:ngsi-ld:AirQualityStation:OWM-{grid_id}"
            query = text(f"""
                SELECT time, pm2_5 
                FROM air_quality_observations 
                WHERE entity_id = :id 
                ORDER BY time DESC 
                LIMIT 4
            """)
            with engine.connect() as conn:
                df = pd.read_sql(query, conn, params={'id': station_entity_id})

            if len(df) < 4:
                print(f"⚠️ {grid_id}: Không đủ dữ liệu lịch sử (Cần 4, có {len(df)})")
                continue
            
            # Thời gian dự báo = Mốc mới nhất + 15 phút
            last_time = pd.to_datetime(df['time'].iloc[0])
            forecast_time = last_time + timedelta(minutes=15)

            # 2. Chuẩn bị Input cho LSTM
            # Đảo ngược lại để đúng thứ tự thời gian: [Cũ -> Mới]
            input_raw = df['pm2_5'].values[::-1].reshape(-1, 1)
            
            # Load Scaler và chuẩn hóa
            scaler = joblib.load(scaler_path)
            input_scaled = scaler.transform(input_raw)
            
            # Chuyển sang Tensor 3D: [Batch=1, Seq=4, Feature=1]
            X_input = torch.from_numpy(input_scaled).float().unsqueeze(0)

            # 3. Load Model và Dự báo
            # Tham số phải khớp với lúc train: input_size=1, hidden=32, layers=2
            model = AirQualityLSTM(input_size=1, hidden_size=32, num_layers=2)
            model.load_state_dict(torch.load(model_path))
            model.eval() # Chế độ dự báo (không dropout/batchnorm)

            with torch.no_grad():
                pred_scaled = model(X_input)
                # Giải mã về giá trị thực
                pred_value = scaler.inverse_transform(pred_scaled.numpy())[0][0]

            # Kẹp giá trị (Không âm)
            forecast_value = max(0.0, float(pred_value))

            print(f"📊 {grid_id} (LSTM): {forecast_value:.2f} µg/m³ (Lúc {forecast_time.strftime('%H:%M')})")

            # 4. Đẩy lên Orion-LD
            ngsi_ld_payload = format_forecast_to_ngsi_ld(forecast_value, forecast_time, grid_point)
            sync_forecast_to_orion(orion_url, ngsi_ld_payload)

        except Exception as e:
            print(f"❌ Lỗi tại {grid_id}: {e}")

    print("--- HOÀN TẤT DỰ BÁO LSTM ---\n")

if __name__ == "__main__":
    main()