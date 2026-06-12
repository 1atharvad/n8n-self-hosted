# ---- Stage 1: Frontend Build ----
FROM node:20-slim AS frontend

WORKDIR /build
COPY admin/package.json admin/package-lock.json ./
RUN npm ci
COPY admin/src ./src
RUN npm run build

# ---- Stage 2: Python Builder ----
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# ---- Stage 3: Runtime ----
FROM python:3.11-slim AS runtime

WORKDIR /app

# LibreOffice (for ppt→pdf) and FFmpeg (for video automation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    wget \
    libreoffice-core \
    libreoffice-writer \
    libreoffice-impress \
    libreoffice-draw \
    poppler-utils \
    git \
    docker.io \
 && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn
COPY --from=builder /usr/local/bin/alembic /usr/local/bin/alembic

COPY . .

# Overlay compiled frontend assets (built in stage 1)
COPY --from=frontend /build/static ./admin/static

CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 9374"]
