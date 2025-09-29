# Multi-stage build for Node.js/NestJS application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY ./packages/api/package*.json ./

# Install all dependencies (including dev for build)
RUN npm install && npm cache clean --force

# Copy source code and shared scripts
COPY ./packages/api .
COPY ./packages/shared ./shared

# Build the application
RUN npm run build && find dist/ -name "*.js" | head -10

# Production stage - Usando node:18-slim (Debian-based)
FROM node:18-slim AS production

# Instalar dependencias del sistema incluyendo Chrome y dumb-init
RUN apt-get update && \
    apt-get install -y \
        wget \
        gnupg \
        ca-certificates \
        procps \
        curl \
        dumb-init \
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libc6 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libgcc1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libstdc++6 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        lsb-release \
        xdg-utils && \
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && \
    apt-get install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*
    
RUN which google-chrome-stable && \
    ls -la /usr/bin/google-chrome* && \
    google-chrome-stable --version
# Create app user (usando comandos Debian)
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m nestjs

# Set working directory
WORKDIR /app

# Copy package files
COPY ./packages/api/package*.json ./

# Install production dependencies + tools needed for migrations
RUN npm install --omit=dev && \
    npm install drizzle-kit ts-node typescript && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/src/health-check.js ./
COPY --from=builder --chown=nestjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nestjs:nodejs /app/drizzle.config.ts ./
COPY --from=builder --chown=nestjs:nodejs /app/tsconfig*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/shared ./shared

# Create uploads directory
RUN mkdir -p uploads && chown nestjs:nodejs uploads

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node health-check.js || exit 1

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]