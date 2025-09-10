# 🚀 N8N Self-Hosted Instance
> A powerful automation platform with custom media processing APIs, seamless integrations, and secure web access.

[![Website](https://img.shields.io/badge/Website-Live-brightgreen?style=for-the-badge&logo=render)](https://n8n.atharvadevasthali.tech)
[![Docker](https://img.shields.io/badge/Docker-Containerized-blue?style=for-the-badge&logo=docker)](https://docker.com)

## 🌐 Live Access
**[N8N Platform](https://n8n.atharvadevasthali.tech/)**  
**[API Documentation](https://n8n.atharvadevasthali.tech/api/docs)**

## 🛠️ Tech Stack

### Core Platform
![N8N](https://img.shields.io/badge/N8N-EA4B71?style=flat-square&logo=n8n&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-009639?style=flat-square&logo=nginx&logoColor=white)

### Backend & APIs
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)

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
- Supabase PostgreSQL for reliable data storage
- Secure tunnel access via Cloudflare

## 🚀 Quick Start

```bash
# Clone and setup
git clone https://github.com/1atharvad/n8n-self-hosted.git
cd n8n-self-hosted

# Install dependencies
npm run pip-install

# Build and deploy
npm run docker-up
```

## 📁 Project Structure

```
├── docker-compose.yml              # Service orchestration
├── nginx.conf                      # Reverse proxy config
├── custom-n8n-nodes/               # TypeScript custom nodes
├── fastapi/app/                    # API services
├── n8n-data/                       # Binary data storage
├── n8n-files/                      # Data storage for Fastapu
├── cloudflare/credentials.json     # Cloudflare credentials
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
npm run docker-up          # Build nodes and start services
npm run docker-down        # Stop all services
```

### Custom Node Development
Develop TypeScript nodes in `custom-n8n-nodes/` directory with full IntelliSense support and hot reloading.

## 🏛️ Infrastructure

### Database Configuration
- **Supabase PostgreSQL** for workflow storage
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
