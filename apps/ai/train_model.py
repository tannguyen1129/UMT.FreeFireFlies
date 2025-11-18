import os
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error
import joblib
import numpy as np

# Danh sách 9 trạm (Khớp với Backend)
HCMC_GRID_IDS = [
    'ThuDuc', 'District12', 'HocMon', 'District1', 'BinhTan',
    'District2', 'District7', 'BinhChanh', 'CanGio'
]

def get_db_engine():
    """Kết nối CSDL PostgreSQL."""
    env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
    load_dotenv(env_path)
    db_url = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASS')}@" \
             f"{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    return create_engine(db_url)

def load_merged_data(engine, grid_id):
    """
    Tải và Gộp dữ liệu từ 3 nguồn: AQI, Thời tiết, Giao thông.
    """
    print(f"\n--- Đang xử lý dữ liệu cho trạm: {grid_id} ---")

    # 1. Tải dữ liệu AQI
    aqi_id = f"urn:ngsi-ld:AirQualityStation:OWM-{grid_id}"
    query_aqi = text("SELECT time, pm2_5 FROM air_quality_observations WHERE entity_id = :id ORDER BY time")
    with engine.connect() as conn:
        df_aqi = pd.read_sql(query_aqi, conn, params={'id': aqi_id})
    
    if df_aqi.empty:
        print(f"🟡 Không có dữ liệu AQI cho {grid_id}")
        return None
    
    # Chuẩn hóa thời gian AQI (15 phút/lần)
    df_aqi['time'] = pd.to_datetime(df_aqi['time'])
    df_aqi.set_index('time', inplace=True)
    df_aqi = df_aqi.resample('15min').mean().interpolate(method='linear')

    # 2. Tải dữ liệu Thời tiết
    weather_id = f"urn:ngsi-ld:WeatherObservation:OWM-{grid_id}"
    # Lưu ý: Tên cột trong DB là snake_case (relative_humidity, wind_speed)
    query_weather = text("SELECT time, temperature, relative_humidity, wind_speed FROM weather_observations WHERE entity_id = :id ORDER BY time")
    with engine.connect() as conn:
        df_weather = pd.read_sql(query_weather, conn, params={'id': weather_id})
    
    if not df_weather.empty:
        df_weather['time'] = pd.to_datetime(df_weather['time'])
        df_weather.set_index('time', inplace=True)
        df_weather = df_weather.resample('15min').mean().interpolate(method='linear')
    
    # 3. Tải dữ liệu Giao thông (Road Features - Dữ liệu tĩnh)
    # Road Feature dùng chung ID với AQI Station
    query_road = text("SELECT major_road_count FROM road_features WHERE entity_id = :id")
    with engine.connect() as conn:
        road_result = conn.execute(query_road, {'id': aqi_id}).fetchone()
        road_count = road_result[0] if road_result else 0

    # 4. GỘP DỮ LIỆU (MERGE)
    # Chỉ lấy các mốc thời gian có cả AQI và Thời tiết
    if not df_weather.empty:
        df_merged = pd.merge(df_aqi, df_weather, left_index=True, right_index=True, how='inner')
    else:
        print(f"⚠️ Cảnh báo: Không có dữ liệu thời tiết cho {grid_id}. Dùng AQI thuần.")
        df_merged = df_aqi
        # Điền giá trị mặc định nếu thiếu thời tiết
        df_merged['temperature'] = 30.0
        df_merged['relative_humidity'] = 70.0
        df_merged['wind_speed'] = 2.0

    # Thêm cột giao thông (giống nhau cho mọi dòng của trạm này)
    df_merged['road_count'] = road_count
    
    print(f"✅ Đã gộp dữ liệu: {len(df_merged)} dòng. (Roads: {road_count})")
    return df_merged

def feature_engineer(df):
    """Tạo đặc trưng cho mô hình đa phương thức."""
    df_features = df.copy()
    
    # Đặc trưng trễ (Lag Features) của AQI
    df_features['pm25_lag_15m'] = df_features['pm2_5'].shift(1)
    df_features['pm25_lag_30m'] = df_features['pm2_5'].shift(2)
    df_features['pm25_lag_45m'] = df_features['pm2_5'].shift(3)
    df_features['pm25_lag_60m'] = df_features['pm2_5'].shift(4)
    
    # Các đặc trưng khác (Weather, Road) đã có sẵn trong cột
    
    df_features.dropna(inplace=True)
    return df_features

def main():
    try:
        engine = get_db_engine()
        models_trained = 0

        for grid_id in HCMC_GRID_IDS:
            # 1. Tải và Gộp dữ liệu
            df = load_merged_data(engine, grid_id)
            
            if df is None or len(df) < 10:
                print(f"❌ Dữ liệu quá ít cho trạm {grid_id}, bỏ qua.")
                continue

            # 2. Feature Engineering
            df_features = feature_engineer(df)
            
            # 3. Định nghĩa Input (X) và Output (y)
            # MÔ HÌNH ĐA PHƯƠNG THỨC
            features = [
                'pm25_lag_15m', 'pm25_lag_30m', 'pm25_lag_45m', 'pm25_lag_60m', # Lịch sử AQI
                'temperature', 'relative_humidity', 'wind_speed',               # Thời tiết
                'road_count'                                                    # Giao thông
            ]
            target = 'pm2_5'
            
            X = df_features[features]
            y = df_features[target]

            # 4. Chia train/test
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)

            if X_train.empty:
                continue

            # 5. Huấn luyện
            print(f"Đang huấn luyện Linear Regression Đa phương thức cho {grid_id}...")
            model = LinearRegression()
            model.fit(X_train, y_train)
            
            # 6. Đánh giá
            preds = model.predict(X_test)
            mse = mean_squared_error(y_test, preds)
            rmse = np.sqrt(mse) 
            print(f"✅ Huấn luyện {grid_id} thành công. RMSE: {rmse:.2f} µg/m³")
            
            # 7. Lưu mô hình
            model_filename = f'aqi_model_OWM-{grid_id}.joblib'
            joblib.dump(model, model_filename)
            models_trained += 1

        print(f"\n--- HOÀN TẤT: Đã huấn luyện {models_trained} / {len(HCMC_GRID_IDS)} mô hình đa phương thức. ---")

    except Exception as e:
        print(f"❌ Lỗi script: {e}")

if __name__ == "__main__":
    main()