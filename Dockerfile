# --- Giai đoạn 1: Build ---
FROM node:22-alpine AS builder

WORKDIR /app

# Copy file cấu hình package
COPY package*.json ./

# Cài đặt dependencies
RUN npm ci

# Copy toàn bộ source code
COPY . .

# Build toàn bộ dự án (tất cả các apps)
RUN npx nest build api-gateway
RUN npx nest build auth-service
RUN npx nest build user-data-service
RUN npx nest build aqi-service
RUN npx nest build notification-service

# --- Giai đoạn 2: Production Run ---
FROM node:22-alpine

WORKDIR /app

# Copy node_modules và dist từ giai đoạn build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Tạo thư mục uploads; tránh cấp quyền ghi cho mọi user trong container.
RUN mkdir -p uploads && chmod 0755 uploads

# Thiết lập biến môi trường
ENV NODE_ENV=production

# Lệnh mặc định (sẽ bị ghi đè bởi docker-compose)
CMD ["node", "dist/apps/api-gateway/main"]
