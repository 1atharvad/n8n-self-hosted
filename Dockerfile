# Base image
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies + Node.js + npm + nginx + Supervisor
RUN apt-get update && apt-get install -y wget curl gnupg build-essential \
    netcat-openbsd ffmpeg libreoffice poppler-utils python3-dev supervisor nginx \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g n8n \
    && rm -rf /var/lib/apt/lists/*

# Create folder for TTS models
RUN mkdir -p /tts_cache && chmod 777 /tts_cache

# Create folder for n8n custom files
RUN mkdir -p /n8n_files && chmod 777 /n8n_files

# Create folder for n8n data
RUN mkdir -p /home/node/.n8n && chmod 777 /home/node/.n8n

# Copy FastAPI app
COPY api/ /fastapi

# Install FastAPI Python dependencies
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /fastapi/requirements.txt

# Copy nginx config
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/conf.d/nginx.conf

# Copy supervisord.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY wait-for-port.sh /wait-for-port.sh
RUN chmod +x /wait-for-port.sh

EXPOSE 8080

# Entrypoint: Supervisor manages FastAPI, n8n, nginx
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
