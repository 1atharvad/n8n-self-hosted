# 🚀 N8N Self-Hosted Instance
> A powerful automation platform with custom media processing APIs, seamless integrations, and secure web access.

[![Website](https://img.shields.io/badge/Website-Live-brightgreen?style=for-the-badge&logo=render)](https://n8n.atharvadevasthali.com)
[![Docker](https://img.shields.io/badge/Docker-Containerized-blue?style=for-the-badge&logo=docker)](https://docker.com)

## 🌐 Live Access
**[N8N Platform](https://n8n.atharvadevasthali.com/)**
**[API Documentation](https://n8n.atharvadevasthali.com/api/docs)**

## 🛠️ Tech Stack

### Core Platform
![N8N](https://img.shields.io/badge/N8N-EA4B71?style=flat-square&logo=n8n&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-009639?style=flat-square&logo=nginx&logoColor=white)

### Backend & APIs
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)

### Infrastructure & Security
![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white)

## ✨ Key Features

🎯 **Automation Excellence**
- Visual workflow builder with drag-and-drop interface
- 300+ pre-built integrations and custom nodes
- Background job processing for heavy tasks

🎨 **Media Processing Suite**
- Text-to-speech conversion with multiple voices
- PowerPoint generation from templates
- Image extraction and video processing
- MP4 combining with streaming support

🏗️ **Enterprise Architecture**
- Docker containerization for scalability
- Nginx reverse proxy for optimal routing
- Secure tunnel access via Cloudflare

## 🚀 Quick Start

```bash
# Clone and setup
git clone https://github.com/1atharvad/n8n-self-hosted.git
cd n8n-self-hosted

# Clone and setup in current directory
git clone https://github.com/1atharvad/n8n-self-hosted.git .

# To switch from root to user for the folders, and its sub folders
find . -type f ! -name "*.ini" -exec chown 1000:1000 {} + 2>/dev/null
find . -type d -exec chown 1000:1000 {} + 2>/dev/null

# Install node
sudo apt install nodejs npm -y

# Install Docker Engine
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io -y

# Install required npm packages
npm install

# Environment file
nano .env

# Setup files for n8n, installing custom nodes, adding required assets
sh sh_files/setup_n8n_files.sh --clear-init

# Starting Docker
npm run docker-up:prod

# Stopping Docker
npm run docker-down:prod

# Exporting Workflows from a n8n instance
npm run pull-workflow

# Importing Workflows from a n8n instance
npm run push-workflow

# Updating docker images
npm run docker-update
```

## 📁 Project Structure

```
├── docker-compose.yml              # Service orchestration
├── nginx/nginx.conf                # Reverse proxy config
├── custom-n8n-nodes/               # TypeScript custom nodes
├── api/                            # API services
├── n8n-data/                       # Binary data storage
├── n8n_files/                      # Data storage for Fastapi
├── sh_files/                       # Shell scripts for running commands
└── .env                            # Environment variables
```

## 🔌 API Endpoints

### 🎵 Text-to-Speech
- `POST /api/vtt-generate-audio-bytes` - Generate TTS audio
- `GET /api/vtt-status/{job_id}` - Check TTS job status
- `GET /api/vtt-result/{job_id}` - Download audio file

### 📊 PowerPoint Processing
- `POST /api/ppt-generator` - Generate PPT from template
- `POST /api/extract-slides` - Extract slides as images
- `GET /api/ppt/{file_name}` - Download PPT file

### 🎬 Video Operations
- `POST /api/convert-to-mp4` - Image + audio to MP4
- `POST /api/combine-videos` - Combine multiple videos
- `GET /api/get-video/{video_id}` - Stream with range support

## 💻 Development

### Available Scripts
```bash
npm run build-n8n-nodes    # Build and deploy custom nodes
npm run pip-install        # Install Python dependencies
npm run add-pkg            # Add new Python package
npm run docker-up:prod     # Build nodes and start services
npm run docker-down:prod   # Stop all services
```

### Custom Node Development
Develop TypeScript nodes in `custom-n8n-nodes/` directory with full IntelliSense support and hot reloading.

## 🏛️ Infrastructure

### Database Configuration
- **Local filesystem** for binary data management
- **Automatic migrations** on service startup

### Security & Access
- **Cloudflare Tunnel** for secure web access
- **SSL/HTTPS** termination at edge
- **Environment-based** configuration management

## 📊 Performance Metrics

- **Background Processing**: Async job handling for media tasks
- **Streaming Support**: HTTP range requests for large files
- **Container Optimized**: Multi-stage Docker builds
- **Auto-scaling**: Docker Compose orchestration

## ⚙️ Worker Autoscaler

The `worker-autoscaler` container dynamically scales `n8n-worker` replicas based on host CPU and Redis queue depth.

### Algorithm: Asymmetric EWMA

CPU smoothing uses an Exponentially Weighted Moving Average with different rates for rising vs falling CPU:

```
if cpu_raw > cpu_ema:
    cpu_ema = α_up   × cpu_raw + (1 − α_up)   × cpu_ema   # reacts fast to spikes
else:
    cpu_ema = α_down × cpu_raw + (1 − α_down) × cpu_ema   # decays slowly after spike
```

Defaults: `α_up = 0.5`, `α_down = 0.1`. This prevents a brief CPU drop (e.g. job finishing) from immediately making the EMA appear safe for scale-up.

### Scaling Rules

| Condition                                     | Action                         |
| --------------------------------------------- | ------------------------------ |
| `waiting > 0` and `ema < 65%` and `raw < 65%` | Scale up +1 worker             |
| `max(ema, raw) > 88%` and `workers > min`     | Emergency scale down −1 worker |
| Queue idle for 120s and `workers > min`       | Scale down −1 worker           |

### Configuration (env vars)

| Variable                    | Default | Description                             |
| --------------------------- | ------- | --------------------------------------- |
| `MIN_WORKERS`               | 1       | Minimum workers always running          |
| `MAX_WORKERS`               | 4       | Maximum workers allowed                 |
| `CPU_SCALE_UP_MAX`          | 65      | Scale up only if CPU below this %       |
| `CPU_SCALE_DOWN_EMERGENCY`  | 88      | Force remove worker if CPU above this % |
| `IDLE_BEFORE_SCALEDOWN_SEC` | 120     | Seconds idle before scaling down        |
| `POLL_INTERVAL_SEC`         | 30      | Seconds between checks                  |
| `COOLDOWN_SEC`              | 90      | Minimum gap between scale actions       |
| `EWMA_ALPHA_UP`             | 0.5     | EMA weight when CPU is rising           |
| `EWMA_ALPHA_DOWN`           | 0.1     | EMA weight when CPU is falling          |

## 💡 Use Cases

This platform excels at automating complex workflows involving:
- **Content Creation**: Generate presentations and convert to videos
- **Media Processing**: Batch audio/video operations
- **Data Integration**: Connect multiple services seamlessly
- **Custom Automation**: Build workflows with TypeScript nodes

---

<div align="center">

**Built with ❤️ by Atharva Devasthali**

*Automation Engineer | Full-Stack Developer | DevOps Enthusiast*

</div>
