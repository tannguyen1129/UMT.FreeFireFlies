import os
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from geopy.distance import geodesic
from sklearn.preprocessing import MinMaxScaler
import joblib
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
DISTANCE_THRESHOLD_KM = 15.0 # Các trạm cách nhau < 15km sẽ có cạnh nối

def get_db_engine():
    env_path = os.path.join(BASE_DIR, '..', '..', '.env')
    load_dotenv(env_path)
    db_url = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASS')}@" \
             f"{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    return create_engine(db_url)

# 1. TẠO CẠNH (EDGE INDEX) DỰA TRÊN KHOẢNG CÁCH
def build_graph_edges():
    src_nodes = []
    dst_nodes = []
    weights = []
    
    print("🌐 Đang xây dựng đồ thị kết nối các trạm...")
    for i in range(NUM_NODES):
        for j in range(NUM_NODES):
            if i == j: continue # Không nối với chính nó (hoặc có thể nối tùy mô hình)
            
            coord_i = (HCMC_GRID[i]['lat'], HCMC_GRID[i]['lon'])
            coord_j = (HCMC_GRID[j]['lat'], HCMC_GRID[j]['lon'])
            dist = geodesic(coord_i, coord_j).km
            
            if dist <= DISTANCE_THRESHOLD_KM:
                src_nodes.append(i)
                dst_nodes.append(j)
                weights.append(1.0 / dist) # Nghịch đảo khoảng cách làm trọng số
    
    edge_index = torch.tensor([src_nodes, dst_nodes], dtype=torch.long)
    edge_weight = torch.tensor(weights, dtype=torch.float)
    print(f"✅ Đồ thị có {len(src_nodes)} cạnh kết nối.")
    return edge_index, edge_weight

# 2. TẢI VÀ ĐỒNG BỘ DỮ LIỆU
def load_synced_data(engine):
    # Chúng ta cần một DataFrame lớn chứa dữ liệu của cả 9 trạm, index theo thời gian
    combined_df = pd.DataFrame()
    
    print("📥 Đang tải và đồng bộ dữ liệu từ 9 trạm...")
    for i, node in enumerate(HCMC_GRID):
        query = text(f"SELECT time, pm2_5 FROM air_quality_observations WHERE entity_id = 'urn:ngsi-ld:AirQualityStation:OWM-{node['id']}' ORDER BY time")
        with engine.connect() as conn:
            df = pd.read_sql(query, conn)
            
        df['time'] = pd.to_datetime(df['time'])
        df.set_index('time', inplace=True)
        df = df.resample('15min').mean().interpolate()
        
        # Đổi tên cột để merge
        df = df.rename(columns={'pm2_5': f'pm25_{i}'})
        
        if combined_df.empty:
            combined_df = df
        else:
            combined_df = combined_df.join(df, how='inner') # Chỉ lấy mốc thời gian chung
            
    combined_df.dropna(inplace=True)
    print(f"✅ Dữ liệu đồng bộ: {len(combined_df)} mốc thời gian chung.")
    return combined_df

# 3. CHUẨN BỊ DATASET CHO GNN
def create_gnn_dataset(df, seq_len):
    # Output shape: [Num_Samples, Num_Nodes, Seq_Len, Features]
    data_matrix = df.values # [Time, Num_Nodes]
    
    X, y = [], []
    for i in range(len(data_matrix) - seq_len):
        # Input: Cửa sổ trượt cho TẤT CẢ các trạm
        # Shape: [Num_Nodes, Seq_Len] -> Cần reshape thành [Num_Nodes, Seq_Len, 1]
        seq = data_matrix[i : i+seq_len].T 
        label = data_matrix[i+seq_len] # Giá trị tương lai của tất cả trạm
        
        X.append(seq[..., np.newaxis]) # Thêm dimension feature
        y.append(label)
        
    return torch.tensor(X, dtype=torch.float), torch.tensor(y, dtype=torch.float)

def main():
    engine = get_db_engine()
    
    # 1. Xây dựng Graph
    edge_index, edge_weight = build_graph_edges()
    
    # 2. Dữ liệu
    df = load_synced_data(engine)
    if len(df) < 20:
        print("❌ Chưa đủ dữ liệu đồng bộ để train GNN.")
        return

    # Chuẩn hóa
    scaler = MinMaxScaler()
    df_scaled = pd.DataFrame(scaler.fit_transform(df), columns=df.columns, index=df.index)
    
    X, y = create_gnn_dataset(df_scaled, SEQ_LENGTH)
    
    # 3. Model
    model = ST_GNN(num_nodes=NUM_NODES, input_dim=1, hidden_dim=16, output_dim=1)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    criterion = nn.MSELoss()
    
    # 4. Train Loop
    print("🚀 Bắt đầu huấn luyện GNN...")
    model.train()
    for epoch in range(100):
        total_loss = 0
        for i in range(len(X)): # Duyệt từng snapshot thời gian
            optimizer.zero_grad()
            
            # Forward: Đưa 1 snapshot (9 trạm, 4 bước thời gian) vào
            out = model(X[i], edge_index, edge_weight) 
            
            loss = criterion(out.squeeze(), y[i])
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            
        if (epoch+1) % 10 == 0:
            print(f"Epoch {epoch+1}, Loss: {total_loss/len(X):.4f}")
            
    # 5. Lưu
    torch.save(model.state_dict(), os.path.join(BASE_DIR, 'gnn_model.pth'))
    joblib.dump(scaler, os.path.join(BASE_DIR, 'gnn_scaler.joblib'))
    # Lưu edge_index để dùng lúc predict
    torch.save((edge_index, edge_weight), os.path.join(BASE_DIR, 'graph_structure.pt'))
    
    print("✅ Hoàn tất huấn luyện GNN.")

if __name__ == "__main__":
    main()