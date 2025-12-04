# --- Giai đoạn 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy file cấu hình package
COPY package*.json ./

# Cài đặt dependencies
RUN npm ci

# Copy toàn bộ source code
COPY . .

# Build toàn bộ dự án (tất cả các apps)
RUN npm run build

# --- Giai đoạn 2: Production Run ---
FROM node:20-alpine

WORKDIR /app

# Copy node_modules và dist từ giai đoạn build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/uploads ./uploads

# Tạo thư mục uploads nếu chưa có và cấp quyền
RUN mkdir -p uploads && chmod 777 uploads

# Thiết lập biến môi trường mặc định
ENV NODE_ENV=production

# Lệnh chạy sẽ được ghi đè trong docker-compose
CMD ["node", "dist/apps/api-gateway/main"]