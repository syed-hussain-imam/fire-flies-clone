# 🐳 Docker Setup Guide

This guide will help you run the Fireflies Clone application using Docker in different scenarios.

## 📋 Prerequisites

- Docker installed on your system
- Docker Compose installed (usually comes with Docker Desktop)
- Your OpenAI API key

## 🚀 Quick Start

### 1. Environment Setup

Create your environment file:
```bash
cp .env.example .env
# Edit .env and add your OpenAI API key:
# OPENAI_API_KEY=your_openai_api_key_here
```

### 2. Production Deployment

Run the application in production mode:
```bash
# Build and run with Docker Compose
npm run docker:prod

# Or manually:
docker-compose up fireflies-app
```

The application will be available at `http://localhost:3000`

### 3. Development Mode

Run with hot reload for development:
```bash
# Start development environment
npm run docker:dev

# Or manually:
docker-compose --profile dev up fireflies-dev
```

This will:
- Mount your source code for hot reload
- Expose debug port on 9229
- Install all dev dependencies

## 📁 Docker Configuration Files

### `Dockerfile` (Production)
- **Multi-stage build** for optimized image size
- **Non-root user** for security
- **Health checks** for container monitoring
- **Alpine Linux** for minimal footprint (~50MB final image)

### `Dockerfile.dev` (Development)
- **Hot reload** with tsx watch
- **Debug port** exposed (9229)
- **Full dev dependencies** installed

### `docker-compose.yml`
- **Production service** (`fireflies-app`)
- **Development service** (`fireflies-dev`) with profile
- **Persistent volumes** for data, uploads, and logs
- **Health checks** and restart policies

## 🔧 Available Docker Commands

```bash
# Build production image
npm run docker:build

# Run single container with environment file
npm run docker:run

# Start development environment (hot reload)
npm run docker:dev

# Start production environment
npm run docker:prod

# Stop all containers
npm run docker:down

# View logs
npm run docker:logs

# Clean up containers and volumes
npm run docker:clean
```

## 📊 Data Persistence

Docker volumes are used to persist:
- **Database**: SQLite database file
- **Uploads**: User-uploaded audio files
- **Logs**: Application logs

### Volume Locations
```bash
# Production volumes
fireflies_data        # Database
fireflies_uploads     # Audio files
fireflies_logs        # Application logs

# Development volumes  
fireflies_dev_uploads # Dev audio files
fireflies_dev_logs    # Dev logs
```

## 🔍 Monitoring & Health Checks

### Health Check Endpoint
The application includes a health check at `/health`:

```bash
# Test health check
curl http://localhost:3000/health
```

### Container Health Status
```bash
# Check container health
docker ps
# Look for "healthy" status

# View health check logs
docker inspect fireflies-clone | grep -A 10 Health
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Check what's using port 3000
lsof -i :3000

# Use different port
PORT=3001 docker-compose up fireflies-app
```

#### 2. OpenAI API Key Issues
```bash
# Verify environment variables
docker exec fireflies-clone env | grep OPENAI

# Check logs for API errors
npm run docker:logs
```

#### 3. File Upload Issues
```bash
# Check upload directory permissions
docker exec fireflies-clone ls -la uploads/

# View container logs for upload errors
docker logs fireflies-clone
```

#### 4. Database Issues
```bash
# Access container shell
docker exec -it fireflies-clone sh

# Check database file
ls -la sqlite.db

# Run migration manually
npm run db:migrate
```

### Development Issues

#### Hot Reload Not Working
```bash
# Ensure you're using the dev profile
docker-compose --profile dev up fireflies-dev

# Check if files are properly mounted
docker exec fireflies-clone-dev ls -la src/
```

#### Debug Port Access
```bash
# Connect debugger to localhost:9229
# In VS Code, use this launch.json:
{
  "type": "node",
  "request": "attach",
  "name": "Docker Debug",
  "port": 9229,
  "restart": true,
  "remoteRoot": "/app"
}
```

## 🚀 Production Deployment

### Environment Variables for Production
```bash
# .env for production
NODE_ENV=production
PORT=3000
DATABASE_URL=./sqlite.db
OPENAI_API_KEY=your_key_here
MAX_FILE_SIZE=50MB
UPLOAD_DIR=./uploads
```

### Using with Reverse Proxy (Nginx)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Docker Swarm Deployment
```yaml
version: '3.8'
services:
  fireflies-app:
    image: fireflies-clone:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - fireflies_data:/app/sqlite.db
      - fireflies_uploads:/app/uploads
    deploy:
      replicas: 2
      restart_policy:
        condition: on-failure
```

## 📊 Performance Optimization

### Image Size Optimization
The production Docker image is optimized to be ~50MB:
- Multi-stage build removes dev dependencies
- Alpine Linux base image
- Only necessary files copied

### Build Cache Optimization
```bash
# Rebuild with cache
docker build -t fireflies-clone .

# Force rebuild without cache
docker build --no-cache -t fireflies-clone .
```

### Memory Usage
```bash
# Monitor container resource usage
docker stats fireflies-clone

# Set memory limits
docker run -m 512m fireflies-clone
```

## 🔒 Security Considerations

### Non-root User
The container runs as a non-root user (`fireflies:1001`) for security.

### File Permissions
```bash
# Check file ownership in container
docker exec fireflies-clone ls -la

# All files should be owned by fireflies:nodejs
```

### Network Security
```bash
# Run on custom network
docker network create fireflies-net
docker run --network fireflies-net fireflies-clone
```

## 📝 Maintenance

### Regular Maintenance Tasks
```bash
# Update base image
docker pull node:18-alpine

# Rebuild with latest dependencies
docker build --no-cache -t fireflies-clone .

# Clean up unused resources
docker system prune -a

# Backup volumes
docker run --rm -v fireflies_data:/data -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz /data
```

### Log Management
```bash
# View logs with timestamps
docker logs -t fireflies-clone

# Follow logs in real-time
docker logs -f fireflies-clone

# Limit log size in docker-compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

This Docker setup provides a robust, scalable, and secure way to deploy your Fireflies clone! 🔥 