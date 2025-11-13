import os
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import joblib       # Để tải model
import requests     # 👈 Để gọi Orion-LD
import json
from datetime import datetime, timedelta

# Tải file .env và tạo engine (giống hệt train_model.py)
def get_db_engine():
    env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
    load_dotenv(env_path)
    db_url = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASS')}@" \
             f"{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    return create_engine(db_url), os.getenv('ORION_LD_URL')

def get_latest_features(engine):
    """Lấy 4 điểm dữ liệu (1 giờ) mới nhất để làm input cho mô hình."""
    print("Đang lấy dữ liệu mới nhất từ PostgreSQL...")
    query = text("SELECT time, pm2_5 FROM air_quality_observations ORDER BY time DESC LIMIT 4")
    with engine.connect() as connection:
        df = pd.read_sql(query, connection)
    
    if len(df) < 4:
        raise ValueError(f"Không đủ dữ liệu để dự báo (cần 4, chỉ có {len(df)})")
        
    # Sắp xếp lại (cũ nhất -> mới nhất) để tạo lag
    df = df.sort_values(by='time')
    
    # Tạo input cho mô hình (đây là 4 giá trị pm2_5 gần nhất)
    # ['pm25_lag_60m', 'pm25_lag_45m', 'pm25_lag_30m', 'pm25_lag_15m']
    features_input = [df['pm2_5'].values]
    
    # Lấy thời điểm của dự báo (15 phút sau điểm cuối cùng)
    last_time = pd.to_datetime(df['time'].iloc[-1])
    forecast_time = last_time + timedelta(minutes=15)
    
    return features_input, forecast_time

def format_forecast_to_ngsi_ld(forecast_value, forecast_time):
    """Đóng gói dự báo thành thực thể AirQualityForecast."""
    entity_id = "urn:ngsi-ld:AirQualityForecast:HCMC-Central"
    
    return {
        "id": entity_id,
        "type": "AirQualityForecast",
        "location": {
            "type": "GeoProperty",
            "value": { "type": "Point", "coordinates": [106.7009, 10.7769] } # Tọa độ trung tâm OWM
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
            "value": round(forecast_value, 2), # Làm tròn dự báo
            "unitCode": "µg/m³"
        },
        "@context": [
            "https://smartdatamodels.org/context.jsonld"
        ]
    }

def sync_forecast_to_orion(orion_url, payload):
    """Đẩy (POST hoặc PATCH) thực thể dự báo lên Orion-LD."""
    headers = { 'Content-Type': 'application/ld+json' }
    
    try:
        # 1. Thử POST (Tạo mới)
        response = requests.post(orion_url, headers=headers, data=json.dumps(payload))
        response.raise_for_status() # Ném lỗi nếu status code là 4xx hoặc 5xx
        print(f"✅ Đã TẠO MỚI (POST) thực thể dự báo: {payload['id']}")
        
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 409 or e.response.status_code == 422: # 409 Conflict (Đã tồn tại)
            # 2. Nếu đã tồn tại, dùng PATCH (Cập nhật)
            try:
                patch_payload = { k: v for k, v in payload.items() if k not in ['id', 'type', '@context'] }
                entity_url = f"{orion_url}/{payload['id']}/attrs"
                
                # PATCH dùng application/json thường
                patch_headers = { 'Content-Type': 'application/json' }
                patch_response = requests.patch(entity_url, headers=patch_headers, data=json.dumps(patch_payload))
                patch_response.raise_for_status()
                print(f"✅ Đã CẬP NHẬT (PATCH) thực thể dự báo: {payload['id']}")
                
            except requests.exceptions.HTTPError as pe:
                print(f"❌ Lỗi khi PATCH thực thể: {pe.response.text}")
        else:
            print(f"❌ Lỗi khi POST thực thể: {e.response.text}")

def main():
    try:
        engine, orion_url = get_db_engine()
        
        # 1. Tải mô hình đã huấn luyện
        model_filename = 'aqi_forecast_model.joblib'
        print(f"Đang tải mô hình từ '{model_filename}'...")
        model = joblib.load(model_filename)
        
        # 2. Lấy dữ liệu mới nhất làm input
        features_input, forecast_time = get_latest_features(engine)
        
        # 3. Tạo dự báo
        forecast_value = model.predict(features_input)[0]
        print(f"Dự báo PM2.5 cho {forecast_time}: {forecast_value:.2f} µg/m³")
        
        # 4. Định dạng NGSI-LD
        ngsi_ld_payload = format_forecast_to_ngsi_ld(forecast_value, forecast_time)
        
        # 5. Đẩy lên Orion-LD
        sync_forecast_to_orion(orion_url, ngsi_ld_payload)
        
    except Exception as e:
        print(f"❌ Đã xảy ra lỗi trong quá trình dự báo: {e}")

if __name__ == "__main__":
    main()