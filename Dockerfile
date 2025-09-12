# Stage 1: n8n base
FROM n8nio/n8n:latest AS n8n-base

# Stage 2: FastAPI build
FROM python:3.12-slime AS fastapi-builder
WORKDIR /app/api
RUN apt-get update && apt-get install -y \
    build-essential \
    ffmpeg \
    libreoffice \
    poppler-utils \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*
COPY api/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Stage 3: Runtime wrapper image
FROM alpine:latest
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache python3 py3-pip bash curl nginx

# Copy n8n binaries
COPY --from=n8n-base /usr/local/lib/node_modules/n8n /usr/local/lib/node_modules/n8n
COPY --from=n8n-base /usr/local/bin/n8n /usr/local/bin/n8n

# Copy n8n local data
COPY n8n-data/ /app/n8n-data

# Copy FastAPI app
COPY --from=fastapi-builder /app/api /app/api

# Copy nginx config
COPY nginx/ /etc/nginx/

# Expose ports
EXPOSE 5678 9374 80

# Start all services
CMD ["sh", "-c", "\
    # Start n8n with local data
    n8n start --user-folder /app/n8n-data --tunnel & \
    # Start FastAPI
    uvicorn api.main:app --host 0.0.0.0 --port 9374 & \
    # Start nginx in foreground
    nginx -g 'daemon off;' \
"]
