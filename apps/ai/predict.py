import os
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import joblib       
import requests     
import json
from datetime import datetime, timedelta
import numpy as np

# 🚀 1. ĐỊNH NGHĨA LƯỚI 9 ĐIỂM (Cần tọa độ để tạo entity NGSI-LD)
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

def get_db_engine():
    """Kết nối CSDL."""
    env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
    load_dotenv(env_path)
    db_url = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASS')}@" \
             f"{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    return create_engine(db_url), os.getenv('ORION_LD_URL')

def get_model_inputs(engine, grid_id):
    """
    Lấy dữ liệu đầu vào (Input Features) cho mô hình từ CSDL.
    Cần: 4 mốc AQI quá khứ + Thời tiết mới nhất + Giao thông.
    """
    station_aqi_id = f"urn:ngsi-ld:AirQualityStation:OWM-{grid_id}"
    station_weather_id = f"urn:ngsi-ld:WeatherObservation:OWM-{grid_id}"

    # 1. Lấy 4 mốc AQI mới nhất
    # (Lấy giảm dần theo thời gian: dòng 0 là mới nhất, dòng 3 là cũ nhất)
    query_aqi = text("""
        SELECT time, pm2_5 
        FROM air_quality_observations 
        WHERE entity_id = :id 
        ORDER BY time DESC 
        LIMIT 4
    """)
    
    # 2. Lấy Thời tiết mới nhất
    query_weather = text("""
        SELECT temperature, relative_humidity, wind_speed 
        FROM weather_observations 
        WHERE entity_id = :id 
        ORDER BY time DESC 
        LIMIT 1
    """)

    # 3. Lấy Road Count
    query_road = text("SELECT major_road_count FROM road_features WHERE entity_id = :id")

    with engine.connect() as conn:
        df_aqi = pd.read_sql(query_aqi, conn, params={'id': station_aqi_id})
        df_weather = pd.read_sql(query_weather, conn, params={'id': station_weather_id})
        road_result = conn.execute(query_road, {'id': station_aqi_id}).fetchone()

    # --- KIỂM TRA DỮ LIỆU ---
    if len(df_aqi) < 4:
        raise ValueError(f"Không đủ dữ liệu lịch sử AQI (Cần 4, có {len(df_aqi)})")

    # Chuẩn bị Lag Features (Dòng 0 là T, Dòng 1 là T-15m...)
    # Train model dùng: [T-15m, T-30m, T-45m, T-60m] để dự đoán T.
    # Predict model dùng: [T, T-15m, T-30m, T-45m] để dự đoán T+15m.
    pm25_lags = df_aqi['pm2_5'].values # [pm25_t, pm25_t-1, pm25_t-2, pm25_t-3]

    # Chuẩn bị Weather Features
    if not df_weather.empty:
        temp = df_weather.iloc[0]['temperature']
        humid = df_weather.iloc[0]['relative_humidity']
        wind = df_weather.iloc[0]['wind_speed']
    else:
        # Giá trị mặc định nếu chưa có weather
        temp, humid, wind = 30.0, 70.0, 2.0

    # Chuẩn bị Road Feature
    road_count = road_result[0] if road_result else 0

    # Thời gian dự báo = Thời gian đo mới nhất + 15 phút
    last_time = pd.to_datetime(df_aqi['time'].iloc[0]) # iloc[0] là mới nhất do ORDER BY DESC
    forecast_time = last_time + timedelta(minutes=15)

    # --- TẠO DATAFRAME ĐẦU VÀO ---
    # Thứ tự cột PHẢI khớp với lúc train
    features = {
        'pm25_lag_15m': [pm25_lags[0]],
        'pm25_lag_30m': [pm25_lags[1]],
        'pm25_lag_45m': [pm25_lags[2]],
        'pm25_lag_60m': [pm25_lags[3]],
        'temperature': [temp],
        'relative_humidity': [humid],
        'wind_speed': [wind],
        'road_count': [road_count]
    }
    
    return pd.DataFrame(features), forecast_time

def format_forecast_to_ngsi_ld(forecast_value, forecast_time, grid_point):
    """Đóng gói JSON-LD."""
    # ID Entity Dự báo (Ví dụ: ...Forecast:OWM-ThuDuc)
    entity_id = f"urn:ngsi-ld:AirQualityForecast:OWM-{grid_point['id']}"
    
    return {
        "id": entity_id,
        "type": "AirQualityForecast",
        "location": {
            "type": "GeoProperty",
            "value": { "type": "Point", "coordinates": [grid_point['lon'], grid_point['lat']] } 
        },
        "validFrom": {
            "type": "Property",
            "value": { "@type": "DateTime", "@value": forecast_time.isoformat() }
        },
        "validTo": {
            "type": "Property",
            "value": { "@type": "DateTime", "@value": (forecast_time + timedelta(minutes=15)).isoformat() }
        },
        "forecastedPM25": {
            "type": "Property",
            "value": round(forecast_value, 2), 
            "unitCode": "µg/m³"
        },
        "@context": [
            "https://smartdatamodels.org/context.jsonld"
        ]
    }

def sync_forecast_to_orion(orion_url, payload):
    """Đẩy lên Orion-LD (POST hoặc PATCH)."""
    headers = { 'Content-Type': 'application/ld+json' }
    
    try:
        response = requests.post(orion_url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        print(f"✅ Đã TẠO MỚI (POST) dự báo: {payload['id']}")
        
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 409 or e.response.status_code == 422: 
            try:
                # PATCH nếu đã tồn tại
                patch_payload = { k: v for k, v in payload.items() if k not in ['id', 'type', '@context'] }
                entity_url = f"{orion_url}/{payload['id']}/attrs"
                
                # Dùng application/json cho PATCH attrs
                patch_headers = { 'Content-Type': 'application/json' }
                
                requests.patch(entity_url, headers=patch_headers, data=json.dumps(patch_payload))
                print(f"✅ Đã CẬP NHẬT (PATCH) dự báo: {payload['id']}")
            except Exception as pe:
                print(f"❌ Lỗi PATCH {payload['id']}: {pe}")
        else:
            print(f"❌ Lỗi POST {payload['id']}: {e.response.text}")

def main():
    engine, orion_url = get_db_engine()
    
    print("\n--- BẮT ĐẦU QUÁ TRÌNH DỰ BÁO (ĐA PHƯƠNG THỨC) ---")

    # Lặp qua từng trạm trong lưới
    for grid_point in HCMC_GRID:
        grid_id = grid_point['id']
        model_filename = f'aqi_model_OWM-{grid_id}.joblib'
        
        try:
            # 1. Kiểm tra và tải mô hình
            if not os.path.exists(model_filename):
                print(f"⏩ Bỏ qua {grid_id}: Chưa có file mô hình (Cần chạy train_model.py trước).")
                continue
            
            model = joblib.load(model_filename)
            
            # 2. Lấy dữ liệu đầu vào (AQI + Weather + Road)
            input_df, forecast_time = get_model_inputs(engine, grid_id)
            
            # 3. Dự báo
            forecast_value = model.predict(input_df)[0]
            
            print(f"📊 {grid_id}: Input=[Lags, Temp:{input_df['temperature'][0]}, Road:{input_df['road_count'][0]}] -> Dự báo: {forecast_value:.2f}")

            # 4. Đẩy lên Orion
            ngsi_ld_payload = format_forecast_to_ngsi_ld(forecast_value, forecast_time, grid_point)
            sync_forecast_to_orion(orion_url, ngsi_ld_payload)

        except ValueError as ve:
             print(f"⚠️ {grid_id}: {ve}")
        except Exception as e:
             print(f"❌ {grid_id}: Lỗi không xác định: {e}")

    print("--- HOÀN TẤT DỰ BÁO ---")

if __name__ == "__main__":
    main()