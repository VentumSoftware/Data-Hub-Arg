FROM node:20-alpine AS base

# Install dependencies for node-gyp and native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

WORKDIR /app

# Copy package files
COPY services/message-publisher/package*.json ./
COPY services/message-publisher/tsconfig.json ./

# Install dependencies
RUN npm install --only=production

# Development stage
FROM base AS development
RUN npm install
COPY services/message-publisher/ .
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN npm install
COPY services/message-publisher/ .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

RUN apk add --no-cache \
    dumb-init \
    libc6-compat

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S ventum -u 1001

WORKDIR /app

# Copy package files
COPY services/message-publisher/package*.json ./

# Install only production dependencies
RUN npm install --only=production && npm cache clean --force

# Copy built application
COPY --from=build /app/dist ./dist

# Change ownership to non-root user
RUN chown -R ventum:nodejs /app
USER ventum

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]