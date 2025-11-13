import os
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error
import joblib
import numpy as np

def get_db_engine():
    """Tải .env và tạo SQLAlchemy engine."""
    env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
    load_dotenv(env_path)
    
    db_url = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASS')}@" \
             f"{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
             
    return create_engine(db_url)

def load_data(engine):
    """Đọc toàn bộ dữ liệu quan trắc từ PostgreSQL."""
    print("Đang tải dữ liệu từ PostgreSQL...")
    query = text("SELECT time, pm2_5 FROM air_quality_observations ORDER BY time")
    with engine.connect() as connection:
        df = pd.read_sql(query, connection)
    
    if df.empty:
        raise ValueError("Không có dữ liệu trong 'air_quality_observations' để huấn luyện.")
        
    # Xử lý dữ liệu thời gian
    df['time'] = pd.to_datetime(df['time'])
    df.set_index('time', inplace=True)
    
    # Chỉ lấy dữ liệu mỗi 15 phút để đảm bảo tính nhất quán
    df = df.resample('15min').mean().interpolate(method='linear')
    print(f"Đã tải và xử lý {len(df)} dòng dữ liệu.")
    return df

def feature_engineer(df):
    """Tạo các đặc trưng (features) cho mô hình chuỗi thời gian."""
    print("Đang tạo đặc trưng (features)...")
    df_features = df.copy()
    
    # Tạo các đặc trưng "lag" (trễ)
    df_features['pm25_lag_15m'] = df_features['pm2_5'].shift(1)
    df_features['pm25_lag_30m'] = df_features['pm2_5'].shift(2)
    df_features['pm25_lag_45m'] = df_features['pm2_5'].shift(3)
    df_features['pm25_lag_60m'] = df_features['pm2_5'].shift(4)
    
    df_features.dropna(inplace=True)
    
    return df_features

def main():
    try:
        engine = get_db_engine()
        df = load_data(engine)
        
        if len(df) < 10:
            print(f"❌ Lỗi: Dữ liệu quá ít để huấn luyện. (Cần ít nhất 10 dòng, đang có {len(df)}).")
            return

        df_features = feature_engineer(df)
        
        features = ['pm25_lag_15m', 'pm25_lag_30m', 'pm25_lag_45m', 'pm25_lag_60m']
        target = 'pm2_5'
        
        X = df_features[features]
        y = df_features[target]

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)
        
        print("Đang huấn luyện mô hình Linear Regression...")
        model = LinearRegression()
        model.fit(X_train, y_train)
        
        # 4. Đánh giá mô hình
        preds = model.predict(X_test)
        
        # 🚀 SỬA LỖI: TÍNH RMSE BẰNG TAY (THAY VÌ DÙNG 'squared=False')
        mse = mean_squared_error(y_test, preds)
        rmse = np.sqrt(mse) # Lấy căn bậc hai của MSE
        
        print(f"✅ Huấn luyện thành công. Chỉ số lỗi (RMSE): {rmse:.2f} µg/m³")
        
        # 5. Lưu mô hình vào file
        model_filename = 'aqi_forecast_model.joblib'
        joblib.dump(model, model_filename)
        print(f"✅ Mô hình đã được lưu vào file: {model_filename}")

    except Exception as e:
        print(f"❌ Đã xảy ra lỗi trong quá trình huấn luyện: {e}")

if __name__ == "__main__":
    main()