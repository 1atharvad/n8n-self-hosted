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
    jq \
    ca-certificates \
    curl \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
 && chmod a+r /etc/apt/keyrings/docker.asc \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends docker-ce-cli \
 && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \
 && git config --global --add safe.directory /workspace

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn
COPY --from=builder /usr/local/bin/alembic /usr/local/bin/alembic

COPY . .

# Overlay compiled frontend assets (built in stage 1)
COPY --from=frontend /build/static ./admin/static

CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 9374"]
