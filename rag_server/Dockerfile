FROM python:3.10-slim

WORKDIR /app

# Cài đặt các gói hệ thống cần thiết
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt các dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Tạo thư mục lưu data_bronze
RUN mkdir -p data_bronze

# Mở port (Cloud Run sẽ ghi đè biến này, mặc định là 8080)
ENV PORT=8080
EXPOSE $PORT

# Lệnh khởi chạy server (sử dụng shell form để nhận diện biến môi trường $PORT)
CMD uvicorn app:app --host 0.0.0.0 --port $PORT
