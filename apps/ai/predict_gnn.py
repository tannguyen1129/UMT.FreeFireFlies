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
    env_path = os.path.join(BASE_DIR, '..', '..', '.env')
    load_dotenv(env_path)
    db_url = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASS')}@" \
             f"{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    return create_engine(db_url), os.getenv('ORION_LD_URL')

def get_latest_network_data(engine):
    data_matrix = [] 
    latest_time = None

    for grid_point in HCMC_GRID:
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
            raise ValueError(f"Trạm {grid_point['id']} không đủ dữ liệu")
        
        values = df['pm2_5'].values[::-1]
        data_matrix.append(values)
        
        if latest_time is None:
            latest_time = df['time'].iloc[0]

    return np.array(data_matrix)[..., np.newaxis], pd.to_datetime(latest_time)

def sync_to_orion(orion_url, grid_point, value, time):
    entity_id = f"urn:ngsi-ld:AirQualityForecast:OWM-{grid_point['id']}"
    forecast_time = time + timedelta(minutes=15)
    
    payload = {
        "id": entity_id,
        "type": "AirQualityForecast",
        "location": { "type": "GeoProperty", "value": { "type": "Point", "coordinates": [grid_point['lon'], grid_point['lat']] } },
        "validFrom": { "type": "Property", "value": { "@type": "DateTime", "@value": forecast_time.isoformat() } },
        "forecastedPM25": { "type": "Property", "value": round(float(value), 2), "unitCode": "µg/m³" },
        "@context": ["https://smartdatamodels.org/context.jsonld"]
    }
    
    headers = { 'Content-Type': 'application/ld+json' }
    
    try:
        # 🚀 FIX QUAN TRỌNG: Thêm .raise_for_status() để bắt lỗi 422/409
        resp = requests.post(orion_url, headers=headers, data=json.dumps(payload))
        resp.raise_for_status() 
        print(f"✅ [GNN] Tạo mới (POST): {grid_point['id']} -> {payload['forecastedPM25']['value']}")
        
    except Exception:
        # Nếu POST lỗi (do đã tồn tại), chuyển sang PATCH
        try:
            patch_payload = { 
                "forecastedPM25": payload["forecastedPM25"], 
                "validFrom": payload["validFrom"] 
            }
            # PATCH endpoint: /entities/{id}/attrs
            patch_url = f"{orion_url}/{entity_id}/attrs"
            patch_headers = {'Content-Type': 'application/json'}
            
            resp_patch = requests.patch(patch_url, headers=patch_headers, data=json.dumps(patch_payload))
            resp_patch.raise_for_status()
            
            print(f"🔄 [GNN] Cập nhật (PATCH): {grid_point['id']} -> {payload['forecastedPM25']['value']}")
        except Exception as e:
            print(f"❌ Lỗi Sync {grid_point['id']}: {e}")

def main():
    engine, orion_url = get_db_engine()
    print(f"\n--- BẮT ĐẦU DỰ BÁO GNN (Fixed Sync) ---")

    try:
        model = ST_GNN(num_nodes=NUM_NODES, input_dim=1, hidden_dim=16, output_dim=1)
        model.load_state_dict(torch.load(os.path.join(BASE_DIR, 'gnn_model.pth')))
        model.eval()
        
        scaler = joblib.load(os.path.join(BASE_DIR, 'gnn_scaler.joblib'))
        edge_index, edge_weight = torch.load(os.path.join(BASE_DIR, 'graph_structure.pt'))

        raw_data, last_time = get_latest_network_data(engine)
        
        input_2d = raw_data.squeeze().T 
        input_scaled = scaler.transform(input_2d)
        input_tensor = torch.tensor(input_scaled.T[..., np.newaxis], dtype=torch.float)

        with torch.no_grad():
            out = model(input_tensor, edge_index, edge_weight)
            
        pred_dummy = np.zeros((1, NUM_NODES))
        pred_dummy[0] = out.squeeze().numpy()
        pred_actual = scaler.inverse_transform(pred_dummy)[0]

        for i, val in enumerate(pred_actual):
            val = max(0.0, val)
            sync_to_orion(orion_url, HCMC_GRID[i], val, last_time)

    except Exception as e:
        print(f"❌ Lỗi dự báo GNN: {e}")

if __name__ == "__main__":
    main()