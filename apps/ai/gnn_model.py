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


import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GCNConv

class ST_GNN(nn.Module):
    def __init__(self, num_nodes, input_dim, hidden_dim, output_dim):
        super(ST_GNN, self).__init__()
        self.num_nodes = num_nodes
        self.hidden_dim = hidden_dim
        
        # 1. Temporal Block (LSTM)
        # Học chuỗi thời gian độc lập cho từng node
        self.lstm = nn.LSTM(input_dim, hidden_dim, batch_first=True)
        
        # 2. Spatial Block (GCN)
        # Trao đổi thông tin giữa các node hàng xóm
        self.gcn = GCNConv(hidden_dim, hidden_dim)
        
        # 3. Output Layer
        self.fc = nn.Linear(hidden_dim, output_dim)

    def forward(self, x, edge_index, edge_weight=None):
        # x shape: [Batch_Size * Num_Nodes, Seq_Len, Features]
        # Nhưng PyG thường xử lý graph snapshot.
        # Để đơn giản cho dự án này, ta xử lý từng snapshot.
        
        # --- BƯỚC 1: LSTM (Thời gian) ---
        # Input x: [Num_Nodes, Seq_Len, Features] (1 Graph snapshot)
        lstm_out, _ = self.lstm(x) 
        
        # Lấy hidden state cuối cùng: [Num_Nodes, Hidden_Dim]
        h_last = lstm_out[:, -1, :]
        
        # --- BƯỚC 2: GCN (Không gian) ---
        # Truyền thông tin qua các cạnh (edge_index)
        gcn_out = self.gcn(h_last, edge_index, edge_weight)
        gcn_out = F.relu(gcn_out)
        
        # --- BƯỚC 3: Dự báo ---
        out = self.fc(gcn_out) # [Num_Nodes, 1]
        return out