# ---- Stage 1: Builder ----
FROM python:3.11-slim AS builder

WORKDIR /app

# Install only what’s needed to build Python dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# ---- Stage 2: Runtime ----
FROM python:3.11-slim AS runtime

WORKDIR /app

# Install only runtime tools — minimal dependencies
# LibreOffice (for ppt→pdf) and FFmpeg (for video automation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    wget \
    libreoffice-core \
    libreoffice-writer \
    libreoffice-impress \
    libreoffice-draw \
    poppler-utils \
 && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Copy only installed site-packages and binaries
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn

# Copy your project files
COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9374"]
