# Build stage
FROM node:20.11-alpine3.19 AS builder

WORKDIR /app

# Install build dependencies for whisper.cpp
RUN apk update && apk add --no-cache \
    cmake \
    make \
    g++ \
    git \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev deps for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build whisper.cpp
RUN cd whisper.cpp && \
    mkdir -p build && \
    cd build && \
    cmake .. && \
    make -j$(nproc) && \
    ls -la bin/ && \
    find . -name "*.so*" -type f && \
    echo "Libraries built:"

# Build TypeScript
RUN npm run build

# Build CSS
RUN npm run css:build

# Generate database migrations
RUN npm run db:generate

# Production stage
FROM node:20.11-alpine3.19 AS production

WORKDIR /app

# Update packages and install dumb-init for proper signal handling
RUN apk update && apk upgrade && apk add --no-cache dumb-init && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S fireflies -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=fireflies:nodejs /app/dist ./dist
COPY --from=builder --chown=fireflies:nodejs /app/src/public ./src/public
COPY --from=builder --chown=fireflies:nodejs /app/src/views ./src/views
COPY --from=builder --chown=fireflies:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=fireflies:nodejs /app/drizzle.config.ts ./drizzle.config.ts

# Copy whisper.cpp build artifacts including shared libraries
COPY --from=builder --chown=fireflies:nodejs /app/whisper.cpp/build ./whisper.cpp/build

# Copy startup script
COPY --chown=fireflies:nodejs start.sh ./start.sh
RUN chmod +x ./start.sh

# Create necessary directories
RUN mkdir -p uploads && chown fireflies:nodejs uploads
RUN mkdir -p logs && chown fireflies:nodejs logs
RUN mkdir -p temp/recordings && chown fireflies:nodejs temp
RUN mkdir -p models && chown fireflies:nodejs models

# Create database directory and initialize database
RUN mkdir -p /app/data && chown fireflies:nodejs /app/data
RUN touch /app/data/sqlite.db && chown fireflies:nodejs /app/data/sqlite.db

# Switch to non-root user
USER fireflies

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=/app/data/sqlite.db
ENV UPLOAD_DIR=./uploads
ENV LD_LIBRARY_PATH=/app/whisper.cpp/build/src:/app/whisper.cpp/build/ggml/src:/app/whisper.cpp/build:$LD_LIBRARY_PATH

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["./start.sh"] 