# N8N Self-Hosted Instance

Self-hosted n8n automation platform with custom media processing APIs and secure web access.

## Overview

- **Domain**: n8n.atharvadevasthali.tech
- **Services**: N8N + FastAPI + Nginx + Cloudflare Tunnel
- **Database**: Supabase PostgreSQL
- **Storage**: Local filesystem for binary data

## Components

### Core Services
- **N8N**: Main automation platform
- **FastAPI**: Custom API services for video generation, text-to-audio, media combining
- **Nginx**: Reverse proxy handling routing
- **Cloudflare Tunnel**: Secure web access without port forwarding

### Custom Features
- Custom TypeScript nodes for n8n
- Video generation API
- Text-to-speech conversion
- Image + audio to video processing
- Video combining functionality

### Infrastructure
- Docker containerization
- Supabase for database storage
- Local filesystem for media files
- SSL/HTTPS through Cloudflare

## Quick Start

1. Clone repository and copy environment file
2. Configure `.env` with database credentials and API keys
3. Set up Cloudflare tunnel token
4. Run `docker-compose up -d`
5. Access n8n at your domain

## File Structure

- `docker-compose.yml` - Main service configuration
- `nginx/` - Reverse proxy configuration
- `n8n/custom-nodes/` - Custom TypeScript nodes
- `fastapi/app/` - API service code
- `storage/` - Binary data storage (videos, audio, images)
- `.env` - Environment variables
- `credentials.json` - Cloudflare credentials

## API Endpoints

- `/api/video/generate` - Video generation
- `/api/audio/text-to-speech` - TTS conversion
- `/api/media/image-audio-to-video` - Combine image and audio
- `/api/combine/videos` - Video merging

## Development

### Custom Nodes
Develop TypeScript nodes in `custom-n8n-nodes/` directory. Use `npm run build-n8n-nodes` to compile and deploy changes.

### API Services
FastAPI services handle media processing with background job management and file streaming capabilities.

### Available Scripts
- `npm run build-n8n-nodes` - Build and deploy custom nodes
- `npm run pip-install` - Install Python dependencies
- `npm run add-pkg` - Add new Python package and update requirements
- `npm run docker-up` - Build nodes and start all services
- `npm run docker-down` - Stop all services

## Configuration

### Environment Variables
Set up database connection, API keys, domain settings, and Cloudflare tunnel token in `.env`.

### Database
Supabase PostgreSQL handles n8n data storage. N8N creates necessary tables automatically.

### Storage
Local filesystem organized into folders for different media types with proper permissions.

## Monitoring

- View logs: `docker-compose logs -f [service-name]`
- Health checks available at `/healthz` and `/api/health`
- Access FastAPI docs at `/api/docs`

## Security Notes

- Environment files not committed to version control
- Proper file permissions on storage directories
- SSL handled by Cloudflare
- Database connections use SSL

## Troubleshooting

Common issues involve database connections, file permissions, tunnel configuration, and custom node compilation. Check logs and verify environment variables for most problems.